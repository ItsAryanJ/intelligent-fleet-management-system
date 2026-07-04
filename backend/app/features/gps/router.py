"""
GPS feature — Live tracking, historical replay, trip analytics, WebSocket streaming.
"""

from typing import Annotated, Optional
from uuid import UUID
from datetime import datetime, date, timezone

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.core.database import get_db
from app.core.dependencies import CurrentUser, require_permission, get_current_user
from app.core.permissions import Permission, RoleName
from app.core.websocket import gps_manager
from app.core.utils import haversine_km
from app.models import GPSPing, Vehicle
from app.core.exceptions import NotFoundException

router = APIRouter()


@router.get("/live")
async def get_live_positions(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.GPS_VIEW))],
    depot_id: Optional[UUID] = None,
    route_id: Optional[UUID] = None,
    status: Optional[str] = None,
):
    """Get latest position for all vehicles (live fleet view)."""
    stmt = (
        select(Vehicle)
        .options(selectinload(Vehicle.depot), selectinload(Vehicle.health))
        .where(Vehicle.is_deleted == False)
    )

    if depot_id:
        stmt = stmt.where(Vehicle.depot_id == depot_id)
    if status:
        stmt = stmt.where(Vehicle.status == status)

    if current_user.role == RoleName.DEPOT_MANAGER.value:
        stmt = stmt.where(
            Vehicle.depot_id == current_user.depot_id
        )

    result = await db.execute(stmt)
    vehicles = result.scalars().all()

    return [
        {
            "vehicle_id": str(v.id),
            "registration_no": v.registration_no,
            "vehicle_type": v.vehicle_type if isinstance(v.vehicle_type, str) else v.vehicle_type.value,
            "status": v.status if isinstance(v.status, str) else v.status.value,
            "depot_name": v.depot.name if v.depot else None,
            "latitude": v.last_latitude,
            "longitude": v.last_longitude,
            "speed": v.last_speed or 0,
            "heading": v.last_heading or 0,
            "ignition_on": v.ignition_on,
            "last_updated": v.last_gps_time.isoformat() if v.last_gps_time else None,
            "fuel_level": v.health.fuel_level if v.health else None,
            "health_score": v.health.health_score if v.health else None,
        }
        for v in vehicles
        if v.last_latitude is not None
    ]


@router.get("/history/{vehicle_id}")
async def get_history(
    vehicle_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.GPS_VIEW))],
    start_date: date = Query(...),
    end_date: Optional[date] = None,
):

    """Get historical GPS pings for a vehicle (for replay)."""
    vehicle = await db.get(Vehicle, vehicle_id)

    if not vehicle:
        raise NotFoundException("Vehicle", vehicle_id)
    if (
        current_user.role == RoleName.DEPOT_MANAGER.value
        and vehicle.depot_id != current_user.depot_id
    ):
        raise NotFoundException("Vehicle", vehicle_id)
    
    end = end_date or start_date
    stmt = (
        select(GPSPing)
        .where(
            GPSPing.vehicle_id == vehicle_id,
            GPSPing.timestamp >= datetime.combine(start_date, datetime.min.time()).replace(tzinfo=timezone.utc),
            GPSPing.timestamp <= datetime.combine(end, datetime.max.time()).replace(tzinfo=timezone.utc),
        )
        .order_by(GPSPing.timestamp)
        .limit(10000)
    )
    result = await db.execute(stmt)
    pings = result.scalars().all()

    # ── Filter out impossible jumps ──────────────────────────────────
    # The live GPS simulator may insert pings that interleave with seed
    # data on different routes, creating zigzag artifacts. Use a speed-based
    # threshold: RRTS max speed is ~160 km/h; reject pings implying >200 km/h.
    MAX_PLAUSIBLE_SPEED_KMH = 200.0
    filtered: list = []
    for p in pings:
        if not filtered:
            filtered.append(p)
            continue
        prev = filtered[-1]
        gap_s = (p.timestamp - prev.timestamp).total_seconds()
        # Allow jumps if there's a large time gap (>5 min = likely new trip segment)
        if gap_s > 300:
            filtered.append(p)
            continue
        if gap_s < 0.5:
            # Sub-second pings from the live simulator — skip duplicates
            continue
        dist = haversine_km(prev.latitude, prev.longitude, p.latitude, p.longitude)
        implied_speed = (dist / gap_s) * 3600 if gap_s > 0 else 999999
        if implied_speed <= MAX_PLAUSIBLE_SPEED_KMH:
            filtered.append(p)
        # else: silently drop this ping (impossible speed)

    return {
        "vehicle_id": str(vehicle_id),
        "start_date": start_date.isoformat(),
        "end_date": end.isoformat(),
        "total_pings": len(filtered),
        "pings": [
            {
                "latitude": p.latitude,
                "longitude": p.longitude,
                "speed": p.speed,
                "heading": p.heading,
                "ignition_on": p.ignition_on,
                "timestamp": p.timestamp.isoformat(),
            }
            for p in filtered
        ],
    }


@router.get("/trip-analytics/{vehicle_id}")
async def get_trip_analytics(
    vehicle_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.GPS_VIEW))],
    trip_date: date = Query(...),
):
    """Get trip analytics for a vehicle on a given date."""
    start_dt = datetime.combine(trip_date, datetime.min.time()).replace(tzinfo=timezone.utc)
    end_dt = datetime.combine(trip_date, datetime.max.time()).replace(tzinfo=timezone.utc)

    vehicle = await db.get(Vehicle, vehicle_id)

    if not vehicle:
        raise NotFoundException("Vehicle", vehicle_id)

    if (
        current_user.role == RoleName.DEPOT_MANAGER.value
        and vehicle.depot_id != current_user.depot_id
    ):
        raise NotFoundException("Vehicle", vehicle_id)
    
    stmt = (
        select(GPSPing)
        .where(
            GPSPing.vehicle_id == vehicle_id,
            GPSPing.timestamp >= start_dt,
            GPSPing.timestamp <= end_dt,
        )
        .order_by(GPSPing.timestamp)
    )
    result = await db.execute(stmt)
    pings = result.scalars().all()

    if not pings:
        return {
            "vehicle_id": str(vehicle_id),
            "date": trip_date.isoformat(),
            "total_pings": 0,
            "distance_km": 0,
            "avg_speed": 0,
            "max_speed": 0,
            "idle_time_mins": 0,
            "moving_time_mins": 0,
        }

    speeds = [p.speed for p in pings]

    # Approximate distance using shared Haversine helper
    # Skip impossible jumps (same logic as history endpoint)
    MAX_PLAUSIBLE_SPEED_KMH = 200.0
    total_distance = 0.0
    idle_time_seconds = 0.0
    moving_time_seconds = 0.0

    for i in range(1, len(pings)):
        delta = (pings[i].timestamp - pings[i-1].timestamp).total_seconds()
        if delta < 0.5:
            continue  # Skip sub-second duplicate pings
        dist = haversine_km(
            pings[i-1].latitude, pings[i-1].longitude,
            pings[i].latitude, pings[i].longitude,
        )
        implied_speed = (dist / delta) * 3600 if delta > 0 else 999999
        if delta <= 300 and implied_speed > MAX_PLAUSIBLE_SPEED_KMH:
            continue  # Skip impossible jump
        total_distance += dist
        # Cap individual deltas at 1 hour to avoid counting large gaps
        delta = min(delta, 3600)
        if pings[i-1].speed < 2.0:
            idle_time_seconds += delta
        else:
            moving_time_seconds += delta

    time_span = (pings[-1].timestamp - pings[0].timestamp).total_seconds() / 60  # minutes
    idle_time = idle_time_seconds / 60  # minutes
    moving_time = moving_time_seconds / 60  # minutes

    return {
        "vehicle_id": str(vehicle_id),
        "date": trip_date.isoformat(),
        "total_pings": len(pings),
        "distance_km": round(total_distance, 2),
        "avg_speed": round(sum(speeds) / len(speeds), 1) if speeds else 0,
        "max_speed": round(max(speeds), 1) if speeds else 0,
        "idle_time_mins": round(idle_time, 1),
        "moving_time_mins": round(moving_time, 1),
        "total_time_mins": round(time_span, 1),
        "first_ping": pings[0].timestamp.isoformat(),
        "last_ping": pings[-1].timestamp.isoformat(),
    }


@router.websocket("/stream")
async def websocket_gps_stream(websocket: WebSocket):
    """WebSocket endpoint for real-time GPS updates. Requires ?token=<JWT>."""
    # Authenticate via query param
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Missing authentication token")
        return

    try:
        from app.core.security import verify_access_token
        payload = verify_access_token(token)
    except (ValueError, Exception):
        await websocket.close(code=4001, reason="Invalid or expired token")
        return

    # Attach user metadata for potential depot-scoped broadcasting
    metadata = {
        "user_id": payload.get("sub"),
        "role": payload.get("role"),
        "depot_id": payload.get("depot_id"),
    }
    await gps_manager.connect(websocket, metadata=metadata)
    try:
        while True:
            # Keep connection alive, receive any client messages
            data = await websocket.receive_text()
            # Client can send filter preferences
    except WebSocketDisconnect:
        gps_manager.disconnect(websocket)
