"""
Authentication service — login, token management, password operations.
"""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    BadRequestException,
    NotFoundException,
    UnauthorizedException,
)
from app.core.permissions import ROLE_PERMISSIONS, RoleName
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
    verify_refresh_token,
)
from app.features.auth.schemas import TokenResponse, UserBrief, UserProfileResponse
from app.models import User


class AuthService:
    """Handles authentication and authorization logic."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def login(self, email: str, password: str) -> TokenResponse:
        """Authenticate user and return JWT tokens."""
        # Find user
        stmt = (
            select(User)
            .options(selectinload(User.role), selectinload(User.depot))
            .where(User.email == email, User.is_deleted == False)
        )
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user:
            raise UnauthorizedException("Invalid email or password")

        if not verify_password(password, user.password_hash):
            raise UnauthorizedException("Invalid email or password")

        if not user.is_active:
            raise UnauthorizedException("Account is deactivated")

        # Get permissions for role
        permissions = self._get_role_permissions(user.role.name)

        # Create tokens
        access_token = create_access_token(
            subject=user.id,
            role=user.role.name,
            permissions=permissions,
            depot_id=user.depot_id,
        )
        refresh_token = create_refresh_token(subject=user.id)

        # Update last login
        user.last_login = datetime.now(timezone.utc)
        await self.db.flush()

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=1800,  # 30 minutes
            user=UserBrief(
                id=user.id,
                email=user.email,
                first_name=user.first_name,
                last_name=user.last_name,
                employee_id=user.employee_id,
                role=user.role.name,
                permissions=permissions,
                depot_id=user.depot_id,
                depot_name=user.depot.name if user.depot else None,
                avatar_url=user.avatar_url,
            ),
        )

    async def refresh_tokens(self, refresh_token_str: str) -> TokenResponse:
        """Refresh access token using a valid refresh token."""
        try:
            payload = verify_refresh_token(refresh_token_str)
        except ValueError:
            raise UnauthorizedException("Invalid refresh token")

        user_id = UUID(payload["sub"])

        stmt = (
            select(User)
            .options(selectinload(User.role), selectinload(User.depot))
            .where(User.id == user_id, User.is_deleted == False)
        )
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user or not user.is_active:
            raise UnauthorizedException("User not found or deactivated")

        permissions = self._get_role_permissions(user.role.name)

        access_token = create_access_token(
            subject=user.id,
            role=user.role.name,
            permissions=permissions,
            depot_id=user.depot_id,
        )
        new_refresh_token = create_refresh_token(subject=user.id)

        return TokenResponse(
            access_token=access_token,
            refresh_token=new_refresh_token,
            expires_in=1800,
            user=UserBrief(
                id=user.id,
                email=user.email,
                first_name=user.first_name,
                last_name=user.last_name,
                employee_id=user.employee_id,
                role=user.role.name,
                permissions=permissions,
                depot_id=user.depot_id,
                depot_name=user.depot.name if user.depot else None,
                avatar_url=user.avatar_url,
            ),
        )

    async def get_profile(self, user_id: UUID) -> UserProfileResponse:
        """Get current user profile."""
        stmt = (
            select(User)
            .options(selectinload(User.role), selectinload(User.depot))
            .where(User.id == user_id, User.is_deleted == False)
        )
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user:
            raise NotFoundException("User", user_id)

        permissions = self._get_role_permissions(user.role.name)

        return UserProfileResponse(
            id=user.id,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            employee_id=user.employee_id,
            phone=user.phone,
            avatar_url=user.avatar_url,
            role=user.role.name,
            role_id=user.role_id,
            permissions=permissions,
            depot_id=user.depot_id,
            depot_name=user.depot.name if user.depot else None,
            is_active=user.is_active,
            last_login=user.last_login,
            created_at=user.created_at,
        )

    async def change_password(
        self, user_id: UUID, current_password: str, new_password: str
    ) -> None:
        """Change user password."""
        stmt = select(User).where(User.id == user_id, User.is_deleted == False)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user:
            raise NotFoundException("User", user_id)

        if not verify_password(current_password, user.password_hash):
            raise BadRequestException("Current password is incorrect")

        user.password_hash = hash_password(new_password)
        await self.db.flush()

    def _get_role_permissions(self, role_name: str) -> list[str]:
        """Get permission codes for a role from the static mapping."""
        try:
            role_enum = RoleName(role_name)
            return [p.value for p in ROLE_PERMISSIONS.get(role_enum, [])]
        except ValueError:
            return []
