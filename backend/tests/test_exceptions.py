"""
Test: Exceptions — Custom exception hierarchy returns correct HTTP status codes.
"""

import pytest
from app.core.exceptions import (
    NotFoundException,
    UnauthorizedException,
    ForbiddenException,
    BadRequestException,
    ConflictException,
    RateLimitException,
    ValidationException,
)


class TestExceptionHierarchy:
    """Verify each exception carries the correct HTTP status and error code."""

    def test_not_found(self):
        exc = NotFoundException("Vehicle", "abc-123")
        assert exc.status_code == 404
        assert "abc-123" in exc.detail
        assert exc.error_code == "NOT_FOUND"

    def test_not_found_no_id(self):
        exc = NotFoundException("Resource")
        assert exc.status_code == 404
        assert exc.detail == "Resource not found"

    def test_unauthorized(self):
        exc = UnauthorizedException()
        assert exc.status_code == 401
        assert exc.error_code == "UNAUTHORIZED"
        assert exc.headers == {"WWW-Authenticate": "Bearer"}

    def test_forbidden(self):
        exc = ForbiddenException("You shall not pass")
        assert exc.status_code == 403
        assert "shall not pass" in exc.detail
        assert exc.error_code == "FORBIDDEN"

    def test_bad_request(self):
        exc = BadRequestException("Missing field")
        assert exc.status_code == 400
        assert exc.error_code == "BAD_REQUEST"

    def test_conflict(self):
        exc = ConflictException("Already exists")
        assert exc.status_code == 409
        assert exc.error_code == "CONFLICT"

    def test_rate_limit(self):
        exc = RateLimitException()
        assert exc.status_code == 429
        assert exc.error_code == "RATE_LIMIT_EXCEEDED"

    def test_validation(self):
        exc = ValidationException("Bad data", errors=[{"field": "name"}])
        assert exc.status_code == 422
        assert len(exc.errors) == 1
        assert exc.error_code == "VALIDATION_ERROR"
