"""
Test: Health & System Endpoints — no auth required, always reachable.
"""

import pytest


@pytest.mark.asyncio
async def test_health_endpoint(client):
    """GET /api/health returns 200 with version and status."""
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "healthy"
    assert "version" in body
    assert "environment" in body


@pytest.mark.asyncio
async def test_system_health_endpoint(client):
    """GET /api/system/health returns 200 with services and system info."""
    resp = await client.get("/api/system/health")
    assert resp.status_code == 200
    body = resp.json()
    assert "status" in body
    assert "services" in body
    assert "database" in body["services"]
    assert "gps_simulator" in body["services"]
