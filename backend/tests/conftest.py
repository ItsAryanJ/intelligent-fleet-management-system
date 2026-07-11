"""
NCRTC BMS Test Suite — Shared Fixtures.

Provides two types of test clients:
1. `client` — Async HTTP client via TestClient (requires no DB, bypasses lifespan)
2. Pure unit tests — import directly, no client needed
"""

import os
import pytest
from httpx import ASGITransport, AsyncClient

# Force test environment settings before any app imports
os.environ.setdefault("APP_ENV", "testing")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci-only")
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://test:test@localhost:5432/fleet_test",
)


@pytest.fixture(scope="session")
def app():
    """Create the FastAPI application instance for testing.

    Uses the app factory but note: the lifespan (DB init, GPS start)
    will not run unless the test explicitly starts the app. ASGI
    transport sends HTTP requests through the app without starting
    the lifespan by default when override_lifespan=True is not set.
    """
    from app.main import create_app

    return create_app()


@pytest.fixture
async def client(app):
    """Async HTTP client bound to the test app (no network).

    NOTE: This does NOT trigger the lifespan (DB init, GPS simulator).
    Tests that need a live DB should be marked @pytest.mark.integration
    and run against a real PostgreSQL instance.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
