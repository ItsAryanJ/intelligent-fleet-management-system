"""
Authentication schemas — request/response models.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: "UserBrief"


class UserBrief(BaseModel):
    id: UUID
    email: str
    first_name: str
    last_name: str
    employee_id: str
    role: str
    permissions: list[str]
    depot_id: Optional[UUID] = None
    depot_name: Optional[str] = None
    avatar_url: Optional[str] = None


class RefreshRequest(BaseModel):
    refresh_token: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class UserProfileResponse(BaseModel):
    id: UUID
    email: str
    first_name: str
    last_name: str
    employee_id: str
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str
    role_id: UUID
    permissions: list[str]
    depot_id: Optional[UUID] = None
    depot_name: Optional[str] = None
    is_active: bool
    last_login: Optional[datetime] = None
    created_at: datetime
