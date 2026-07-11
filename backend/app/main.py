"""
NCRTC Intelligent Fleet Management Platform — FastAPI Application Factory.
"""

import logging

import asyncio

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import ORJSONResponse

from app.core.config import get_settings
from app.core.database import init_db, close_db
from app.core.middleware import setup_middleware, setup_exception_handlers

settings = get_settings()

# Configure root logger so module-level loggers (e.g., gps_simulator) output to stdout
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

logger = logging.getLogger(__name__)

# ── SLA Sweeper Background Task ─────────────────────────────────────────
_sla_sweeper_task: asyncio.Task | None = None
SLA_SWEEP_INTERVAL_SECONDS = 60


async def _sla_sweeper_loop():
    """Background task: every 60s, mark any open incident past its sla_deadline as breached."""
    from datetime import datetime, timezone
    from sqlalchemy import select, update
    from app.core.database import async_session_factory
    from app.models import Incident

    while True:
        try:
            await asyncio.sleep(SLA_SWEEP_INTERVAL_SECONDS)
            async with async_session_factory() as session:
                now = datetime.now(timezone.utc)
                stmt = (
                    update(Incident)
                    .where(
                        Incident.is_deleted == False,
                        Incident.sla_breached == False,
                        Incident.sla_deadline.isnot(None),
                        Incident.sla_deadline < now,
                        Incident.status.in_(["OPEN", "ACKNOWLEDGED", "ASSIGNED", "IN_PROGRESS"]),
                    )
                    .values(sla_breached=True)
                )
                result = await session.execute(stmt)
                await session.commit()
                if result.rowcount > 0:
                    logger.info(f"SLA Sweeper: marked {result.rowcount} incident(s) as breached")
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"SLA Sweeper error: {e}")
            await asyncio.sleep(10)  # Brief pause before retrying


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle — startup and shutdown events."""
    global _sla_sweeper_task

    # Startup
    print(f"🚀 Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    await init_db()
    print("✅ Database initialized")

    # Start GPS Simulator
    from app.services.gps_simulator import gps_simulator
    await gps_simulator.start()
    print("📡 GPS Simulator started")

    # Start SLA Sweeper
    _sla_sweeper_task = asyncio.create_task(_sla_sweeper_loop())
    print(f"⏱️  SLA Sweeper started (interval: {SLA_SWEEP_INTERVAL_SECONDS}s)")

    yield

    # Shutdown
    if _sla_sweeper_task:
        _sla_sweeper_task.cancel()
        try:
            await _sla_sweeper_task
        except asyncio.CancelledError:
            pass
    print("⏱️  SLA Sweeper stopped")
    await gps_simulator.stop()
    print("📡 GPS Simulator stopped")
    await close_db()
    print("👋 Application shutdown complete")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description=(
            "Enterprise-grade fleet management platform for NCRTC. "
            "Features real-time vehicle tracking (AVLS), route planning, "
            "duty scheduling, incident management, analytics, and AI copilot."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        default_response_class=ORJSONResponse,
        lifespan=lifespan,
    )

    # Middleware
    setup_middleware(app)
    setup_exception_handlers(app)

    # Register routers
    _register_routers(app)

    return app


def _register_routers(app: FastAPI) -> None:
    """Register all feature routers."""
    from app.features.auth.router import router as auth_router
    from app.features.users.router import router as users_router
    from app.features.depots.router import router as depots_router
    from app.features.vehicles.router import router as vehicles_router
    from app.features.routes.router import router as routes_router
    from app.features.duties.router import router as duties_router
    from app.features.gps.router import router as gps_router
    from app.features.incidents.router import router as incidents_router
    from app.features.notices.router import router as notices_router
    from app.features.notifications.router import router as notifications_router
    from app.features.analytics.router import router as analytics_router
    from app.features.reports.router import router as reports_router
    from app.features.audit.router import router as audit_router
    from app.features.search.router import router as search_router
    from app.features.copilot.router import router as copilot_router
    from app.features.geofence.router import router as geofence_router
    from app.features.leaves.router import router as leaves_router
    from app.features.uploads.router import router as uploads_router

    prefix = "/api"

    app.include_router(auth_router, prefix=f"{prefix}/auth", tags=["Authentication"])
    app.include_router(users_router, prefix=f"{prefix}/users", tags=["Users"])
    app.include_router(depots_router, prefix=f"{prefix}/depots", tags=["Depots"])
    app.include_router(vehicles_router, prefix=f"{prefix}/vehicles", tags=["Vehicles"])
    app.include_router(routes_router, prefix=f"{prefix}/routes", tags=["Routes"])
    app.include_router(duties_router, prefix=f"{prefix}/duties", tags=["Duties"])
    app.include_router(gps_router, prefix=f"{prefix}/gps", tags=["GPS & AVLS"])
    app.include_router(incidents_router, prefix=f"{prefix}/incidents", tags=["Incidents"])
    app.include_router(notices_router, prefix=f"{prefix}/notices", tags=["Notices & CMS"])
    app.include_router(notifications_router, prefix=f"{prefix}/notifications", tags=["Notifications"])
    app.include_router(analytics_router, prefix=f"{prefix}/analytics", tags=["Analytics"])
    app.include_router(reports_router, prefix=f"{prefix}/reports", tags=["Reports"])
    app.include_router(audit_router, prefix=f"{prefix}/audit", tags=["Audit"])
    app.include_router(search_router, prefix=f"{prefix}/search", tags=["Search"])
    app.include_router(copilot_router, prefix=f"{prefix}/copilot", tags=["AI Copilot"])
    app.include_router(geofence_router, prefix=f"{prefix}/geo", tags=["Geofence & Route Deviation"])
    app.include_router(leaves_router, prefix=f"{prefix}/leaves", tags=["Leave Management"])
    app.include_router(uploads_router, prefix=f"{prefix}/uploads", tags=["File Uploads"])

    # Health check
    @app.get("/api/health", tags=["System"])
    async def health_check():
        return {
            "status": "healthy",
            "version": settings.APP_VERSION,
            "environment": settings.APP_ENV,
        }

    # System health dashboard
    @app.get("/api/system/health", tags=["System"])
    async def system_health_dashboard():
        """System health dashboard — real probes for database, services, uptime."""
        import time
        from sqlalchemy import text
        from app.core.database import async_session_factory
        from app.core.websocket import gps_manager, notification_manager

        # Probe database connectivity
        db_status = "disconnected"
        try:
            async with async_session_factory() as session:
                await session.execute(text("SELECT 1"))
                db_status = "connected"
        except Exception:
            db_status = "disconnected"

        # Real WebSocket connection count
        ws_connections = gps_manager.connection_count + notification_manager.connection_count
        ws_status = f"active ({ws_connections} connections)"

        # GPS simulator status
        from app.services.gps_simulator import gps_simulator
        simulator_status = "running" if gps_simulator._running else "stopped"

        overall_status = "healthy" if db_status == "connected" else "degraded"

        try:
            import psutil
            cpu = psutil.cpu_percent(interval=0.1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage("/")
            uptime = time.time() - psutil.boot_time()

            return {
                "status": overall_status,
                "version": settings.APP_VERSION,
                "environment": settings.APP_ENV,
                "system": {
                    "cpu_percent": cpu,
                    "memory_total_gb": round(memory.total / (1024 ** 3), 2),
                    "memory_used_gb": round(memory.used / (1024 ** 3), 2),
                    "memory_percent": memory.percent,
                    "disk_total_gb": round(disk.total / (1024 ** 3), 2),
                    "disk_used_gb": round(disk.used / (1024 ** 3), 2),
                    "disk_percent": round(disk.percent, 1),
                    "uptime_hours": round(uptime / 3600, 1),
                },
                "services": {
                    "database": db_status,
                    "websocket": ws_status,
                    "gps_simulator": simulator_status,
                },
            }
        except Exception:
            return {
                "status": overall_status,
                "version": settings.APP_VERSION,
                "environment": settings.APP_ENV,
                "system": {
                    "cpu_percent": 0, "memory_percent": 0, "disk_percent": 0,
                    "memory_total_gb": 0, "memory_used_gb": 0,
                    "disk_total_gb": 0, "disk_used_gb": 0,
                    "uptime_hours": 0,
                },
                "services": {
                    "database": db_status,
                    "websocket": ws_status,
                    "gps_simulator": simulator_status,
                },
            }


# Application instance
app = create_app()
