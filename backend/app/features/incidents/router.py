"""
Incidents feature — Full lifecycle management with SLA monitoring.
"""

from typing import Annotated, Optional
from uuid import UUID
from datetime import datetime, timezone, timedelta
import uuid as uuid_module

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.core.database import get_db
from app.core.dependencies import CurrentUser, require_permission, get_current_user
from app.core.exceptions import BadRequestException, NotFoundException
from app.core.permissions import Permission, RoleName
from app.models import Incident, IncidentEvent, IncidentStatus, User

router = APIRouter()

# SLA hours by severity
SLA_HOURS = {"P1": 1, "P2": 4, "P3": 24}


class IncidentCreate(BaseModel):
    incident_type: str
    severity: str = "P3"
    title: str
    description: Optional[str] = None
    vehicle_id: Optional[UUID] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_description: Optional[str] = None


class IncidentUpdateStatus(BaseModel):
    status: str
    notes: Optional[str] = None


class AddEventRequest(BaseModel):
    event_type: str
    description: str


class AssignRequest(BaseModel):
    assigned_to: UUID


# Valid state transitions
VALID_TRANSITIONS: dict[str, list[str]] = {
    "OPEN": ["ACKNOWLEDGED"],
    "ACKNOWLEDGED": ["ASSIGNED", "IN_PROGRESS"],
    "ASSIGNED": ["IN_PROGRESS"],
    "IN_PROGRESS": ["RESOLVED"],
    "RESOLVED": ["CLOSED"],
    "CLOSED": [],
}


def _validate_transition(current: str, target: str) -> None:
    """Validate that a status transition is allowed."""
    current_str = current if isinstance(current, str) else current.value
    allowed = VALID_TRANSITIONS.get(current_str, [])
    if target not in allowed:
        raise BadRequestException(
            f"Cannot transition from {current_str} to {target}. "
            f"Allowed transitions: {', '.join(allowed) if allowed else 'none'}"
        )


@router.get("")
async def list_incidents(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.INCIDENT_VIEW))],
    status: Optional[str] = None,
    severity: Optional[str] = None,
    incident_type: Optional[str] = None,
    vehicle_id: Optional[UUID] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """List incidents with filters."""
    stmt = (
        select(Incident)
        .options(
            selectinload(Incident.vehicle),
            selectinload(Incident.reported_by_user),
            selectinload(Incident.assigned_to_user),
        )
        .where(Incident.is_deleted == False)
    )

    if current_user.role == RoleName.DEPOT_MANAGER.value:
        stmt = stmt.where(
            Incident.reported_by_user.has(
                User.depot_id == current_user.depot_id
            )
        )

    elif current_user.role in [
        RoleName.DRIVER.value,
        RoleName.CONDUCTOR.value,
    ]:
        stmt = stmt.where(
            Incident.reported_by == current_user.id
        )

    if status:
        stmt = stmt.where(Incident.status == status)
    if severity:
        stmt = stmt.where(Incident.severity == severity)
    if incident_type:
        stmt = stmt.where(Incident.incident_type == incident_type)
    if vehicle_id:
        stmt = stmt.where(Incident.vehicle_id == vehicle_id)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    stmt = stmt.offset((page - 1) * page_size).limit(page_size).order_by(Incident.created_at.desc())
    result = await db.execute(stmt)
    incidents = result.scalars().all()

    return {
        "items": [_incident_to_dict(i) for i in incidents],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/sla-status")
async def sla_dashboard(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.INCIDENT_VIEW))],
):
    """SLA monitoring dashboard."""
    now = datetime.now(timezone.utc)
    stmt = (
        select(Incident)
        .options(
            selectinload(Incident.reported_by_user)
        )
        .where(
            Incident.is_deleted == False,
            Incident.status.in_(
                ["OPEN", "ACKNOWLEDGED", "ASSIGNED", "IN_PROGRESS"]
            ),
        )
    )

    if current_user.role == RoleName.DEPOT_MANAGER.value:
        stmt = stmt.where(
            Incident.reported_by_user.has(
                User.depot_id == current_user.depot_id
            )
        )

    result = await db.execute(stmt)
    incidents = result.scalars().all()

    breached = []
    at_risk = []
    on_track = []

    for inc in incidents:
        if inc.sla_deadline:
            if now > inc.sla_deadline:
                breached.append(_incident_to_dict(inc))
            elif (inc.sla_deadline - now).total_seconds() < 1800:  # 30 min
                at_risk.append(_incident_to_dict(inc))
            else:
                on_track.append(_incident_to_dict(inc))

    return {
        "breached": {"count": len(breached), "items": breached},
        "at_risk": {"count": len(at_risk), "items": at_risk},
        "on_track": {"count": len(on_track), "items": on_track},
    }


@router.get("/{incident_id}")
async def get_incident(
    incident_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.INCIDENT_VIEW))],
):
    """Get incident with timeline."""
    stmt = (
        select(Incident)
        .options(
            selectinload(Incident.vehicle),
            selectinload(Incident.reported_by_user),
            selectinload(Incident.assigned_to_user),
            selectinload(Incident.events),
        )
        .where(Incident.id == incident_id, Incident.is_deleted == False)
    )
    result = await db.execute(stmt)
    incident = result.scalar_one_or_none()

    if not incident:
        raise NotFoundException("Incident", incident_id)

    if (
        current_user.role == RoleName.DEPOT_MANAGER.value
        and incident.reported_by_user
        and incident.reported_by_user.depot_id != current_user.depot_id
    ):
        raise NotFoundException("Incident", incident_id)

    if current_user.role in [
        RoleName.DRIVER.value,
        RoleName.CONDUCTOR.value,
    ]:
        if incident.reported_by != current_user.id:
            raise NotFoundException("Incident", incident_id)

    data = _incident_to_dict(incident)
    data["events"] = [
        {
            "id": str(e.id),
            "event_type": e.event_type,
            "description": e.description,
            "created_by": str(e.created_by) if e.created_by else None,
            "created_at": e.created_at.isoformat(),
        }
        for e in sorted(incident.events, key=lambda x: x.created_at)
    ]
    return data


@router.post("", status_code=201)
async def create_incident(
    body: IncidentCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.INCIDENT_CREATE))],
):
    """Create a new incident."""
    now = datetime.now(timezone.utc)
    severity = body.severity
    sla_hours = SLA_HOURS.get(severity, 24)
    sla_deadline = now + timedelta(hours=sla_hours)

    incident_no = f"INC-{now.strftime('%Y%m%d')}-{uuid_module.uuid4().hex[:6].upper()}"

    incident = Incident(
        incident_no=incident_no,
        incident_type=body.incident_type,
        severity=severity,
        title=body.title,
        description=body.description,
        vehicle_id=body.vehicle_id,
        latitude=body.latitude,
        longitude=body.longitude,
        location_description=body.location_description,
        reported_by=current_user.id,
        sla_deadline=sla_deadline,
        created_by=str(current_user.id),
    )
    db.add(incident)
    await db.flush()

    # Create initial event
    event = IncidentEvent(
        incident_id=incident.id,
        event_type="created",
        description=f"Incident created: {body.title}",
        created_by=current_user.id,
    )
    db.add(event)
    await db.flush()

    return {"id": incident.id, "incident_no": incident.incident_no}


@router.post("/panic", status_code=201)
async def panic_button(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
):
    """Panic button — creates P1 incident immediately."""
    now = datetime.now(timezone.utc)
    incident_no = f"INC-{now.strftime('%Y%m%d')}-{uuid_module.uuid4().hex[:6].upper()}"

    incident = Incident(
        incident_no=incident_no,
        incident_type="SECURITY",
        severity="P1",
        title="🚨 PANIC ALERT — Emergency reported",
        description="Panic button pressed by user. Immediate attention required.",
        latitude=latitude,
        longitude=longitude,
        reported_by=current_user.id,
        sla_deadline=now + timedelta(hours=1),
        created_by=str(current_user.id),
    )
    db.add(incident)
    await db.flush()

    event = IncidentEvent(
        incident_id=incident.id,
        event_type="panic",
        description="Panic button activated",
        created_by=current_user.id,
    )
    db.add(event)
    await db.flush()

    return {"id": incident.id, "incident_no": incident.incident_no, "severity": "P1"}


@router.post("/{incident_id}/acknowledge")
async def acknowledge_incident(
    incident_id: UUID,
    body: IncidentUpdateStatus,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.INCIDENT_VIEW))],
):
    """Acknowledge an incident. Notes are required for audit trail."""
    if not body.notes:
        raise BadRequestException("Notes are required when acknowledging an incident.")
    stmt = (
        select(Incident)
        .options(selectinload(Incident.reported_by_user))
        .where(Incident.id == incident_id, Incident.is_deleted == False)
    )
    result = await db.execute(stmt)
    incident = result.scalar_one_or_none()

    if not incident:
        raise NotFoundException("Incident", incident_id)

    _validate_transition(incident.status, "ACKNOWLEDGED")

    now = datetime.now(timezone.utc)
    incident.status = IncidentStatus.ACKNOWLEDGED
    incident.acknowledged_at = now

    event = IncidentEvent(
        incident_id=incident.id,
        event_type="acknowledged",
        description=body.notes or "Incident acknowledged",
        created_by=current_user.id,
    )
    db.add(event)
    await db.flush()

    return {"message": "Incident acknowledged"}


@router.post("/{incident_id}/assign")
async def assign_incident(
    incident_id: UUID,
    body: AssignRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.INCIDENT_ASSIGN))],
):
    """Assign incident to a handler."""
    stmt = (
        select(Incident)
        .options(selectinload(Incident.reported_by_user))
        .where(
            Incident.id == incident_id,
            Incident.is_deleted == False
        )
    )
    result = await db.execute(stmt)
    incident = result.scalar_one_or_none()

    if not incident:
        raise NotFoundException("Incident", incident_id)
    if (
        current_user.role == RoleName.DEPOT_MANAGER.value
        and incident.reported_by_user
        and incident.reported_by_user.depot_id != current_user.depot_id
    ):
        raise NotFoundException("Incident", incident_id)

    # Allow assign from ACKNOWLEDGED or OPEN
    current_str = incident.status if isinstance(incident.status, str) else incident.status.value
    if current_str not in ["OPEN", "ACKNOWLEDGED"]:
        raise BadRequestException(
            f"Cannot assign incident in status {current_str}. Must be OPEN or ACKNOWLEDGED."
        )

    incident.assigned_to = body.assigned_to
    incident.status = IncidentStatus.ASSIGNED
    if not incident.acknowledged_at:
        incident.acknowledged_at = datetime.now(timezone.utc)

    event = IncidentEvent(
        incident_id=incident.id,
        event_type="assigned",
        description="Incident assigned",
        created_by=current_user.id,
    )
    db.add(event)
    await db.flush()

    return {"message": "Incident assigned"}


@router.post("/{incident_id}/in-progress")
async def start_incident(
    incident_id: UUID,
    body: IncidentUpdateStatus,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.INCIDENT_VIEW))],
):
    """Mark incident as in-progress. Notes are required for audit trail."""
    if not body.notes:
        raise BadRequestException("Notes are required when starting work on an incident.")
    stmt = (
        select(Incident)
        .options(selectinload(Incident.reported_by_user))
        .where(Incident.id == incident_id, Incident.is_deleted == False)
    )
    result = await db.execute(stmt)
    incident = result.scalar_one_or_none()

    if not incident:
        raise NotFoundException("Incident", incident_id)

    _validate_transition(incident.status, "IN_PROGRESS")

    incident.status = IncidentStatus.IN_PROGRESS

    event = IncidentEvent(
        incident_id=incident.id,
        event_type="in_progress",
        description=body.notes or "Work started on incident",
        created_by=current_user.id,
    )
    db.add(event)
    await db.flush()

    return {"message": "Incident marked as in-progress"}


@router.post("/{incident_id}/resolve")
async def resolve_incident(
    incident_id: UUID,
    body: IncidentUpdateStatus,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.INCIDENT_RESOLVE))],
):
    """Resolve an incident."""
    if not body.notes:
        raise BadRequestException("Resolution notes are required to resolve an incident.")

    stmt = (
        select(Incident)
        .options(selectinload(Incident.reported_by_user))
        .where(
            Incident.id == incident_id,
            Incident.is_deleted == False
        )
    )
    result = await db.execute(stmt)
    incident = result.scalar_one_or_none()

    if not incident:
        raise NotFoundException("Incident", incident_id)

    if (
        current_user.role == RoleName.DEPOT_MANAGER.value
        and incident.reported_by_user
        and incident.reported_by_user.depot_id != current_user.depot_id
    ):
        raise NotFoundException("Incident", incident_id)

    _validate_transition(incident.status, "RESOLVED")

    now = datetime.now(timezone.utc)
    incident.status = IncidentStatus.RESOLVED
    incident.resolved_at = now
    incident.resolution_notes = body.notes
    if incident.sla_deadline and now > incident.sla_deadline:
        incident.sla_breached = True

    event = IncidentEvent(
        incident_id=incident.id,
        event_type="resolved",
        description=body.notes or "Incident resolved",
        created_by=current_user.id,
    )
    db.add(event)
    await db.flush()

    return {"message": "Incident resolved"}


@router.post("/{incident_id}/close")
async def close_incident(
    incident_id: UUID,
    body: IncidentUpdateStatus,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.INCIDENT_RESOLVE))],
):
    """Close a resolved incident. Notes are required for audit trail."""
    if not body.notes:
        raise BadRequestException("Notes are required when closing an incident.")
    stmt = (
        select(Incident)
        .options(selectinload(Incident.reported_by_user))
        .where(Incident.id == incident_id, Incident.is_deleted == False)
    )
    result = await db.execute(stmt)
    incident = result.scalar_one_or_none()

    if not incident:
        raise NotFoundException("Incident", incident_id)

    _validate_transition(incident.status, "CLOSED")

    incident.status = IncidentStatus.CLOSED
    incident.closed_at = datetime.now(timezone.utc)

    event = IncidentEvent(
        incident_id=incident.id,
        event_type="closed",
        description=body.notes or "Incident closed",
        created_by=current_user.id,
    )
    db.add(event)
    await db.flush()

    return {"message": "Incident closed"}


@router.post("/{incident_id}/events")
async def add_event(
    incident_id: UUID,
    body: AddEventRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.INCIDENT_VIEW))],
):
    """Add a timeline event to an incident."""


    stmt = (
        select(Incident)
        .options(selectinload(Incident.reported_by_user))
        .where(
            Incident.id == incident_id,
            Incident.is_deleted == False
        )
    )

    result = await db.execute(stmt)
    incident = result.scalar_one_or_none()
    if not incident:
        raise NotFoundException("Incident", incident_id)

    if (
        current_user.role == RoleName.DEPOT_MANAGER.value
        and incident.reported_by_user
        and incident.reported_by_user.depot_id != current_user.depot_id
    ):
        raise NotFoundException("Incident", incident_id)

    if current_user.role in [
        RoleName.DRIVER.value,
        RoleName.CONDUCTOR.value,
    ]:
        if incident.reported_by != current_user.id:
            raise NotFoundException("Incident", incident_id)

    event = IncidentEvent(
        incident_id=incident_id,
        event_type=body.event_type,
        description=body.description,
        created_by=current_user.id,
    )

    db.add(event)
    await db.flush()
    return {"id": event.id, "event_type": event.event_type}


def _incident_to_dict(i: Incident) -> dict:
    now = datetime.now(timezone.utc)
    sla_remaining = None
    # Computed-on-read SLA breach: even if the background sweeper hasn't
    # persisted the breach yet, the API response should be accurate.
    sla_breached = i.sla_breached
    status_str = i.status if isinstance(i.status, str) else i.status.value
    if i.sla_deadline and status_str not in ["RESOLVED", "CLOSED"]:
        remaining = (i.sla_deadline - now).total_seconds()
        sla_remaining = max(0, round(remaining / 60))  # minutes remaining
        if remaining < 0:
            sla_breached = True

    return {
        "id": str(i.id),
        "incident_no": i.incident_no,
        "incident_type": i.incident_type if isinstance(i.incident_type, str) else i.incident_type.value,
        "severity": i.severity if isinstance(i.severity, str) else i.severity.value,
        "status": i.status if isinstance(i.status, str) else i.status.value,
        "title": i.title,
        "description": i.description,
        "latitude": i.latitude,
        "longitude": i.longitude,
        "location_description": i.location_description,
        "vehicle_id": str(i.vehicle_id) if i.vehicle_id else None,
        "vehicle_reg": i.vehicle.registration_no if i.vehicle else None,
        "reported_by": str(i.reported_by),
        "reported_by_name": i.reported_by_user.full_name if i.reported_by_user else None,
        "assigned_to": str(i.assigned_to) if i.assigned_to else None,
        "assigned_to_name": i.assigned_to_user.full_name if i.assigned_to_user else None,
        "sla_deadline": i.sla_deadline.isoformat() if i.sla_deadline else None,
        "sla_remaining_mins": sla_remaining,
        "sla_breached": sla_breached,
        "resolved_at": i.resolved_at.isoformat() if i.resolved_at else None,
        "created_at": i.created_at.isoformat(),
    }
