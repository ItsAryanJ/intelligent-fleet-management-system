"""
Depots feature — CRUD with geofence support.
"""

from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field, ConfigDict

from app.core.database import get_db
from app.core.dependencies import CurrentUser, require_permission
from app.core.exceptions import ConflictException, NotFoundException, ForbiddenException
from app.core.permissions import Permission, RoleName
from app.models import Depot

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────────
class DepotCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    code: str = Field(min_length=1, max_length=50)
    address: Optional[str] = None
    city: str = "NCR"
    state: str = "Delhi NCR"
    latitude: float
    longitude: float
    geofence_radius_m: float = 500.0
    capacity: int = 50
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None


class DepotUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    geofence_radius_m: Optional[float] = None
    capacity: Optional[int] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None


class DepotResponse(BaseModel):
    id: UUID
    name: str
    code: str
    address: Optional[str] = None
    city: str
    state: str
    latitude: float
    longitude: float
    geofence_radius_m: float
    capacity: int
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    vehicle_count: int = 0
    user_count: int = 0
    created_at: str

    model_config = ConfigDict(from_attributes=True)


# ── Endpoints ────────────────────────────────────────────────────────────
@router.get("")
async def list_depots(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.DEPOT_VIEW))],
):
    """List all depots."""
    stmt = (
        select(Depot)
        .where(Depot.is_deleted == False)
    )

    if current_user.role == RoleName.DEPOT_MANAGER.value:
        stmt = stmt.where(
            Depot.id == current_user.depot_id
        )

    stmt = stmt.order_by(Depot.name)
    result = await db.execute(stmt)
    depots = result.scalars().all()

    return [
        DepotResponse(
            id=d.id,
            name=d.name,
            code=d.code,
            address=d.address,
            city=d.city,
            state=d.state,
            latitude=d.latitude,
            longitude=d.longitude,
            geofence_radius_m=d.geofence_radius_m,
            capacity=d.capacity,
            contact_phone=d.contact_phone,
            contact_email=d.contact_email,
            vehicle_count=len(d.vehicles) if d.vehicles else 0,
            user_count=len(d.users) if d.users else 0,
            created_at=d.created_at.isoformat(),
        )
        for d in depots
    ]


@router.get("/{depot_id}", response_model=DepotResponse)
async def get_depot(
    depot_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.DEPOT_VIEW))],
):
    """Get a single depot."""
    stmt = select(Depot).where(
        Depot.id == depot_id,
        Depot.is_deleted == False
    )
    if current_user.role == RoleName.DEPOT_MANAGER.value:
        stmt = stmt.where(
            Depot.id == current_user.depot_id
        )
    result = await db.execute(stmt)
    depot = result.scalar_one_or_none()

    if not depot:
        raise NotFoundException("Depot", depot_id)

    return DepotResponse(
        id=depot.id,
        name=depot.name,
        code=depot.code,
        address=depot.address,
        city=depot.city,
        state=depot.state,
        latitude=depot.latitude,
        longitude=depot.longitude,
        geofence_radius_m=depot.geofence_radius_m,
        capacity=depot.capacity,
        contact_phone=depot.contact_phone,
        contact_email=depot.contact_email,
        vehicle_count=len(depot.vehicles) if depot.vehicles else 0,
        user_count=len(depot.users) if depot.users else 0,
        created_at=depot.created_at.isoformat(),
    )


@router.post("", response_model=DepotResponse, status_code=201)
async def create_depot(
    body: DepotCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.DEPOT_EDIT))],
):
    """Create a new depot."""
    existing = await db.execute(select(Depot).where(Depot.code == body.code))
    if existing.scalar_one_or_none():
        raise ConflictException("Depot with this code already exists")

    if current_user.role == RoleName.DEPOT_MANAGER.value:
        raise ForbiddenException(
            "Depot Managers cannot create depots"
        )
    depot = Depot(
        name=body.name,
        code=body.code,
        address=body.address,
        city=body.city,
        state=body.state,
        latitude=body.latitude,
        longitude=body.longitude,
        geofence_radius_m=body.geofence_radius_m,
        capacity=body.capacity,
        contact_phone=body.contact_phone,
        contact_email=body.contact_email,
        created_by=str(current_user.id),
    )
    db.add(depot)
    await db.flush()

    return DepotResponse(
        id=depot.id,
        name=depot.name,
        code=depot.code,
        address=depot.address,
        city=depot.city,
        state=depot.state,
        latitude=depot.latitude,
        longitude=depot.longitude,
        geofence_radius_m=depot.geofence_radius_m,
        capacity=depot.capacity,
        contact_phone=depot.contact_phone,
        contact_email=depot.contact_email,
        vehicle_count=0,
        user_count=0,
        created_at=depot.created_at.isoformat(),
    )


@router.put("/{depot_id}", response_model=DepotResponse)
async def update_depot(
    depot_id: UUID,
    body: DepotUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.DEPOT_EDIT))],
):
    """Update a depot."""
    stmt = select(Depot).where(Depot.id == depot_id, Depot.is_deleted == False)
    result = await db.execute(stmt)
    depot = result.scalar_one_or_none()

    if not depot:
        raise NotFoundException("Depot", depot_id)

    if (
        current_user.role == RoleName.DEPOT_MANAGER.value
        and depot.id != current_user.depot_id
    ):
        raise NotFoundException("Depot", depot_id)

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(depot, field, value)
    depot.updated_by = str(current_user.id)

    await db.flush()

    return DepotResponse(
        id=depot.id,
        name=depot.name,
        code=depot.code,
        address=depot.address,
        city=depot.city,
        state=depot.state,
        latitude=depot.latitude,
        longitude=depot.longitude,
        geofence_radius_m=depot.geofence_radius_m,
        capacity=depot.capacity,
        contact_phone=depot.contact_phone,
        contact_email=depot.contact_email,
        vehicle_count=len(depot.vehicles) if depot.vehicles else 0,
        user_count=len(depot.users) if depot.users else 0,
        created_at=depot.created_at.isoformat(),
    )
