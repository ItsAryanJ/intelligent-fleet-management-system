"""
FastAPI dependencies — authentication, authorization, database sessions.
"""

from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.database import get_db
from app.core.exceptions import (
    ForbiddenException,
    UnauthorizedException,
)
from app.core.permissions import Permission, ROLE_PERMISSIONS, RoleName
from app.core.security import verify_access_token

settings = get_settings()
security_scheme = HTTPBearer()


# ── Current User Schema (lightweight, no DB model import) ─────────────
class CurrentUser:
    """Lightweight representation of the authenticated user."""

    def __init__(
        self,
        id: UUID,
        role: str,
        permissions: list[str],
        depot_id: UUID | None = None,
    ):
        self.id = id
        self.role = role
        self.permissions = permissions
        self.depot_id = depot_id

    def has_permission(self, permission: Permission) -> bool:
        """Check if the user has a specific permission."""
        return permission.value in self.permissions

    def require_permission(self, permission: Permission) -> None:
        """Raise ForbiddenException if user lacks the permission."""
        if not self.has_permission(permission):
            raise ForbiddenException(
                f"Permission '{permission.value}' required"
            )


async def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials, Depends(security_scheme)
    ],
) -> CurrentUser:
    """Extract and validate the current user from the JWT token."""
    try:
        payload = verify_access_token(credentials.credentials)
    except ValueError:
        raise UnauthorizedException()

    user_id = payload.get("sub")
    role = payload.get("role")
    permissions = payload.get("permissions", [])
    depot_id_str = payload.get("depot_id")

    if not user_id or not role:
        raise UnauthorizedException()

    return CurrentUser(
        id=UUID(user_id),
        role=role,
        permissions=permissions,
        depot_id=UUID(depot_id_str) if depot_id_str else None,
    )


def require_permission(permission: Permission):
    """Dependency factory for requiring a specific permission."""

    async def _check_permission(
        current_user: Annotated[CurrentUser, Depends(get_current_user)],
    ) -> CurrentUser:
        current_user.require_permission(permission)
        return current_user

    return _check_permission


def require_any_permission(*permissions: Permission):
    """Dependency factory for requiring any one of several permissions."""

    async def _check_permission(
        current_user: Annotated[CurrentUser, Depends(get_current_user)],
    ) -> CurrentUser:
        has_any = any(
            current_user.has_permission(p) for p in permissions
        )
        if not has_any:
            raise ForbiddenException(
                f"One of the following permissions required: "
                f"{', '.join(p.value for p in permissions)}"
            )
        return current_user

    return _check_permission


def require_role(*roles: RoleName):
    """Dependency factory for requiring a specific role."""

    async def _check_role(
        current_user: Annotated[CurrentUser, Depends(get_current_user)],
    ) -> CurrentUser:
        if current_user.role not in [r.value for r in roles]:
            raise ForbiddenException(
                f"Role '{current_user.role}' not authorized"
            )
        return current_user

    return _check_role
