from functools import lru_cache

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import make_url


def asyncpg_url(url: str) -> str:
    """Accept a standard PostgreSQL URL, as hosting providers supply it, and
    return one for SQLAlchemy's asyncpg driver.

    `postgresql://…?sslmode=require` becomes `postgresql+asyncpg://…?ssl=require`:
    asyncpg calls the option `ssl` and has no `channel_binding` option.
    """
    parsed = make_url(url)
    if parsed.drivername in ("postgres", "postgresql"):
        parsed = parsed.set(drivername="postgresql+asyncpg")
    query = dict(parsed.query)
    sslmode = query.pop("sslmode", None)
    query.pop("channel_binding", None)
    if sslmode and "ssl" not in query:
        query["ssl"] = sslmode
    return parsed.set(query=query).render_as_string(hide_password=False)


class Settings(BaseSettings):
    """Application settings, read from environment variables (and `.env` when present)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Healthcare Dashboard API"
    service_name: str = "healthcare-backend"
    # A direct connection is preferred when the host offers both it and a pooled
    # one (Neon on Vercel does): asyncpg's prepared statements need a direct one.
    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/healthcare",
        validation_alias=AliasChoices("DATABASE_URL_UNPOOLED", "DATABASE_URL"),
    )
    log_level: str = "INFO"
    # Time zone the practice works in; dates in generated summaries are shown in it.
    practice_timezone: str = "America/Los_Angeles"
    # Base URL of an OTLP/HTTP collector, e.g. http://localhost:4318. Unset disables export.
    otel_exporter_otlp_endpoint: str | None = None
    # Set by Vercel. Its functions are many small instances, so each keeps few connections.
    vercel: bool = False

    @field_validator("database_url")
    @classmethod
    def use_asyncpg(cls, value: str) -> str:
        return asyncpg_url(value)

    @property
    def database_pool_size(self) -> int:
        return 2 if self.vercel else 5

    @property
    def api_prefix(self) -> str:
        """Path the API is served under. Locally, nginx (or Vite) removes `/api`
        before forwarding; Vercel forwards the path unchanged."""
        return "/api" if self.vercel else ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
