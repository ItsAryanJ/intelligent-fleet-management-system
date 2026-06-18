"""
Audit feature — System audit log and activity feed.
"""

from typing import Annotated, Optional
from uuid import UUID
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser, require_permission
from app.core.permissions import Permission
from app.models import AuditLog

router = APIRouter()


@router.get("")
async def list_audit_logs(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.AUDIT_VIEW))],
    user_id: Optional[UUID] = None,
    resource_type: Optional[str] = None,
    action: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    """List audit log entries."""
    stmt = select(AuditLog)

    if user_id:
        stmt = stmt.where(AuditLog.user_id == user_id)
    if resource_type:
        stmt = stmt.where(AuditLog.resource_type == resource_type)
    if action:
        stmt = stmt.where(AuditLog.action == action)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    stmt = stmt.offset((page - 1) * page_size).limit(page_size).order_by(AuditLog.created_at.desc())
    result = await db.execute(stmt)
    logs = result.scalars().all()

    return {
        "items": [
            {
                "id": str(l.id),
                "user_id": str(l.user_id) if l.user_id else None,
                "action": l.action,
                "resource_type": l.resource_type,
                "resource_id": l.resource_id,
                "details": l.details,
                "ip_address": l.ip_address,
                "created_at": l.created_at.isoformat(),
            }
            for l in logs
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/timeline")
async def activity_timeline(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.AUDIT_VIEW))],
    hours: int = Query(24, ge=1, le=168),
):
    """Get activity timeline for the last N hours."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)

    stmt = (
        select(AuditLog)
        .where(AuditLog.created_at >= cutoff)
        .order_by(AuditLog.created_at.desc())
        .limit(200)
    )
    result = await db.execute(stmt)
    logs = result.scalars().all()

    return {
        "period_hours": hours,
        "total": len(logs),
        "events": [
            {
                "id": str(l.id),
                "action": l.action,
                "resource_type": l.resource_type,
                "resource_id": l.resource_id,
                "details": l.details,
                "created_at": l.created_at.isoformat(),
            }
            for l in logs
        ],
    }
