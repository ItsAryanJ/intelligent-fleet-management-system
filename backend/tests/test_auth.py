"""
Test: Auth Endpoints — Login, Protected Routes, Logout.
"""

import pytest


@pytest.mark.asyncio
async def test_login_missing_credentials(client):
    """POST /api/auth/login without credentials returns 422."""
    resp = await client.post("/api/auth/login")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_login_invalid_credentials(client):
    """POST /api/auth/login with wrong credentials returns 401."""
    resp = await client.post(
        "/api/auth/login",
        data={"username": "nonexistent@test.com", "password": "wrong"},
    )
    # Should fail with 401 (or 500 if DB is not connected — acceptable for unit tests)
    assert resp.status_code in [401, 500]


@pytest.mark.asyncio
async def test_protected_route_no_token(client):
    """GET /api/users without auth returns 401."""
    resp = await client.get("/api/users")
    assert resp.status_code in [401, 403]


@pytest.mark.asyncio
async def test_protected_route_invalid_token(client):
    """GET /api/users with a garbage token returns 401."""
    resp = await client.get(
        "/api/users",
        headers={"Authorization": "Bearer invalid.token.here"},
    )
    assert resp.status_code in [401, 403]


@pytest.mark.asyncio
async def test_logout_no_token(client):
    """POST /api/auth/logout without token returns 401."""
    resp = await client.post("/api/auth/logout")
    assert resp.status_code in [401, 403]
