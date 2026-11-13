from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings, read from environment variables (and `.env` when present)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Healthcare Dashboard API"
    service_name: str = "healthcare-backend"
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/healthcare"
    log_level: str = "INFO"
    # Base URL of an OTLP/HTTP collector, e.g. http://localhost:4318. Unset disables export.
    otel_exporter_otlp_endpoint: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
