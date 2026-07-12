"""
Notices/CMS feature — Create, publish, target, and track notices.
"""

from typing import Annotated, Optional
from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.database import get_db
from app.core.dependencies import CurrentUser, require_permission, get_current_user
from app.core.exceptions import NotFoundException
from app.core.permissions import Permission
from app.models import Notice, NoticeRead

router = APIRouter()

def _can_view_notice(
    notice: Notice,
    current_user: CurrentUser,
) -> bool:

    if notice.target_type == "ALL":
        return True

    if notice.target_type == "ROLE":
        return (
            notice.target_roles
            and current_user.role in notice.target_roles
        )

    if notice.target_type == "DEPOT":
        return (
            notice.target_depot_ids
            and str(current_user.depot_id)
            in notice.target_depot_ids
        )

    if notice.target_type == "USER":
        return (
            notice.target_user_ids
            and str(current_user.id)
            in notice.target_user_ids
        )

    return False

class NoticeCreate(BaseModel):
    title: str
    content: str
    content_type: str = "markdown"
    summary: Optional[str] = None
    priority: str = "NORMAL"
    target_type: str = "ALL"
    target_roles: Optional[list[str]] = None
    target_depot_ids: Optional[list[str]] = None
    target_user_ids: Optional[list[str]] = None
    language: str = "en"


class NoticeUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    priority: Optional[str] = None
    target_type: Optional[str] = None
    target_roles: Optional[list[str]] = None


@router.get("")
async def list_notices(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.NOTICE_PUBLISH))],
    is_published: Optional[bool] = None,
    priority: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """List notices."""
    stmt = select(Notice).where(Notice.is_deleted == False)
    if is_published is not None:
        stmt = stmt.where(Notice.is_published == is_published)
    if priority:
        stmt = stmt.where(Notice.priority == priority)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    stmt = stmt.offset((page - 1) * page_size).limit(page_size).order_by(Notice.created_at.desc())
    result = await db.execute(stmt)
    notices = result.scalars().all()

    return {
        "items": [_notice_to_dict(n) for n in notices],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/feed")
async def notice_feed(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    """Get notices targeted to the current user."""
    stmt = (
        select(Notice)
        .where(
            Notice.is_deleted == False,
            Notice.is_published == True,
        )
        .order_by(Notice.published_at.desc())
        .limit(50)
    )
    result = await db.execute(stmt)
    notices = result.scalars().all()

    # Check read status for each
    feed = []

    for notice in notices:

        read_stmt = select(NoticeRead).where(
            NoticeRead.notice_id == notice.id,
            NoticeRead.user_id == current_user.id,
        )
        read_result = await db.execute(read_stmt)
        read_record = read_result.scalar_one_or_none()

        data = _notice_to_dict(notice)
        data["is_read"] = read_record is not None
        data["read_at"] = read_record.read_at.isoformat() if read_record else None
        data["acknowledged_at"] = read_record.acknowledged_at.isoformat() if read_record and read_record.acknowledged_at else None

        if not _can_view_notice(notice, current_user):
            continue

        feed.append(data)

    return feed


@router.get("/{notice_id}")
async def get_notice(
    notice_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    """Get a single notice."""
    stmt = select(Notice).where(Notice.id == notice_id, Notice.is_deleted == False)
    result = await db.execute(stmt)
    notice = result.scalar_one_or_none()

    if not notice:
        raise NotFoundException("Notice", notice_id)

    if not _can_view_notice(notice, current_user):
        raise NotFoundException("Notice", notice_id)
    if (
        not notice.is_published
        and not current_user.has_permission(
            Permission.NOTICE_PUBLISH
        )
    ):
        raise NotFoundException("Notice", notice_id)

    # Get read stats
    read_count_stmt = select(func.count()).select_from(
        select(NoticeRead).where(NoticeRead.notice_id == notice_id).subquery()
    )
    read_count = (await db.execute(read_count_stmt)).scalar() or 0

    data = _notice_to_dict(notice)
    data["read_count"] = read_count
    return data


@router.post("", status_code=201)
async def create_notice(
    body: NoticeCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.NOTICE_PUBLISH))],
):
    """Create a new notice."""
    notice = Notice(
        title=body.title,
        content=body.content,
        content_type=body.content_type,
        summary=body.summary,
        priority=body.priority,
        target_type=body.target_type,
        target_roles=body.target_roles,
        target_depot_ids=body.target_depot_ids,
        target_user_ids=body.target_user_ids,
        language=body.language,
        published_by=current_user.id,
        created_by=str(current_user.id),
    )
    db.add(notice)
    await db.flush()
    return {"id": notice.id, "title": notice.title}


@router.post("/{notice_id}/publish")
async def publish_notice(
    notice_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.NOTICE_PUBLISH))],
):
    """Publish a notice."""
    stmt = select(Notice).where(Notice.id == notice_id, Notice.is_deleted == False)
    result = await db.execute(stmt)
    notice = result.scalar_one_or_none()

    if not notice:
        raise NotFoundException("Notice", notice_id)

    notice.is_published = True
    notice.published_at = datetime.now(timezone.utc)
    notice.published_by = current_user.id
    await db.flush()

    return {"message": "Notice published"}


@router.post("/{notice_id}/read")
async def mark_read(
    notice_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    """Mark notice as read."""
    notice = await db.get(Notice, notice_id)

    if not notice:
        raise NotFoundException("Notice", notice_id)

    if not _can_view_notice(notice, current_user):
        raise NotFoundException("Notice", notice_id)

    if (
        not notice.is_published
        and not current_user.has_permission(
            Permission.NOTICE_PUBLISH
        )
    ):
        raise NotFoundException("Notice", notice_id)

    existing = await db.execute(
        select(NoticeRead).where(
            NoticeRead.notice_id == notice_id,
            NoticeRead.user_id == current_user.id,
        )
    )
    if not existing.scalar_one_or_none():
        read = NoticeRead(notice_id=notice_id, user_id=current_user.id)
        db.add(read)
        await db.flush()


    return {"message": "Marked as read"}


@router.post("/{notice_id}/acknowledge")
async def acknowledge_notice(
    notice_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    """Acknowledge a notice."""
    stmt = select(NoticeRead).where(
        NoticeRead.notice_id == notice_id,
        NoticeRead.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    read = result.scalar_one_or_none()

    notice = await db.get(Notice, notice_id)

    if not notice:
        raise NotFoundException("Notice", notice_id)

    if not _can_view_notice(notice, current_user):
        raise NotFoundException("Notice", notice_id)

    if (
        not notice.is_published
        and not current_user.has_permission(
            Permission.NOTICE_PUBLISH
        )
    ):
        raise NotFoundException("Notice", notice_id)

    if read:
        read.acknowledged_at = datetime.now(timezone.utc)
    else:
        read = NoticeRead(
            notice_id=notice_id,
            user_id=current_user.id,
            acknowledged_at=datetime.now(timezone.utc),
        )
        db.add(read)

    await db.flush()
    return {"message": "Notice acknowledged"}


@router.get("/{notice_id}/readers")
async def notice_readers(
    notice_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.NOTICE_PUBLISH))],
):
    """Get list of users who have read/acknowledged a notice."""
    from app.models import User

    notice = await db.get(Notice, notice_id)
    if not notice:
        raise NotFoundException("Notice", notice_id)

    stmt = (
        select(NoticeRead, User)
        .join(User, NoticeRead.user_id == User.id)
        .where(NoticeRead.notice_id == notice_id)
        .order_by(NoticeRead.read_at.desc())
    )
    result = await db.execute(stmt)
    rows = result.all()

    return {
        "notice_id": str(notice_id),
        "total_reads": len(rows),
        "readers": [
            {
                "user_id": str(nr.user_id),
                "name": u.full_name,
                "email": u.email,
                "read_at": nr.read_at.isoformat(),
                "acknowledged_at": nr.acknowledged_at.isoformat() if nr.acknowledged_at else None,
            }
            for nr, u in rows
        ],
    }


def _notice_to_dict(n: Notice) -> dict:
    return {
        "id": str(n.id),
        "title": n.title,
        "content": n.content,
        "content_type": n.content_type,
        "summary": n.summary,
        "priority": n.priority if isinstance(n.priority, str) else n.priority.value,
        "target_type": n.target_type if isinstance(n.target_type, str) else n.target_type.value,
        "target_roles": n.target_roles,
        "is_published": n.is_published,
        "published_at": n.published_at.isoformat() if n.published_at else None,
        "language": n.language,
        "created_at": n.created_at.isoformat(),
    }
