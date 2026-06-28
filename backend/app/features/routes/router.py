"""
Routes feature — Route and stop management with geometry.
"""

from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.core.dependencies import CurrentUser, require_permission, get_current_user
from app.core.exceptions import ConflictException, NotFoundException
from app.core.permissions import Permission, RoleName
from app.models import Route, Stop, RouteStop

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────────
class RouteCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    depot_id: UUID
    distance_km: float = 0.0
    estimated_duration_mins: int = 60
    frequency_mins: int = 15
    color: str = "#3B82F6"
    is_circular: bool = False


class RouteUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    distance_km: Optional[float] = None
    estimated_duration_mins: Optional[int] = None
    frequency_mins: Optional[int] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None


class StopCreate(BaseModel):
    name: str
    code: str
    latitude: float
    longitude: float
    stop_type: str = "REGULAR"
    address: Optional[str] = None


class RouteStopAssign(BaseModel):
    stop_id: UUID
    sequence: int
    distance_from_start_km: float = 0.0
    scheduled_arrival_offset_mins: int = 0
    scheduled_departure_offset_mins: int = 0
    is_timing_point: bool = False


class RouteResponse(BaseModel):
    id: UUID
    name: str
    code: str
    description: Optional[str] = None
    depot_id: UUID
    depot_name: Optional[str] = None
    distance_km: float
    estimated_duration_mins: int
    frequency_mins: int
    color: str
    is_active: bool
    is_circular: bool
    stop_count: int = 0
    created_at: str


class StopResponse(BaseModel):
    id: UUID
    name: str
    code: str
    latitude: float
    longitude: float
    stop_type: str
    address: Optional[str] = None
    is_active: bool


class RouteStopResponse(BaseModel):
    id: UUID
    stop: StopResponse
    sequence: int
    distance_from_start_km: float
    scheduled_arrival_offset_mins: int
    scheduled_departure_offset_mins: int
    is_timing_point: bool


# ── Route Endpoints ──────────────────────────────────────────────────────
@router.get("")
async def list_routes(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    depot_id: Optional[UUID] = None,
    is_active: Optional[bool] = None,
):
    """List all routes."""
    stmt = (
        select(Route)
        .options(selectinload(Route.depot), selectinload(Route.route_stops))
        .where(Route.is_deleted == False)
    )
    if depot_id:
        stmt = stmt.where(Route.depot_id == depot_id)
    elif current_user.role == RoleName.DEPOT_MANAGER.value:
        stmt = stmt.where(Route.depot_id == current_user.depot_id)
    if is_active is not None:
        stmt = stmt.where(Route.is_active == is_active)

    stmt = stmt.order_by(Route.code)
    result = await db.execute(stmt)
    routes = result.scalars().all()

    return [
        RouteResponse(
            id=r.id, name=r.name, code=r.code, description=r.description,
            depot_id=r.depot_id, depot_name=r.depot.name if r.depot else None,
            distance_km=r.distance_km, estimated_duration_mins=r.estimated_duration_mins,
            frequency_mins=r.frequency_mins, color=r.color, is_active=r.is_active,
            is_circular=r.is_circular,
            stop_count=len(r.route_stops) if r.route_stops else 0,
            created_at=r.created_at.isoformat(),
        )
        for r in routes
    ]


@router.get("/{route_id}")
async def get_route(
    route_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    """Get a route with its stops."""
    stmt = (
        select(Route)
        .options(
            selectinload(Route.depot),
            selectinload(Route.route_stops).selectinload(RouteStop.stop),
        )
        .where(Route.id == route_id, Route.is_deleted == False)
    )
    result = await db.execute(stmt)
    route = result.scalar_one_or_none()

    if not route:
        raise NotFoundException("Route", route_id)

    return {
        "id": route.id,
        "name": route.name,
        "code": route.code,
        "description": route.description,
        "depot_id": route.depot_id,
        "depot_name": route.depot.name if route.depot else None,
        "distance_km": route.distance_km,
        "estimated_duration_mins": route.estimated_duration_mins,
        "frequency_mins": route.frequency_mins,
        "color": route.color,
        "is_active": route.is_active,
        "is_circular": route.is_circular,
        "stops": [
            {
                "id": rs.id,
                "stop_id": rs.stop_id,
                "stop_name": rs.stop.name if rs.stop else None,
                "stop_code": rs.stop.code if rs.stop else None,
                "latitude": rs.stop.latitude if rs.stop else None,
                "longitude": rs.stop.longitude if rs.stop else None,
                "sequence": rs.sequence,
                "distance_from_start_km": rs.distance_from_start_km,
                "scheduled_arrival_offset_mins": rs.scheduled_arrival_offset_mins,
                "is_timing_point": rs.is_timing_point,
            }
            for rs in sorted(route.route_stops, key=lambda x: x.sequence)
        ],
        "created_at": route.created_at.isoformat(),
    }


@router.post("", status_code=201)
async def create_route(
    body: RouteCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.ROUTE_EDIT))],
):
    """Create a new route."""
    existing = await db.execute(select(Route).where(Route.code == body.code))
    if existing.scalar_one_or_none():
        raise ConflictException("Route with this code already exists")

    route = Route(
        name=body.name, code=body.code, description=body.description,
        depot_id=body.depot_id, distance_km=body.distance_km,
        estimated_duration_mins=body.estimated_duration_mins,
        frequency_mins=body.frequency_mins, color=body.color,
        is_circular=body.is_circular, created_by=str(current_user.id),
    )
    db.add(route)
    await db.flush()

    return {"id": route.id, "name": route.name, "code": route.code}


@router.put("/{route_id}")
async def update_route(
    route_id: UUID,
    body: RouteUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.ROUTE_EDIT))],
):
    """Update a route."""
    stmt = select(Route).where(Route.id == route_id, Route.is_deleted == False)
    result = await db.execute(stmt)
    route = result.scalar_one_or_none()

    if not route:
        raise NotFoundException("Route", route_id)

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(route, field, value)
    route.updated_by = str(current_user.id)
    await db.flush()

    return {"id": route.id, "name": route.name, "code": route.code}


# ── Stop Endpoints ───────────────────────────────────────────────────────
@router.get("/stops/list")
async def list_stops(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    search: Optional[str] = None,
):
    """List all stops."""
    stmt = select(Stop).where(Stop.is_deleted == False)
    if search:
        stmt = stmt.where(Stop.name.ilike(f"%{search}%"))
    stmt = stmt.order_by(Stop.name)
    result = await db.execute(stmt)
    stops = result.scalars().all()

    return [
        StopResponse(
            id=s.id, name=s.name, code=s.code,
            latitude=s.latitude, longitude=s.longitude,
            stop_type=s.stop_type if isinstance(s.stop_type, str) else s.stop_type.value,
            address=s.address, is_active=s.is_active,
        )
        for s in stops
    ]


@router.post("/stops", status_code=201)
async def create_stop(
    body: StopCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.ROUTE_EDIT))],
):
    """Create a new stop."""
    stop = Stop(
        name=body.name, code=body.code,
        latitude=body.latitude, longitude=body.longitude,
        stop_type=body.stop_type, address=body.address,
        created_by=str(current_user.id),
    )
    db.add(stop)
    await db.flush()
    return {"id": stop.id, "name": stop.name, "code": stop.code}
