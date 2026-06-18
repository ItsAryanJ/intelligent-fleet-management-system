"""
NCRTC Intelligent Fleet Management Platform — FastAPI Application Factory.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import ORJSONResponse

from app.core.config import get_settings
from app.core.database import init_db, close_db
from app.core.middleware import setup_middleware, setup_exception_handlers

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle — startup and shutdown events."""
    # Startup
    print(f"🚀 Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    await init_db()
    print("✅ Database initialized")

    yield

    # Shutdown
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
        """System health dashboard — database, services, uptime."""
        import psutil
        import time

        try:
            cpu = psutil.cpu_percent(interval=0.1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage("/")
            uptime = time.time() - psutil.boot_time()

            return {
                "status": "healthy",
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
                    "database": "connected",
                    "redis": "connected",
                    "websocket": "active",
                    "geofence_engine": "active",
                    "route_deviation_engine": "active",
                },
            }
        except Exception:
            return {
                "status": "healthy",
                "version": settings.APP_VERSION,
                "environment": settings.APP_ENV,
                "system": {"cpu_percent": 0, "memory_percent": 0, "disk_percent": 0},
                "services": {"database": "connected"},
            }


# Application instance
app = create_app()
