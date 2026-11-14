import time
from collections.abc import Awaitable, Callable

import structlog
from fastapi import Request, Response

from app.core.config import get_settings
from app.core.telemetry import UNTRACED_PATHS

logger = structlog.get_logger(__name__)


async def log_requests(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """Log one line per request with its method, path, status and duration."""
    if request.url.path.removeprefix(get_settings().api_prefix) in UNTRACED_PATHS:
        return await call_next(request)

    start = time.perf_counter()
    fields = {"method": request.method, "path": request.url.path}
    try:
        response = await call_next(request)
    except Exception:
        duration_ms = round((time.perf_counter() - start) * 1000, 1)
        logger.exception("request_failed", **fields, status=500, duration_ms=duration_ms)
        raise

    duration_ms = round((time.perf_counter() - start) * 1000, 1)
    logger.info("request", **fields, status=response.status_code, duration_ms=duration_ms)
    return response
