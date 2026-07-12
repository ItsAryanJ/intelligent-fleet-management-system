"""
Notifications feature — In-app notification center.
"""

from typing import Annotated, Optional
from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, status, WebSocket, WebSocketDisconnect
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import verify_access_token
from app.core.database import get_db
from app.core.dependencies import CurrentUser, get_current_user
from app.models import Notification
from app.core.websocket import notification_manager

router = APIRouter()


@router.get("")
async def list_notifications(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    is_read: Optional[bool] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
):
    """List user notifications."""
    stmt = select(Notification).where(
        Notification.user_id == current_user.id,
        Notification.is_deleted == False,
    )
    if is_read is not None:
        stmt = stmt.where(Notification.is_read == is_read)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    unread_stmt = select(func.count()).select_from(
        select(Notification).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
            Notification.is_deleted == False,
        ).subquery()
    )
    unread_count = (await db.execute(unread_stmt)).scalar() or 0

    stmt = stmt.offset((page - 1) * page_size).limit(page_size).order_by(Notification.created_at.desc())
    result = await db.execute(stmt)
    notifications = result.scalars().all()

    return {
        "items": [
            {
                "id": str(n.id),
                "type": n.notification_type if isinstance(n.notification_type, str) else n.notification_type.value,
                "title": n.title,
                "message": n.message,
                "is_read": n.is_read,
                "link": n.link,
                "created_at": n.created_at.isoformat(),
            }
            for n in notifications
        ],
        "total": total,
        "unread_count": unread_count,
        "page": page,
        "page_size": page_size,
    }


@router.post("/{notification_id}/read")
async def mark_read(
    notification_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    """Mark notification as read."""
    stmt = select(Notification).where(
        Notification.id == notification_id,
        Notification.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    notification = result.scalar_one_or_none()
    if notification:
        notification.is_read = True
        notification.read_at = datetime.now(timezone.utc)
        await db.flush()
    return {"message": "Marked as read"}


@router.post("/read-all")
async def mark_all_read(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    """Mark all notifications as read."""
    stmt = (
        update(Notification)
        .where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
        .values(is_read=True, read_at=datetime.now(timezone.utc))
    )
    await db.execute(stmt)
    await db.flush()
    return {"message": "All notifications marked as read"}


@router.get("/unread-count")
async def unread_count(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    """Get count of unread notifications for the current user."""
    stmt = select(func.count()).select_from(
        select(Notification).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
            Notification.is_deleted == False,
        ).subquery()
    )
    count = (await db.execute(stmt)).scalar() or 0
    return {"count": count}


# ── WebSocket real-time notifications ────────────────────────────────────



@router.websocket("/ws")
async def websocket_notifications(websocket: WebSocket):
    """
    WebSocket endpoint for real-time notification delivery.
    Client connects with ?token=<jwt> for user identification.
    Events pushed: DUTY_ASSIGNED, INCIDENT_ASSIGNED, NOTICE_PUBLISHED,
    LEAVE_APPROVED, LEAVE_REJECTED, GEOFENCE_BREACH, ROUTE_DEVIATION.
    """
    token = websocket.query_params.get("token")

    if not token:
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION
        )
        return

    try:
        payload = verify_access_token(token)
    except Exception:
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION
        )
        return

    user_id = payload.get("sub")

    if not user_id:
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION
        )
        return

    await notification_manager.connect(
        websocket,
        metadata={"user_id": user_id},
    )

    try:
        while True:
            # Keep alive — receive heartbeat pings from client
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        notification_manager.disconnect(websocket)
