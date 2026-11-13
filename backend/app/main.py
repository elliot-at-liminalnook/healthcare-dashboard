from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.routing import APIRoute

from app.api.middleware import log_requests
from app.api.router import api_router
from app.core.config import get_settings
from app.core.db import engine
from app.core.logging import configure_logging
from app.core.telemetry import setup_telemetry


def operation_id(route: APIRoute) -> str:
    """Use the handler name as the OpenAPI operation id, so the generated
    TypeScript client gets readable function names (`get_health` -> `getHealth`)."""
    return route.name


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        yield
        await engine.dispose()
        shutdown_telemetry()

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        lifespan=lifespan,
        generate_unique_id_function=operation_id,
    )
    app.middleware("http")(log_requests)
    app.include_router(api_router)
    shutdown_telemetry = setup_telemetry(app, settings)
    return app


app = create_app()
