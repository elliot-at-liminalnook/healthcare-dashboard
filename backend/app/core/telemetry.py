"""OpenTelemetry tracing and log export.

Requests and SQL queries are always traced, so logs carry trace ids and an
incoming `traceparent` header (sent by the frontend) joins the browser's trace.
Traces and logs are exported over OTLP only when `OTEL_EXPORTER_OTLP_ENDPOINT`
is set; without it nothing leaves the process.
"""

import logging
from collections.abc import Callable

from fastapi import FastAPI
from opentelemetry.exporter.otlp.proto.http._log_exporter import OTLPLogExporter
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.asyncpg import AsyncPGInstrumentor
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.logging.handler import LoggingHandler
from opentelemetry.sdk._logs import LoggerProvider
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from app.core.config import Settings

# Health checks run every few seconds and would drown out real requests.
UNTRACED_PATHS = ("/health",)


def setup_telemetry(app: FastAPI, settings: Settings) -> Callable[[], None]:
    """Instrument the app and the database driver. Returns a function that flushes
    and shuts down the exporters, to be called when the app stops."""
    resource = Resource.create({"service.name": settings.service_name})
    tracer_provider = TracerProvider(resource=resource)
    shutdown_hooks: list[Callable[[], None]] = [tracer_provider.shutdown]

    if endpoint := settings.otel_exporter_otlp_endpoint:
        endpoint = endpoint.rstrip("/")
        tracer_provider.add_span_processor(
            BatchSpanProcessor(OTLPSpanExporter(endpoint=f"{endpoint}/v1/traces"))
        )
        logger_provider = LoggerProvider(resource=resource)
        logger_provider.add_log_record_processor(
            BatchLogRecordProcessor(OTLPLogExporter(endpoint=f"{endpoint}/v1/logs"))
        )
        handler = LoggingHandler(logger_provider=logger_provider)
        # Do not export OpenTelemetry's own log messages through OpenTelemetry.
        handler.addFilter(lambda record: not record.name.startswith("opentelemetry"))
        logging.getLogger().addHandler(handler)
        # Detach the handler first, so nothing is logged into a provider that has shut down.
        shutdown_hooks.append(lambda: logging.getLogger().removeHandler(handler))
        shutdown_hooks.append(logger_provider.shutdown)

    FastAPIInstrumentor.instrument_app(
        app,
        tracer_provider=tracer_provider,
        excluded_urls=",".join(UNTRACED_PATHS),
        # One span per request is enough; skip the per-message ASGI spans.
        exclude_spans=["receive", "send"],
    )
    # SQL is traced at the driver: the SQLAlchemy instrumentation does not support 2.1 yet.
    AsyncPGInstrumentor().instrument(tracer_provider=tracer_provider)

    def shutdown() -> None:
        for hook in shutdown_hooks:
            hook()

    return shutdown
