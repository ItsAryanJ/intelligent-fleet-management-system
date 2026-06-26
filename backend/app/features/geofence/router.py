"""
Geofence & Route Deviation Engine — Detects depot entry/exit, unauthorized presence,
and route deviation. Generates incidents, notifications, and audit entries.
"""

import math
from typing import Annotated, Optional
from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.core.database import get_db
from app.core.dependencies import CurrentUser, require_permission, get_current_user
from app.core.permissions import Permission, RoleName
from app.core.exceptions import NotFoundException
from app.models import (
    Vehicle, Depot, GPSPing, Incident, Notification, AuditLog,
    IncidentType, IncidentSeverity, IncidentStatus, NotificationType,
    Route, Stop,
)

router = APIRouter()


# ── Haversine distance (meters) ──────────────────────────────────────────
def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6_371_000  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ── Point-in-radius check ───────────────────────────────────────────────
def _is_in_geofence(lat: float, lon: float, depot_lat: float, depot_lon: float, radius_m: float) -> bool:
    return _haversine_m(lat, lon, depot_lat, depot_lon) <= radius_m


# ── Minimum distance from a GPS point to a route (via stops) ────────────
def _min_distance_to_route(lat: float, lon: float, stops: list) -> float:
    """Return minimum distance in meters from (lat, lon) to any stop on the route."""
    if not stops:
        return float("inf")
    return min(_haversine_m(lat, lon, s.latitude, s.longitude) for s in stops if s.latitude and s.longitude)


# ── Schemas ──────────────────────────────────────────────────────────────

class GeofenceCheckRequest(BaseModel):
    vehicle_id: UUID
    latitude: float
    longitude: float


class GeofenceCheckResponse(BaseModel):
    in_any_depot: bool
    depot_name: str | None = None
    depot_id: str | None = None
    distance_m: float | None = None
    alert_type: str | None = None  # ENTRY, EXIT, UNAUTHORIZED, None


class RouteDeviationCheckRequest(BaseModel):
    vehicle_id: UUID
    latitude: float
    longitude: float
    route_id: UUID


class RouteDeviationCheckResponse(BaseModel):
    deviated: bool
    distance_from_route_m: float
    threshold_m: float
    alert_generated: bool = False


# ── Geofence Check Endpoint ─────────────────────────────────────────────

@router.post("/geofence/check", response_model=GeofenceCheckResponse)
async def check_geofence(
    body: GeofenceCheckRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.GPS_VIEW))],
):
    """
    Check if a vehicle is inside any depot geofence.
    Generates alerts for unauthorized presence.
    """
    # Get all depots with geofence radii
    depots_result = await db.execute(select(Depot).where(Depot.is_deleted == False))
    depots = depots_result.scalars().all()

    # Get vehicle
    vehicle = await db.execute(
        select(Vehicle).where(Vehicle.id == body.vehicle_id, Vehicle.is_deleted == False)
    )
    vehicle = vehicle.scalar_one_or_none()
    if not vehicle:
        return GeofenceCheckResponse(in_any_depot=False)

    if (
        current_user.role == RoleName.DEPOT_MANAGER.value
        and vehicle.depot_id != current_user.depot_id
    ):
        raise NotFoundException(
            "Vehicle",
            body.vehicle_id
        )

    for depot in depots:
        dist = _haversine_m(body.latitude, body.longitude, depot.latitude, depot.longitude)
        if dist <= depot.geofence_radius_m:
            # Vehicle is inside this depot's geofence
            alert_type = None

            # Check if vehicle belongs to this depot
            if vehicle.depot_id != depot.id:
                alert_type = "UNAUTHORIZED"
                # Create incident
                incident = Incident(
                    incident_no=f"GEO-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
                    title=f"Unauthorized vehicle {vehicle.registration_no} in {depot.name}",
                    description=f"Vehicle {vehicle.registration_no} detected in {depot.name} geofence but belongs to a different depot.",
                    incident_type=IncidentType.SECURITY,
                    severity=IncidentSeverity.P2,
                    status=IncidentStatus.OPEN,
                    vehicle_id=vehicle.id,
                    latitude=body.latitude,
                    longitude=body.longitude,
                )
                db.add(incident)

                # Audit log
                db.add(AuditLog(
                    user_id=current_user.id,
                    action="GEOFENCE_ALERT",
                    resource_type="geofence",
                    resource_id=str(depot.id),
                    details={
                        "type": "UNAUTHORIZED",
                        "vehicle_id": str(vehicle.id),
                        "registration_no": vehicle.registration_no,
                        "depot_name": depot.name,
                        "distance_m": round(dist, 1),
                    },
                ))
                await db.flush()

            return GeofenceCheckResponse(
                in_any_depot=True,
                depot_name=depot.name,
                depot_id=str(depot.id),
                distance_m=round(dist, 1),
                alert_type=alert_type,
            )

    return GeofenceCheckResponse(in_any_depot=False, distance_m=None)


# ── Geofence Status for All Depots ───────────────────────────────────────

@router.get("/geofence/status")
async def geofence_status(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.GEOFENCE_VIEW))],
):
    """Get geofence status for all depots with vehicles inside."""

    depots_stmt = select(Depot).where(
        Depot.is_deleted == False
    )

    vehicles_stmt = select(Vehicle).where(
        Vehicle.is_deleted == False,
        Vehicle.last_latitude.isnot(None)
    )

    if current_user.role == RoleName.DEPOT_MANAGER.value:
        depots_stmt = depots_stmt.where(
            Depot.id == current_user.depot_id
        )

        vehicles_stmt = vehicles_stmt.where(
            Vehicle.depot_id == current_user.depot_id
        )

    depots_result = await db.execute(
        depots_stmt
    )

    vehicles_result = await db.execute(
        vehicles_stmt
    )
    vehicles = vehicles_result.scalars().all()

    depot_status = []
    for depot in depots_result.scalars().all():
        vehicles_inside = []
        for v in vehicles:
            if v.last_latitude and v.last_longitude:
                dist = _haversine_m(v.last_latitude, v.last_longitude, depot.latitude, depot.longitude)
                if dist <= depot.geofence_radius_m:
                    vehicles_inside.append({
                        "vehicle_id": str(v.id),
                        "registration_no": v.registration_no,
                        "distance_m": round(dist, 1),
                        "authorized": v.depot_id == depot.id,
                    })

        depot_status.append({
            "depot_id": str(depot.id),
            "depot_name": depot.name,
            "depot_code": depot.code,
            "latitude": depot.latitude,
            "longitude": depot.longitude,
            "radius_m": depot.geofence_radius_m,
            "vehicles_inside": len(vehicles_inside),
            "unauthorized_count": sum(1 for v in vehicles_inside if not v["authorized"]),
            "vehicles": vehicles_inside,
        })

    return {"depots": depot_status}


# ── Route Deviation Check ────────────────────────────────────────────────

@router.post("/route-deviation/check", response_model=RouteDeviationCheckResponse)
async def check_route_deviation(
    body: RouteDeviationCheckRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.GPS_VIEW))],
    threshold_m: float = Query(500.0, description="Deviation threshold in meters"),
):
    """
    Check if a vehicle has deviated from its assigned route.
    Generates incident + notification if deviation exceeds threshold.
    """
    # Get route with stops
    route_result = await db.execute(
        select(Route)
        .options(selectinload(Route.stops))
        .where(Route.id == body.route_id, Route.is_deleted == False)
    )
    route = route_result.scalar_one_or_none()
    if not route:
        return RouteDeviationCheckResponse(deviated=False, distance_from_route_m=0, threshold_m=threshold_m)

    # Get vehicle
    vehicle_result = await db.execute(
        select(Vehicle).where(Vehicle.id == body.vehicle_id, Vehicle.is_deleted == False)
    )
    vehicle = vehicle_result.scalar_one_or_none()
    if not vehicle:
        return RouteDeviationCheckResponse(deviated=False, distance_from_route_m=0, threshold_m=threshold_m)

    if (
        current_user.role == RoleName.DEPOT_MANAGER.value
        and vehicle.depot_id != current_user.depot_id
    ):
        raise NotFoundException(
            "Vehicle",
            body.vehicle_id
        )

    # Calculate minimum distance to route
    min_dist = _min_distance_to_route(body.latitude, body.longitude, route.stops)
    deviated = min_dist > threshold_m
    alert_generated = False

    if deviated:
        # Create incident
        incident = Incident(
            incident_no=f"RD-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
            title=f"Route deviation: {vehicle.registration_no} on {route.code}",
            description=(
                f"Vehicle {vehicle.registration_no} deviated {round(min_dist)}m from "
                f"route {route.code} ({route.name}). Threshold: {threshold_m}m."
            ),
            incident_type=IncidentType.ROUTE_DEVIATION,
            severity=IncidentSeverity.P2,
            status=IncidentStatus.OPEN,
            vehicle_id=vehicle.id,
            route_id=route.id,
            latitude=body.latitude,
            longitude=body.longitude,
        )
        db.add(incident)

        # Audit log
        db.add(AuditLog(
            user_id=current_user.id,
            action="ROUTE_DEVIATION_ALERT",
            resource_type="route_deviation",
            resource_id=str(route.id),
            details={
                "vehicle_id": str(vehicle.id),
                "registration_no": vehicle.registration_no,
                "route_code": route.code,
                "distance_m": round(min_dist, 1),
                "threshold_m": threshold_m,
            },
        ))

        await db.flush()
        alert_generated = True

    return RouteDeviationCheckResponse(
        deviated=deviated,
        distance_from_route_m=round(min_dist, 1),
        threshold_m=threshold_m,
        alert_generated=alert_generated,
    )


# ── Route Deviation Summary ──────────────────────────────────────────────

@router.get("/route-deviation/summary")
async def route_deviation_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[
        CurrentUser,
        Depends(require_permission(Permission.GPS_VIEW))
    ],
):
    """Get summary of recent route deviation incidents."""

    stmt = (
        select(Incident)
        .where(
            Incident.is_deleted == False,
            Incident.incident_type == IncidentType.ROUTE_DEVIATION,
            Incident.status.in_([
                "OPEN",
                "ACKNOWLEDGED",
                "ASSIGNED",
                "IN_PROGRESS",
            ]),
        )
    )

    if current_user.role == RoleName.DEPOT_MANAGER.value:
        stmt = stmt.where(
            Incident.vehicle.has(
                Vehicle.depot_id == current_user.depot_id
            )
        )

    stmt = (
        stmt
        .order_by(Incident.created_at.desc())
        .limit(20)
    )

    result = await db.execute(stmt)
    incidents = result.scalars().all()

    return {
        "total_active": len(incidents),
        "incidents": [
            {
                "id": str(i.id),
                "incident_no": i.incident_no,
                "title": i.title,
                "severity": i.severity if isinstance(i.severity, str) else i.severity.value,
                "status": i.status if isinstance(i.status, str) else i.status.value,
                "created_at": i.created_at.isoformat(),
            }
            for i in incidents
        ],
    }
