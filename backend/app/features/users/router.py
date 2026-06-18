"""
Users feature — CRUD, role assignment, profile management.
"""

from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import CurrentUser, get_current_user, require_permission
from app.core.exceptions import ConflictException, NotFoundException
from app.core.permissions import Permission, RoleName
from app.core.security import hash_password
from app.models import User, Role
from pydantic import BaseModel, EmailStr, Field

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    employee_id: str = Field(min_length=1, max_length=50)
    phone: Optional[str] = None
    role_id: UUID
    depot_id: Optional[UUID] = None


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    role_id: Optional[UUID] = None
    depot_id: Optional[UUID] = None
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    id: UUID
    email: str
    first_name: str
    last_name: str
    employee_id: str
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    role_name: str
    role_id: UUID
    depot_id: Optional[UUID] = None
    depot_name: Optional[str] = None
    is_active: bool
    last_login: Optional[str] = None
    created_at: str

    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    items: list[UserResponse]
    total: int
    page: int
    page_size: int


# ── Endpoints ────────────────────────────────────────────────────────────
@router.get("", response_model=UserListResponse)
async def list_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.USER_VIEW))],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    role: Optional[str] = None,
    depot_id: Optional[UUID] = None,
    is_active: Optional[bool] = None,
):
    """List users with filtering and pagination."""
    stmt = (
        select(User)
        .options(selectinload(User.role), selectinload(User.depot))
        .where(User.is_deleted == False)
    )

    if current_user.role == RoleName.DEPOT_MANAGER.value:
        stmt = stmt.where(
            User.depot_id == current_user.depot_id
    )

    if search:
        search_filter = f"%{search}%"
        stmt = stmt.where(
            (User.first_name.ilike(search_filter))
            | (User.last_name.ilike(search_filter))
            | (User.email.ilike(search_filter))
            | (User.employee_id.ilike(search_filter))
        )
    if role:
        stmt = stmt.join(User.role).where(Role.name == role)
    if depot_id:
        stmt = stmt.where(User.depot_id == depot_id)
    if is_active is not None:
        stmt = stmt.where(User.is_active == is_active)

    # Count
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    # Paginate
    stmt = stmt.offset((page - 1) * page_size).limit(page_size).order_by(User.created_at.desc())
    result = await db.execute(stmt)
    users = result.scalars().all()

    return UserListResponse(
        items=[
            UserResponse(
                id=u.id,
                email=u.email,
                first_name=u.first_name,
                last_name=u.last_name,
                employee_id=u.employee_id,
                phone=u.phone,
                avatar_url=u.avatar_url,
                role_name=u.role.name if u.role else "UNKNOWN",
                role_id=u.role_id,
                depot_id=u.depot_id,
                depot_name=u.depot.name if u.depot else None,
                is_active=u.is_active,
                last_login=u.last_login.isoformat() if u.last_login else None,
                created_at=u.created_at.isoformat(),
            )
            for u in users
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.USER_VIEW))],
):
    """Get a single user by ID."""
    stmt = (
        select(User)
        .options(selectinload(User.role), selectinload(User.depot))
        .where(User.id == user_id, User.is_deleted == False)
    )

    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise NotFoundException("User", user_id)
    
    if (
        current_user.role == RoleName.DEPOT_MANAGER.value
        and user.depot_id != current_user.depot_id
    ):
        raise NotFoundException("User", user_id)

    return UserResponse(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        employee_id=user.employee_id,
        phone=user.phone,
        avatar_url=user.avatar_url,
        role_name=user.role.name if user.role else "UNKNOWN",
        role_id=user.role_id,
        depot_id=user.depot_id,
        depot_name=user.depot.name if user.depot else None,
        is_active=user.is_active,
        last_login=user.last_login.isoformat() if user.last_login else None,
        created_at=user.created_at.isoformat(),
    )


@router.post("", response_model=UserResponse, status_code=201)
async def create_user(
    body: UserCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.USER_MANAGE))],
):
    """Create a new user."""
    # Check for existing email
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise ConflictException("User with this email already exists")

    # Check for existing employee_id
    existing_emp = await db.execute(select(User).where(User.employee_id == body.employee_id))
    if existing_emp.scalar_one_or_none():
        raise ConflictException("User with this employee ID already exists")

    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        first_name=body.first_name,
        last_name=body.last_name,
        employee_id=body.employee_id,
        phone=body.phone,
        role_id=body.role_id,
        depot_id=body.depot_id,
        created_by=str(current_user.id),
    )
    db.add(user)
    await db.flush()
    await db.refresh(user, ["role", "depot"])

    return UserResponse(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        employee_id=user.employee_id,
        phone=user.phone,
        avatar_url=user.avatar_url,
        role_name=user.role.name if user.role else "UNKNOWN",
        role_id=user.role_id,
        depot_id=user.depot_id,
        depot_name=user.depot.name if user.depot else None,
        is_active=user.is_active,
        last_login=None,
        created_at=user.created_at.isoformat(),
    )


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    body: UserUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.USER_MANAGE))],
):
    """Update a user."""
    stmt = (
        select(User)
        .options(selectinload(User.role), selectinload(User.depot))
        .where(User.id == user_id, User.is_deleted == False)
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user:
        raise NotFoundException("User", user_id)
    
    if (
        current_user.role == RoleName.DEPOT_MANAGER.value
        and user.depot_id != current_user.depot_id
    ):
        raise NotFoundException("User", user_id)
    
    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    user.updated_by = str(current_user.id)

    await db.flush()
    await db.refresh(user, ["role", "depot"])

    return UserResponse(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        employee_id=user.employee_id,
        phone=user.phone,
        avatar_url=user.avatar_url,
        role_name=user.role.name if user.role else "UNKNOWN",
        role_id=user.role_id,
        depot_id=user.depot_id,
        depot_name=user.depot.name if user.depot else None,
        is_active=user.is_active,
        last_login=user.last_login.isoformat() if user.last_login else None,
        created_at=user.created_at.isoformat(),
    )


@router.delete("/{user_id}")
async def delete_user(
    user_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.USER_MANAGE))],
):
    """Soft delete a user."""
    stmt = select(User).where(User.id == user_id, User.is_deleted == False)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user:
        raise NotFoundException("User", user_id)
    
    if (
        current_user.role == RoleName.DEPOT_MANAGER.value
        and user.depot_id != current_user.depot_id
    ):
        raise NotFoundException("User", user_id)

    user.is_deleted = True
    user.updated_by = str(current_user.id)
    await db.flush()

    return {"message": "User deleted successfully"}


@router.get("/roles/list")
async def list_roles(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    """List all available roles."""
    result = await db.execute(select(Role).where(Role.is_active == True))
    roles = result.scalars().all()
    return [
        {"id": r.id, "name": r.name, "description": r.description}
        for r in roles
    ]
