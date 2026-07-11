"""
File Upload System — Local storage with validation, metadata, and security.
Supports incident photos, notice attachments, user avatars, and report files.
"""

import os
import uuid
import mimetypes
from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, UploadFile, Form, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.dependencies import CurrentUser, get_current_user
from app.models import AuditLog

settings = get_settings()
router = APIRouter()

# Ensure upload directories exist
UPLOAD_CATEGORIES = ["incidents", "notices", "profiles", "reports"]
for cat in UPLOAD_CATEGORIES:
    os.makedirs(os.path.join(settings.UPLOAD_DIR, cat), exist_ok=True)

# In-memory file metadata store (in production, use DB table)
# We'll store in audit_logs with resource_type="file_upload"

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".pdf"}
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "application/pdf"}
MAX_FILE_SIZE = settings.UPLOAD_MAX_SIZE_MB * 1024 * 1024  # bytes


def _sanitize_filename(filename: str) -> str:
    """Remove path components and dangerous characters."""
    # Take only the basename
    name = os.path.basename(filename)
    # Remove non-alphanumeric chars except dots, hyphens, underscores
    safe = "".join(c for c in name if c.isalnum() or c in ".-_")
    return safe or "unnamed"


def _validate_file(file: UploadFile) -> tuple[str, str]:
    """Validate file extension and MIME type. Returns (safe_name, extension)."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # Validate MIME type
    if file.content_type and file.content_type not in ALLOWED_MIME_TYPES:
        # Also check by extension
        guessed = mimetypes.guess_type(file.filename)[0]
        if guessed not in ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"MIME type '{file.content_type}' not allowed"
            )

    safe_name = _sanitize_filename(file.filename)
    return safe_name, ext


@router.post("")
async def upload_file(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    file: UploadFile = File(...),
    category: str = Form("incidents"),
    resource_id: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
):
    """Upload a file with validation and metadata tracking."""
    if category not in UPLOAD_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category. Use: {', '.join(UPLOAD_CATEGORIES)}")

    safe_name, ext = _validate_file(file)

    # Read and validate size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum: {settings.UPLOAD_MAX_SIZE_MB}MB"
        )

    # Generate unique filename
    file_id = str(uuid.uuid4())
    stored_name = f"{file_id}{ext}"
    file_path = os.path.join(settings.UPLOAD_DIR, category, stored_name)

    # Write to disk
    with open(file_path, "wb") as f:
        f.write(content)

    # Audit log the upload
    audit = AuditLog(
        user_id=current_user.id,
        action="FILE_UPLOAD",
        resource_type="file_upload",
        resource_id=file_id,
        details={
            "original_name": safe_name,
            "stored_name": stored_name,
            "category": category,
            "size_bytes": len(content),
            "mime_type": file.content_type,
            "resource_id": resource_id,
            "description": description,
            "file_path": file_path,
        },
    )
    db.add(audit)
    await db.flush()

    return {
        "id": file_id,
        "filename": safe_name,
        "category": category,
        "size_bytes": len(content),
        "mime_type": file.content_type,
        "url": f"/api/uploads/{file_id}",
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("")
async def list_files_root(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    category: Optional[str] = None,
    resource_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
):
    """List uploaded files — root alias for /list.

    The frontend FileUpload component calls GET /uploads?category=...&resource_id=...
    so this root handler must exist and be registered before /{file_id}.
    """
    stmt = select(AuditLog).where(AuditLog.action == "FILE_UPLOAD")

    if category:
        stmt = stmt.where(AuditLog.details["category"].astext == category)
    if resource_id:
        stmt = stmt.where(AuditLog.details["resource_id"].astext == resource_id)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    stmt = stmt.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    audits = result.scalars().all()

    return {
        "items": [
            {
                "id": a.resource_id,
                "filename": a.details.get("original_name") if a.details else None,
                "category": a.details.get("category") if a.details else None,
                "size_bytes": a.details.get("size_bytes") if a.details else None,
                "mime_type": a.details.get("mime_type") if a.details else None,
                "resource_id": a.details.get("resource_id") if a.details else None,
                "uploaded_by": str(a.user_id) if a.user_id else None,
                "uploaded_at": a.created_at.isoformat(),
                "url": f"/api/uploads/{a.resource_id}",
            }
            for a in audits
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{file_id}")
async def get_file(
    file_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    """Download/preview a file by its ID."""
    # Find file metadata from audit logs
    result = await db.execute(
        select(AuditLog).where(
            AuditLog.action == "FILE_UPLOAD",
            AuditLog.resource_id == file_id,
        )
    )
    audit = result.scalar_one_or_none()
    if not audit or not audit.details:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = audit.details.get("file_path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=file_path,
        filename=audit.details.get("original_name", "download"),
        media_type=audit.details.get("mime_type", "application/octet-stream"),
    )


@router.get("/{file_id}/metadata")
async def get_file_metadata(
    file_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    """Get file metadata without downloading."""
    result = await db.execute(
        select(AuditLog).where(
            AuditLog.action == "FILE_UPLOAD",
            AuditLog.resource_id == file_id,
        )
    )
    audit = result.scalar_one_or_none()
    if not audit or not audit.details:
        raise HTTPException(status_code=404, detail="File not found")

    d = audit.details
    return {
        "id": file_id,
        "filename": d.get("original_name"),
        "category": d.get("category"),
        "size_bytes": d.get("size_bytes"),
        "mime_type": d.get("mime_type"),
        "description": d.get("description"),
        "resource_id": d.get("resource_id"),
        "uploaded_by": str(audit.user_id) if audit.user_id else None,
        "uploaded_at": audit.created_at.isoformat(),
        "url": f"/api/uploads/{file_id}",
    }


@router.delete("/{file_id}")
async def delete_file(
    file_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    """Delete a file. Only uploader or admin can delete."""
    result = await db.execute(
        select(AuditLog).where(
            AuditLog.action == "FILE_UPLOAD",
            AuditLog.resource_id == file_id,
        )
    )
    audit = result.scalar_one_or_none()
    if not audit or not audit.details:
        raise HTTPException(status_code=404, detail="File not found")

    # Security: only uploader or admin
    if str(audit.user_id) != str(current_user.id) and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized to delete this file")

    file_path = audit.details.get("file_path")
    if file_path and os.path.exists(file_path):
        os.remove(file_path)

    # Audit log deletion
    db.add(AuditLog(
        user_id=current_user.id,
        action="FILE_DELETE",
        resource_type="file_upload",
        resource_id=file_id,
        details={"original_name": audit.details.get("original_name")},
    ))
    await db.flush()

    return {"message": "File deleted"}


@router.get("/list")
async def list_files(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    category: Optional[str] = None,
    resource_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
):
    """List uploaded files with optional category/resource filtering."""
    stmt = select(AuditLog).where(AuditLog.action == "FILE_UPLOAD")

    if category:
        stmt = stmt.where(AuditLog.details["category"].astext == category)
    if resource_id:
        stmt = stmt.where(AuditLog.details["resource_id"].astext == resource_id)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    stmt = stmt.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    audits = result.scalars().all()

    return {
        "items": [
            {
                "id": a.resource_id,
                "filename": a.details.get("original_name") if a.details else None,
                "category": a.details.get("category") if a.details else None,
                "size_bytes": a.details.get("size_bytes") if a.details else None,
                "mime_type": a.details.get("mime_type") if a.details else None,
                "resource_id": a.details.get("resource_id") if a.details else None,
                "uploaded_by": str(a.user_id) if a.user_id else None,
                "uploaded_at": a.created_at.isoformat(),
                "url": f"/api/uploads/{a.resource_id}",
            }
            for a in audits
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }
