"""
Security utilities — JWT tokens, password hashing, and authentication.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID
import uuid as uuid_module
import threading

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

settings = get_settings()

# ── Password Hashing ────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── Token Denylist (in-memory, cleared on restart) ──────────────────────
# NOTE: This is intentionally in-memory. A production system would use
# Redis or a database table. Restarting the server clears the denylist,
# but tokens also have short expiry (30min access, 7day refresh).
_denied_jtis: set[str] = set()
_denylist_lock = threading.Lock()


def deny_token(jti: str) -> None:
    """Add a JTI to the denylist (called on logout)."""
    with _denylist_lock:
        _denied_jtis.add(jti)


def is_token_denied(jti: str) -> bool:
    """Check if a JTI has been denied."""
    with _denylist_lock:
        return jti in _denied_jtis


def hash_password(password: str) -> str:
    """Hash a plaintext password."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a hash."""
    return pwd_context.verify(plain_password, hashed_password)


# ── JWT Tokens ───────────────────────────────────────────────────────────
def create_access_token(
    subject: str | UUID,
    role: str,
    permissions: list[str],
    depot_id: Optional[str | UUID] = None,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a JWT access token."""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode: dict[str, Any] = {
        "sub": str(subject),
        "role": role,
        "permissions": permissions,
        "depot_id": str(depot_id) if depot_id else None,
        "type": "access",
        "jti": uuid_module.uuid4().hex,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )


def create_refresh_token(
    subject: str | UUID,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a JWT refresh token."""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS
        )

    to_encode: dict[str, Any] = {
        "sub": str(subject),
        "type": "refresh",
        "jti": uuid_module.uuid4().hex,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )


def decode_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT token."""
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError as e:
        raise ValueError(f"Invalid token: {e}")


def verify_access_token(token: str) -> dict[str, Any]:
    """Verify an access token and return the payload."""
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise ValueError("Not an access token")
    jti = payload.get("jti")
    if jti and is_token_denied(jti):
        raise ValueError("Token has been revoked")
    return payload


def verify_refresh_token(token: str) -> dict[str, Any]:
    """Verify a refresh token and return the payload."""
    payload = decode_token(token)
    if payload.get("type") != "refresh":
        raise ValueError("Not a refresh token")
    jti = payload.get("jti")
    if jti and is_token_denied(jti):
        raise ValueError("Token has been revoked")
    return payload
