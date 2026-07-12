"""
Leave Management — Request, approve, reject, cancel leave requests.
"""

from typing import Annotated, Optional
from uuid import UUID
from datetime import datetime, timezone, date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

# pyrefly: ignore [missing-import]
from app.core.exceptions import NotFoundException
# pyrefly: ignore [missing-import]
from app.core.database import get_db
# pyrefly: ignore [missing-import]
from app.core.dependencies import CurrentUser, get_current_user, require_permission
# pyrefly: ignore [missing-import]
from app.core.permissions import Permission,RoleName
# pyrefly: ignore [missing-import]
from app.models import LeaveRequest, LeaveStatus, AuditLog, Notification, NotificationType, User

router = APIRouter()


class LeaveRequestCreate(BaseModel):
    start_date: date
    end_date: date
    reason: str
    leave_type: str = "casual"  # casual, sick, emergency, planned


class LeaveApproveReject(BaseModel):
    rejection_reason: Optional[str] = None


@router.get("")
async def list_leave_requests(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    status: Optional[str] = None,
    user_id: Optional[UUID] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
):
    """List leave requests. Drivers/Conductors see own; Depot Managers see depot; Admin sees all."""
    stmt = select(LeaveRequest).where(LeaveRequest.is_deleted == False)

    # RBAC filtering
    if current_user.role in ["DRIVER", "CONDUCTOR"]:
        stmt = stmt.where(LeaveRequest.user_id == current_user.id)
    elif current_user.role == "DEPOT_MANAGER" and current_user.depot_id:
        user_ids_stmt = select(User.id).where(User.depot_id == current_user.depot_id, User.is_deleted == False)
        stmt = stmt.where(LeaveRequest.user_id.in_(user_ids_stmt))
    elif user_id:
        stmt = stmt.where(LeaveRequest.user_id == user_id)

    if status:
        stmt = stmt.where(LeaveRequest.status == status)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    stmt = stmt.order_by(LeaveRequest.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    leaves = result.scalars().all()

    return {
        "items": [
            {
                "id": str(leave.id),
                "user_id": str(leave.user_id),
                "start_date": leave.start_date.isoformat(),
                "end_date": leave.end_date.isoformat(),
                "reason": leave.reason,
                "leave_type": leave.leave_type,
                "status": leave.status if isinstance(leave.status, str) else leave.status.value,
                "approved_by": str(leave.approved_by) if leave.approved_by else None,
                "approved_at": leave.approved_at.isoformat() if leave.approved_at else None,
                "rejection_reason": leave.rejection_reason,
                "created_at": leave.created_at.isoformat(),
            }
            for leave in leaves
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("")
async def create_leave_request(
    body: LeaveRequestCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    """Create a new leave request (any authenticated user)."""
    leave = LeaveRequest(
        user_id=current_user.id,
        start_date=body.start_date,
        end_date=body.end_date,
        reason=body.reason,
        leave_type=body.leave_type,
        status=LeaveStatus.PENDING,
    )
    db.add(leave)

    # Audit log
    db.add(AuditLog(
        user_id=current_user.id,
        action="CREATE",
        resource_type="leave_request",
        details={"start": str(body.start_date), "end": str(body.end_date), "type": body.leave_type},
    ))

    await db.flush()
    return {"id": str(leave.id), "message": "Leave request submitted"}


@router.post("/{leave_id}/approve")
async def approve_leave(
    leave_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.LEAVE_APPROVE))],
):
    """Approve a pending leave request."""
    leave = await db.execute(
        select(LeaveRequest).where(LeaveRequest.id == leave_id, LeaveRequest.is_deleted == False)
    )
    leave = leave.scalar_one_or_none()
    if not leave:
        raise NotFoundException("LeaveRequest", leave_id)

    if current_user.role == RoleName.DEPOT_MANAGER.value:
        user = await db.get(User, leave.user_id)
        if (
            user
            and user.depot_id != current_user.depot_id
        ):
            raise NotFoundException(
                "LeaveRequest",
                leave_id
            )

    leave.status = LeaveStatus.APPROVED
    leave.approved_by = current_user.id
    leave.approved_at = datetime.now(timezone.utc)

    # Notify the requesting user
    db.add(Notification(
        user_id=leave.user_id,
        notification_type=NotificationType.LEAVE_STATUS,
        title="Leave Request Approved",
        message=f"Your leave from {leave.start_date} to {leave.end_date} has been approved.",
        link="/leaves",
    ))

    # Audit log
    db.add(AuditLog(
        user_id=current_user.id,
        action="APPROVE",
        resource_type="leave_request",
        resource_id=str(leave_id),
    ))

    await db.flush()
    return {"message": "Leave request approved"}


@router.post("/{leave_id}/reject")
async def reject_leave(
    leave_id: UUID,
    body: LeaveApproveReject,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.LEAVE_APPROVE))],
):
    """Reject a pending leave request."""
    leave = await db.execute(
        select(LeaveRequest).where(LeaveRequest.id == leave_id, LeaveRequest.is_deleted == False)
    )
    leave = leave.scalar_one_or_none()
    if not leave:
        raise NotFoundException("LeaveRequest", leave_id)

    if current_user.role == RoleName.DEPOT_MANAGER.value:
        user = await db.get(User, leave.user_id)
        if (
            user
            and user.depot_id != current_user.depot_id
        ):
            raise NotFoundException(
                "LeaveRequest",
                leave_id
            )

    leave.status = LeaveStatus.REJECTED
    leave.approved_by = current_user.id
    leave.approved_at = datetime.now(timezone.utc)
    leave.rejection_reason = body.rejection_reason

    # Notify
    db.add(Notification(
        user_id=leave.user_id,
        notification_type=NotificationType.LEAVE_STATUS,
        title="Leave Request Rejected",
        message=f"Your leave from {leave.start_date} to {leave.end_date} was rejected. Reason: {body.rejection_reason or 'Not specified'}",
        link="/leaves",
    ))

    db.add(AuditLog(
        user_id=current_user.id,
        action="REJECT",
        resource_type="leave_request",
        resource_id=str(leave_id),
    ))

    await db.flush()
    return {"message": "Leave request rejected"}


@router.post("/{leave_id}/cancel")
async def cancel_leave(
    leave_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    """Cancel own leave request."""
    leave = await db.execute(
        select(LeaveRequest).where(
            LeaveRequest.id == leave_id,
            LeaveRequest.user_id == current_user.id,
            LeaveRequest.is_deleted == False,
        )
    )
    leave = leave.scalar_one_or_none()
    if not leave:
        raise NotFoundException("LeaveRequest", leave_id)

    leave.status = LeaveStatus.CANCELLED
    db.add(AuditLog(
        user_id=current_user.id,
        action="CANCEL",
        resource_type="leave_request",
        resource_id=str(leave_id),
    ))
    await db.flush()
    return {"message": "Leave request cancelled"}
