"""
Duties feature — Scheduling, roster management, conflict detection.
"""

from typing import Annotated, Optional
from uuid import UUID
from datetime import date, time, datetime, timezone, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.core.database import get_db
from app.core.dependencies import CurrentUser, require_permission, get_current_user
from app.core.exceptions import BadRequestException, ConflictException, ForbiddenException, NotFoundException
from app.core.permissions import Permission, RoleName
from app.models import Duty, DutyStatus, User, Vehicle, Route

router = APIRouter()


class DutyCreate(BaseModel):
    date: date
    shift: str = "MORNING"
    vehicle_id: Optional[UUID] = None
    driver_id: Optional[UUID] = None
    conductor_id: Optional[UUID] = None
    route_id: Optional[UUID] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    remarks: Optional[str] = None


class DutyUpdate(BaseModel):
    vehicle_id: Optional[UUID] = None
    driver_id: Optional[UUID] = None
    conductor_id: Optional[UUID] = None
    route_id: Optional[UUID] = None
    shift: Optional[str] = None
    status: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    remarks: Optional[str] = None


class BulkDutyAssign(BaseModel):
    assignments: list[DutyCreate]


@router.get("")
async def list_duties(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    duty_date: Optional[date] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    driver_id: Optional[UUID] = None,
    vehicle_id: Optional[UUID] = None,
    route_id: Optional[UUID] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    """List duties with filtering."""
    stmt = (
        select(Duty)
        .options(
            selectinload(Duty.vehicle),
            selectinload(Duty.driver),
            selectinload(Duty.conductor),
            selectinload(Duty.route),
        )
        .where(Duty.is_deleted == False)
    )

    if current_user.role == RoleName.DEPOT_MANAGER.value:
        stmt = stmt.where(
            (Duty.driver.has(User.depot_id == current_user.depot_id))
            |
            (Duty.conductor.has(User.depot_id == current_user.depot_id))
        )

    elif current_user.role == RoleName.DRIVER.value:
        stmt = stmt.where(
            Duty.driver_id == current_user.id
        )

    elif current_user.role == RoleName.CONDUCTOR.value:
        stmt = stmt.where(
            Duty.conductor_id == current_user.id
        )

    if duty_date:
        stmt = stmt.where(Duty.date == duty_date)
    if start_date:
        stmt = stmt.where(Duty.date >= start_date)
    if end_date:
        stmt = stmt.where(Duty.date <= end_date)
    if driver_id:
        stmt = stmt.where(Duty.driver_id == driver_id)
    if vehicle_id:
        stmt = stmt.where(Duty.vehicle_id == vehicle_id)
    if route_id:
        stmt = stmt.where(Duty.route_id == route_id)
    if status:
        stmt = stmt.where(Duty.status == status)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    stmt = stmt.offset((page - 1) * page_size).limit(page_size).order_by(Duty.date.desc(), Duty.shift)
    result = await db.execute(stmt)
    duties = result.scalars().all()

    return {
        "items": [_duty_to_dict(d) for d in duties],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/my-duties")
async def get_my_duties(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    duty_date: Optional[date] = None,
):
    """Get current user's duties (for drivers/conductors)."""
    target_date = duty_date or date.today()
    stmt = (
        select(Duty)
        .options(
            selectinload(Duty.vehicle),
            selectinload(Duty.route),
            selectinload(Duty.driver),
            selectinload(Duty.conductor),
        )
        .where(
            Duty.is_deleted == False,
            Duty.date == target_date,
            (Duty.driver_id == current_user.id) | (Duty.conductor_id == current_user.id),
        )
    )
    result = await db.execute(stmt)
    duties = result.scalars().all()
    return [_duty_to_dict(d) for d in duties]


@router.get("/roster")
async def get_roster(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.DUTY_VIEW))],
    start_date: date = Query(...),
    end_date: date = Query(...),
    depot_id: Optional[UUID] = None,
):
    """Get weekly roster grid."""
    stmt = (
        select(Duty)
        .options(
            selectinload(Duty.vehicle),
            selectinload(Duty.driver),
            selectinload(Duty.conductor),
            selectinload(Duty.route),
        )
        .where(
            Duty.is_deleted == False,
            Duty.date >= start_date,
            Duty.date <= end_date,
        )
        .order_by(Duty.date, Duty.shift)
    )

    if current_user.role == RoleName.DEPOT_MANAGER.value:
        stmt = stmt.where(
            Duty.driver.has(
                User.depot_id == current_user.depot_id
            )
        )

    if depot_id:
        stmt = stmt.where(
            Duty.driver.has(
                User.depot_id == depot_id
            )
        )

    stmt = stmt.order_by(Duty.date, Duty.shift)

    result = await db.execute(stmt)
    duties = result.scalars().all()

    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "duties": [_duty_to_dict(d) for d in duties],
    }


# ── Double-Booking Prevention ────────────────────────────────────────────
async def _assert_no_conflict(
    db: AsyncSession,
    duty_date: date,
    shift: str,
    driver_id: UUID | None,
    vehicle_id: UUID | None,
    exclude_duty_id: UUID | None = None,
) -> None:
    """Raise 409 if driver or vehicle is already assigned for the same date+shift."""
    filters = [
        Duty.is_deleted == False,
        Duty.date == duty_date,
        Duty.shift == shift,
    ]
    if exclude_duty_id:
        filters.append(Duty.id != exclude_duty_id)

    if driver_id:
        driver_conflict = await db.execute(
            select(Duty).where(*filters, Duty.driver_id == driver_id).limit(1)
        )
        if driver_conflict.scalar_one_or_none():
            raise ConflictException(
                f"Driver is already assigned to another duty on {duty_date} ({shift} shift)."
            )

    if vehicle_id:
        vehicle_conflict = await db.execute(
            select(Duty).where(*filters, Duty.vehicle_id == vehicle_id).limit(1)
        )
        if vehicle_conflict.scalar_one_or_none():
            raise ConflictException(
                f"Vehicle is already assigned to another duty on {duty_date} ({shift} shift)."
            )


@router.post("", status_code=201)
async def create_duty(
    body: DutyCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.DUTY_ASSIGN))],
):
    """Create a duty assignment."""

    if current_user.role == RoleName.DEPOT_MANAGER.value:
        driver = await db.get(User, body.driver_id)
        vehicle = await db.get(Vehicle, body.vehicle_id)
        if not driver: 
            raise NotFoundException("Driver", body.driver_id) 
        if not vehicle: 
            raise NotFoundException("Vehicle", body.vehicle_id) 
        if driver.depot_id != current_user.depot_id: 
            raise ForbiddenException("Cannot assign duties to drivers from another depot") 
        if vehicle.depot_id != current_user.depot_id: 
            raise ForbiddenException("Cannot assign vehicles from another depot")
    
    # Prevent double-booking
    await _assert_no_conflict(db, body.date, body.shift, body.driver_id, body.vehicle_id)

    duty = Duty(
        date=body.date,
        shift=body.shift,
        vehicle_id=body.vehicle_id,
        driver_id=body.driver_id,
        conductor_id=body.conductor_id,
        route_id=body.route_id,
        start_time=time.fromisoformat(body.start_time) if body.start_time else None,
        end_time=time.fromisoformat(body.end_time) if body.end_time else None,
        remarks=body.remarks,
        created_by=str(current_user.id),
    )
    db.add(duty)
    await db.flush()
    return {"id": duty.id, "date": duty.date.isoformat(), "status": duty.status}


@router.post("/bulk-assign")
async def bulk_assign(
    body: BulkDutyAssign,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.DUTY_ASSIGN))],
):
    """Bulk create duty assignments."""
    created = []
    for assignment in body.assignments:
        driver = await db.get(User, assignment.driver_id) if assignment.driver_id else None
        vehicle = await db.get(Vehicle, assignment.vehicle_id) if assignment.vehicle_id else None

        if assignment.driver_id and not driver:
            raise NotFoundException("Driver", assignment.driver_id)
        if assignment.vehicle_id and not vehicle:
            raise NotFoundException("Vehicle", assignment.vehicle_id)

        if current_user.role == RoleName.DEPOT_MANAGER.value:
            if driver and driver.depot_id != current_user.depot_id:
                raise ForbiddenException("Cannot assign duties to drivers from another depot")
            if vehicle and vehicle.depot_id != current_user.depot_id:
                raise ForbiddenException("Cannot assign vehicles from another depot")

        # Prevent double-booking
        await _assert_no_conflict(
            db, assignment.date, assignment.shift,
            assignment.driver_id, assignment.vehicle_id,
        )

        duty = Duty(
            date=assignment.date,
            shift=assignment.shift,
            vehicle_id=assignment.vehicle_id,
            driver_id=assignment.driver_id,
            conductor_id=assignment.conductor_id,
            route_id=assignment.route_id,
            start_time=time.fromisoformat(assignment.start_time) if assignment.start_time else None,
            end_time=time.fromisoformat(assignment.end_time) if assignment.end_time else None,
            remarks=assignment.remarks,
            created_by=str(current_user.id),
        )
        db.add(duty)
        created.append(duty)

    await db.flush()
    return {"created": len(created), "message": f"{len(created)} duties created"}




@router.post("/{duty_id}/acknowledge")
async def acknowledge_duty(
    duty_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    """Driver acknowledges duty."""
    stmt = select(Duty).where(Duty.id == duty_id, Duty.is_deleted == False)
    result = await db.execute(stmt)
    duty = result.scalar_one_or_none()

    if not duty:
        raise NotFoundException("Duty", duty_id)
    if (
        duty.driver_id != current_user.id
        and duty.conductor_id != current_user.id
    ):
        raise NotFoundException("Duty", duty_id)

    duty.status = DutyStatus.ACKNOWLEDGED
    duty.acknowledged_at = datetime.now(timezone.utc)
    await db.flush()

    return {"message": "Duty acknowledged"}


@router.get("/conflicts")
async def check_conflicts(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.DUTY_VIEW))],
    target_date: date = Query(...),
):
    """Check for scheduling conflicts on a given date."""
    stmt = (
        select(Duty)
        .options(selectinload(Duty.driver), selectinload(Duty.vehicle))
        .where(Duty.is_deleted == False, Duty.date == target_date)
    )

    if current_user.role == RoleName.DEPOT_MANAGER.value:
        stmt = stmt.where(
            Duty.driver.has(
                User.depot_id == current_user.depot_id
            )
        )

    result = await db.execute(stmt)
    duties = result.scalars().all()

    conflicts = []
    # Check driver double-booking
    driver_duties: dict[UUID, list] = {}
    vehicle_duties: dict[UUID, list] = {}

    for duty in duties:
        if duty.driver_id:
            driver_duties.setdefault(duty.driver_id, []).append(duty)
        if duty.vehicle_id:
            vehicle_duties.setdefault(duty.vehicle_id, []).append(duty)

    for driver_id, dlist in driver_duties.items():
        if len(dlist) > 1:
            conflicts.append({
                "type": "DRIVER_DOUBLE_BOOKING",
                "driver_id": str(driver_id),
                "driver_name": dlist[0].driver.full_name if dlist[0].driver else "Unknown",
                "duty_count": len(dlist),
                "duties": [str(d.id) for d in dlist],
            })

    for vehicle_id, vlist in vehicle_duties.items():
        if len(vlist) > 1:
            shifts = [d.shift for d in vlist]
            if len(shifts) != len(set(shifts)):
                conflicts.append({
                    "type": "VEHICLE_DOUBLE_BOOKING",
                    "vehicle_id": str(vehicle_id),
                    "duty_count": len(vlist),
                    "duties": [str(d.id) for d in vlist],
                })

    return {"date": target_date.isoformat(), "conflicts": conflicts, "total": len(conflicts)}


@router.post("/publish")
async def publish_roster(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.DUTY_PUBLISH))],
    roster_date: date = Query(..., description="Date to publish duties for"),
):
    """Publish all DRAFT duties for a given date (DRAFT → PUBLISHED)."""
    from app.models import Notification, NotificationType

    stmt = (
        select(Duty)
        .options(selectinload(Duty.driver), selectinload(Duty.conductor))
        .where(
            Duty.date == roster_date,
            Duty.status == DutyStatus.DRAFT,
            Duty.is_deleted == False,
        )
    )
    result = await db.execute(stmt)
    duties = result.scalars().all()

    if not duties:
        raise BadRequestException(f"No DRAFT duties found for {roster_date.isoformat()}")

    published = 0
    for duty in duties:
        duty.status = DutyStatus.PUBLISHED

        # Notify assigned driver
        if duty.driver_id:
            db.add(Notification(
                user_id=duty.driver_id,
                notification_type=NotificationType.DUTY_PUBLISHED,
                title=f"Duty Published — {roster_date.isoformat()}",
                message=f"Your duty for {roster_date.isoformat()} ({duty.shift}) has been published.",
                link="/duties",
            ))

        # Notify assigned conductor
        if duty.conductor_id:
            db.add(Notification(
                user_id=duty.conductor_id,
                notification_type=NotificationType.DUTY_PUBLISHED,
                title=f"Duty Published — {roster_date.isoformat()}",
                message=f"Your duty for {roster_date.isoformat()} ({duty.shift}) has been published.",
                link="/duties",
            ))

        published += 1

    await db.flush()
    return {"message": f"Published {published} duties for {roster_date.isoformat()}", "published": published}


def _duty_to_dict(d: Duty) -> dict:
    return {
        "id": str(d.id),
        "date": d.date.isoformat(),
        "shift": d.shift if isinstance(d.shift, str) else d.shift.value,
        "status": d.status if isinstance(d.status, str) else d.status.value,
        "start_time": d.start_time.isoformat() if d.start_time else None,
        "end_time": d.end_time.isoformat() if d.end_time else None,
        "vehicle_id": str(d.vehicle_id) if d.vehicle_id else None,
        "vehicle_reg": d.vehicle.registration_no if d.vehicle else None,
        "driver_id": str(d.driver_id) if d.driver_id else None,
        "driver_name": d.driver.full_name if d.driver else None,
        "conductor_id": str(d.conductor_id) if d.conductor_id else None,
        "conductor_name": d.conductor.full_name if d.conductor else None,
        "route_id": str(d.route_id) if d.route_id else None,
        "route_name": d.route.name if d.route else None,
        "route_code": d.route.code if d.route else None,
        "remarks": d.remarks,
        "acknowledged_at": d.acknowledged_at.isoformat() if d.acknowledged_at else None,
    }
