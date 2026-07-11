"""
Authentication router — login, refresh, logout, profile.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Request, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser, get_current_user
from app.features.auth.schemas import (
    ChangePasswordRequest,
    LoginRequest,
    RefreshRequest,
    TokenResponse,
    UserProfileResponse,
)
from app.features.auth.service import AuthService
from app.core.security import decode_token, deny_token

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Authenticate user and return JWT tokens."""
    service = AuthService(db)
    return await service.login(body.email, body.password)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    body: RefreshRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Refresh access token using a valid refresh token."""
    service = AuthService(db)
    return await service.refresh_tokens(body.refresh_token)


# @router.post("/logout")
# async def logout(request: Request):
#     """Logout — revoke the current access token server-side.

#     The token's JTI is added to an in-memory denylist so it cannot
#     be reused. The denylist is cleared on server restart, but tokens
#     also have short expiry (30 min for access tokens).
#     """
#     auth_header = request.headers.get("Authorization", "")
#     if auth_header.startswith("Bearer "):
#         token = auth_header[7:]
#         try:
#             payload = decode_token(token)
#             jti = payload.get("jti")
#             if jti:
#                 deny_token(jti)
#         except (ValueError, Exception):
#             pass  # Token already expired or invalid — logout succeeds regardless
#     return {"message": "Logged out successfully"}

@router.post("/logout")
async def logout(request: Request):
    """Logout — revoke the current access token server-side."""
    auth_header = request.headers.get("Authorization", "")
    
    # Trigger 401 if the header is missing or malformed
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Missing or invalid authentication token"
        )
        
    token = auth_header[7:]
    try:
        payload = decode_token(token)
        jti = payload.get("jti")
        if jti:
            deny_token(jti)
    except (ValueError, Exception):
        # Optional: You can also raise a 401 here if the token is invalid, 
        # or leave the 'pass' if you want to allow logging out with an expired token.
        pass 
        
    return {"message": "Logged out successfully"}

@router.get("/me", response_model=UserProfileResponse)
async def get_profile(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get current user profile."""
    service = AuthService(db)
    return await service.get_profile(current_user.id)


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Change current user's password."""
    service = AuthService(db)
    await service.change_password(
        current_user.id, body.current_password, body.new_password
    )
    return {"message": "Password changed successfully"}
