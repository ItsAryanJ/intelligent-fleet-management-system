"""
Vehicles feature — CRUD, status tracking, health monitoring.
"""

from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.core.database import get_db
from app.core.dependencies import CurrentUser, require_permission, depot_scope_filter
from app.core.exceptions import ConflictException, NotFoundException
from app.core.permissions import Permission, RoleName
from app.models import Vehicle, VehicleHealth

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────────
class VehicleCreate(BaseModel):
    registration_no: str
    vehicle_type: str = "BUS"
    make: str = "Tata"
    model: str = "Starbus"
    year: int = 2023
    capacity: int = 40
    color: str = "White"
    depot_id: UUID


class VehicleUpdate(BaseModel):
    vehicle_type: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    status: Optional[str] = None
    depot_id: Optional[UUID] = None
    capacity: Optional[int] = None


class VehicleResponse(BaseModel):
    id: UUID
    registration_no: str
    vehicle_type: str
    make: str
    model: str
    year: int
    capacity: int
    status: str
    color: str
    depot_id: UUID
    depot_name: Optional[str] = None
    last_latitude: Optional[float] = None
    last_longitude: Optional[float] = None
    last_speed: Optional[float] = None
    last_heading: Optional[float] = None
    last_gps_time: Optional[str] = None
    ignition_on: bool = False
    fuel_level: Optional[float] = None
    health_score: Optional[float] = None
    current_driver: Optional[str] = None
    current_route: Optional[str] = None
    created_at: str


class VehicleListResponse(BaseModel):
    items: list[VehicleResponse]
    total: int
    page: int
    page_size: int


# ── Endpoints ────────────────────────────────────────────────────────────
@router.get("", response_model=VehicleListResponse)
async def list_vehicles(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.VEHICLE_VIEW))],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    status: Optional[str] = None,
    depot_id: Optional[UUID] = None,
    vehicle_type: Optional[str] = None,
):
    """List vehicles with filtering and pagination."""
    stmt = (
        select(Vehicle)
        .options(selectinload(Vehicle.depot), selectinload(Vehicle.health))
        .where(Vehicle.is_deleted == False)
    )
    # Depot-scope RBAC: restrict depot managers to their own depot
    scope = depot_scope_filter(current_user, Vehicle.depot_id)
    if scope is not None:
        stmt = stmt.where(scope)
    if search:
        stmt = stmt.where(Vehicle.registration_no.ilike(f"%{search}%"))
    if status:
        stmt = stmt.where(Vehicle.status == status)
    if depot_id:
        stmt = stmt.where(Vehicle.depot_id == depot_id)
    if vehicle_type:
        stmt = stmt.where(Vehicle.vehicle_type == vehicle_type)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    stmt = stmt.offset((page - 1) * page_size).limit(page_size).order_by(Vehicle.registration_no)
    result = await db.execute(stmt)
    vehicles = result.scalars().all()

    return VehicleListResponse(
        items=[_vehicle_to_response(v) for v in vehicles],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{vehicle_id}", response_model=VehicleResponse)
async def get_vehicle(
    vehicle_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.VEHICLE_VIEW))],
):
    """Get a vehicle by ID."""
    stmt = (
        select(Vehicle)
        .options(selectinload(Vehicle.depot), selectinload(Vehicle.health))
        .where(Vehicle.id == vehicle_id, Vehicle.is_deleted == False)
    )
    result = await db.execute(stmt)
    vehicle = result.scalar_one_or_none()

    if not vehicle:
        raise NotFoundException("Vehicle", vehicle_id)

    if (
        current_user.role == RoleName.DEPOT_MANAGER.value
        and vehicle.depot_id != current_user.depot_id
    ):
        raise NotFoundException("Vehicle", vehicle_id)

    return _vehicle_to_response(vehicle)


@router.post("", response_model=VehicleResponse, status_code=201)
async def create_vehicle(
    body: VehicleCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.VEHICLE_EDIT))],
):
    """Create a new vehicle."""
    existing = await db.execute(
        select(Vehicle).where(Vehicle.registration_no == body.registration_no)
    )
    if existing.scalar_one_or_none():
        raise ConflictException("Vehicle with this registration number already exists")

    if (
        current_user.role == RoleName.DEPOT_MANAGER.value
        and body.depot_id != current_user.depot_id
    ):
        raise ConflictException(
            "Cannot create vehicles for another depot"
        )

    vehicle = Vehicle(
        registration_no=body.registration_no,
        vehicle_type=body.vehicle_type,
        make=body.make,
        model=body.model,
        year=body.year,
        capacity=body.capacity,
        color=body.color,
        depot_id=body.depot_id,
        created_by=str(current_user.id),
    )
    db.add(vehicle)
    await db.flush()

    # Create health record
    health = VehicleHealth(vehicle_id=vehicle.id)
    db.add(health)
    await db.flush()
    await db.refresh(vehicle, ["depot", "health"])

    return _vehicle_to_response(vehicle)


@router.put("/{vehicle_id}", response_model=VehicleResponse)
async def update_vehicle(
    vehicle_id: UUID,
    body: VehicleUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.VEHICLE_EDIT))],
):
    """Update a vehicle."""
    stmt = (
        select(Vehicle)
        .options(selectinload(Vehicle.depot), selectinload(Vehicle.health))
        .where(Vehicle.id == vehicle_id, Vehicle.is_deleted == False)
    )
    result = await db.execute(stmt)
    vehicle = result.scalar_one_or_none()

    if not vehicle:
        raise NotFoundException("Vehicle", vehicle_id)

    if (
        current_user.role == RoleName.DEPOT_MANAGER.value
        and vehicle.depot_id != current_user.depot_id
    ):
        raise NotFoundException("Vehicle", vehicle_id)

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(vehicle, field, value)
    vehicle.updated_by = str(current_user.id)

    await db.flush()
    return _vehicle_to_response(vehicle)


@router.delete("/{vehicle_id}", status_code=200)
async def delete_vehicle(
    vehicle_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.VEHICLE_EDIT))],
):
    """Soft-delete a vehicle."""
    stmt = (
        select(Vehicle)
        .where(Vehicle.id == vehicle_id, Vehicle.is_deleted == False)
    )
    result = await db.execute(stmt)
    vehicle = result.scalar_one_or_none()

    if not vehicle:
        raise NotFoundException("Vehicle", vehicle_id)

    if (
        current_user.role == RoleName.DEPOT_MANAGER.value
        and vehicle.depot_id != current_user.depot_id
    ):
        raise NotFoundException("Vehicle", vehicle_id)

    vehicle.is_deleted = True
    vehicle.updated_by = str(current_user.id)
    await db.flush()

    return {"message": f"Vehicle {vehicle.registration_no} deleted"}

def _vehicle_to_response(v: Vehicle) -> VehicleResponse:
    return VehicleResponse(
        id=v.id,
        registration_no=v.registration_no,
        vehicle_type=v.vehicle_type if isinstance(v.vehicle_type, str) else v.vehicle_type.value,
        make=v.make,
        model=v.model,
        year=v.year,
        capacity=v.capacity,
        status=v.status if isinstance(v.status, str) else v.status.value,
        color=v.color,
        depot_id=v.depot_id,
        depot_name=v.depot.name if v.depot else None,
        last_latitude=v.last_latitude,
        last_longitude=v.last_longitude,
        last_speed=v.last_speed,
        last_heading=v.last_heading,
        last_gps_time=v.last_gps_time.isoformat() if v.last_gps_time else None,
        ignition_on=v.ignition_on,
        fuel_level=v.health.fuel_level if v.health else None,
        health_score=v.health.health_score if v.health else None,
        current_driver=None,
        current_route=None,
        created_at=v.created_at.isoformat(),
    )
