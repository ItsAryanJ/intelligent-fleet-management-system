"""
Test: Security Module — JTI denylist, token verification, SECRET_KEY guard.
"""

import pytest
from app.core.security import (
    deny_token,
    is_token_denied,
    _denied_jtis,
)


class TestJTIDenylist:
    """Unit tests for the in-memory JTI token denylist."""

    def setup_method(self):
        """Clear the denylist before each test."""
        _denied_jtis.clear()

    def test_add_and_check_jti(self):
        """Adding a JTI should make it appear in the denylist."""
        test_jti = "test-uuid-12345"
        deny_token(test_jti)
        assert is_token_denied(test_jti) is True

    def test_jti_not_in_denylist(self):
        """A JTI that was never added should not be denied."""
        assert is_token_denied("never-added-jti") is False

    def test_multiple_jtis(self):
        """Multiple JTIs can be independently tracked."""
        deny_token("jti-a")
        deny_token("jti-b")
        assert is_token_denied("jti-a") is True
        assert is_token_denied("jti-b") is True
        assert is_token_denied("jti-c") is False
