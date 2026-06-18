"""
Custom exception hierarchy for the application.
"""

from typing import Any, Optional


class AppException(Exception):
    """Base application exception."""

    def __init__(
        self,
        status_code: int = 500,
        detail: str = "Internal server error",
        error_code: str = "INTERNAL_ERROR",
        headers: Optional[dict[str, str]] = None,
    ):
        self.status_code = status_code
        self.detail = detail
        self.error_code = error_code
        self.headers = headers
        super().__init__(detail)


class NotFoundException(AppException):
    """Resource not found."""

    def __init__(self, resource: str = "Resource", resource_id: Any = None):
        detail = f"{resource} not found"
        if resource_id:
            detail = f"{resource} with id '{resource_id}' not found"
        super().__init__(
            status_code=404,
            detail=detail,
            error_code="NOT_FOUND",
        )


class UnauthorizedException(AppException):
    """Authentication failure."""

    def __init__(self, detail: str = "Could not validate credentials"):
        super().__init__(
            status_code=401,
            detail=detail,
            error_code="UNAUTHORIZED",
            headers={"WWW-Authenticate": "Bearer"},
        )


class ForbiddenException(AppException):
    """Insufficient permissions."""

    def __init__(self, detail: str = "Insufficient permissions"):
        super().__init__(
            status_code=403,
            detail=detail,
            error_code="FORBIDDEN",
        )


class BadRequestException(AppException):
    """Invalid request data."""

    def __init__(self, detail: str = "Bad request"):
        super().__init__(
            status_code=400,
            detail=detail,
            error_code="BAD_REQUEST",
        )


class ConflictException(AppException):
    """Resource conflict (e.g., duplicate)."""

    def __init__(self, detail: str = "Resource already exists"):
        super().__init__(
            status_code=409,
            detail=detail,
            error_code="CONFLICT",
        )


class RateLimitException(AppException):
    """Rate limit exceeded."""

    def __init__(self):
        super().__init__(
            status_code=429,
            detail="Rate limit exceeded. Please try again later.",
            error_code="RATE_LIMIT_EXCEEDED",
        )


class ValidationException(AppException):
    """Validation error with field-level details."""

    def __init__(self, detail: str = "Validation error", errors: Optional[list[dict]] = None):
        self.errors = errors or []
        super().__init__(
            status_code=422,
            detail=detail,
            error_code="VALIDATION_ERROR",
        )
