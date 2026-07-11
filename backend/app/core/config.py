"""
Application configuration using Pydantic Settings.
Loads from environment variables and .env files.
"""

from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ──────────────────────────────────────────────────────
    APP_NAME: str = "NCRTC Fleet Management"
    APP_ENV: str = "development"
    APP_DEBUG: bool = True
    APP_VERSION: str = "1.0.0"

    # ── Backend Server ───────────────────────────────────────────────────
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000
    BACKEND_WORKERS: int = 1
    BACKEND_RELOAD: bool = True

    # ── Security ─────────────────────────────────────────────────────────
    SECRET_KEY: str = "change-this-to-a-secure-random-string-in-production"
    _SECRET_KEY_DEFAULT: str = "change-this-to-a-secure-random-string-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── Database ─────────────────────────────────────────────────────────
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "ncrtc_fleet"
    POSTGRES_USER: str = "ncrtc_admin"
    POSTGRES_PASSWORD: str = "ncrtc_secure_password_2024"
    DATABASE_URL: Optional[str] = None

    @property
    def database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def sync_database_url(self) -> str:
        """Sync URL for Alembic migrations."""
        return self.database_url.replace("+asyncpg", "")

    # ── GPS Simulator ────────────────────────────────────────────────────
    GPS_SIMULATOR_ENABLED: bool = True
    GPS_SIMULATOR_INTERVAL_SECONDS: int = 5
    GPS_SIMULATOR_VEHICLE_COUNT: int = 50

    # ── AI Copilot ───────────────────────────────────────────────────────
    COPILOT_MODE: str = "demo"  # "demo" or "live"
    GEMINI_API_KEY: Optional[str] = None

    # ── CORS ─────────────────────────────────────────────────────────────
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:80",
        "http://localhost",
    ]

    # ── File Uploads ─────────────────────────────────────────────────────
    UPLOAD_DIR: str = "uploads"
    UPLOAD_MAX_SIZE_MB: int = 10
    UPLOAD_ALLOWED_TYPES: list[str] = ["image/jpeg", "image/png", "application/pdf"]
    UPLOAD_ALLOWED_EXTENSIONS: list[str] = [".jpg", ".jpeg", ".png", ".pdf"]

    # ── Demo Mode ────────────────────────────────────────────────────────
    DEMO_MODE: bool = False

    # ── Rate Limiting ────────────────────────────────────────────────────
    RATE_LIMIT_PER_MINUTE: int = 60


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    settings = Settings()
    # Guard: refuse weak default SECRET_KEY outside development
    if (
        settings.SECRET_KEY == settings._SECRET_KEY_DEFAULT
        and settings.APP_ENV != "development"
    ):
        raise RuntimeError(
            "FATAL: SECRET_KEY is the insecure default. "
            "Set a strong SECRET_KEY environment variable for non-development environments."
        )
    return settings
