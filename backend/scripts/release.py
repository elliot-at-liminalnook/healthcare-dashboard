"""Prepare the database for a deployment: apply migrations, then load the sample data.

Vercel runs this as the backend's build step (see `[tool.vercel.scripts]` in
pyproject.toml), before the new version starts serving. A production deployment
also restores the sample data, so the public demo returns to its starting state.

Usage (from `backend/`): python -m scripts.release
"""

import asyncio
import os
from pathlib import Path

import structlog
from alembic import command
from alembic.config import Config

from app.core.config import get_settings
from app.core.logging import configure_logging
from scripts.seed import seed

BACKEND = Path(__file__).resolve().parent.parent

logger = structlog.get_logger(__name__)


def migrate() -> None:
    config = Config(str(BACKEND / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND / "migrations"))
    command.upgrade(config, "head")


if __name__ == "__main__":
    if not (os.environ.get("DATABASE_URL_UNPOOLED") or os.environ.get("DATABASE_URL")):
        raise SystemExit(
            "No database is connected: set DATABASE_URL (or DATABASE_URL_UNPOOLED) "
            "for this environment before deploying."
        )
    migrate()
    # Alembic reconfigures logging while it runs, so set ours up afterwards.
    configure_logging(get_settings().log_level)
    reset = os.environ.get("VERCEL_ENV") == "production"
    logger.info("release", reset_sample_data=reset)
    asyncio.run(seed(reset=reset))
