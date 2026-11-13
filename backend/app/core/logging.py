"""Structured logging.

Application code logs through structlog (`structlog.get_logger()`), which hands
records to the standard library. One handler renders every record, including
those from uvicorn and SQLAlchemy, as a JSON line on stderr with the current
trace id attached, so a log line can be matched to its trace.
"""

import logging
import sys

import structlog
from opentelemetry import trace
from structlog.typing import EventDict, WrappedLogger


def add_trace_context(_: WrappedLogger, __: str, event_dict: EventDict) -> EventDict:
    """Attach the active OpenTelemetry trace and span ids, when there is one."""
    context = trace.get_current_span().get_span_context()
    if context.is_valid:
        event_dict["trace_id"] = format(context.trace_id, "032x")
        event_dict["span_id"] = format(context.span_id, "016x")
    return event_dict


def drop_color_message(_: WrappedLogger, __: str, event_dict: EventDict) -> EventDict:
    """Remove the ANSI-coloured duplicate of the message that uvicorn attaches."""
    event_dict.pop("color_message", None)
    return event_dict


def configure_logging(level: str = "INFO") -> None:
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.filter_by_level,
            structlog.processors.StackInfoRenderer(),
            # Pass the event to the standard library as the message and the
            # remaining key/value pairs as `extra`, so every handler sees them.
            structlog.stdlib.render_to_log_kwargs,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    # Human-readable output in a terminal, JSON lines everywhere else.
    renderer = (
        structlog.dev.ConsoleRenderer()
        if sys.stderr.isatty()
        else structlog.processors.JSONRenderer()
    )
    handler = logging.StreamHandler()
    handler.setFormatter(
        structlog.stdlib.ProcessorFormatter(
            foreign_pre_chain=[
                structlog.stdlib.add_log_level,
                structlog.stdlib.add_logger_name,
                structlog.stdlib.ExtraAdder(),
                drop_color_message,
                structlog.processors.TimeStamper(fmt="iso", utc=True),
                add_trace_context,
            ],
            processors=[
                structlog.stdlib.ProcessorFormatter.remove_processors_meta,
                structlog.processors.format_exc_info,
                renderer,
            ],
        )
    )

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)

    # uvicorn installs its own handlers; route its loggers through ours instead.
    # Its access log stays off (`--no-access-log`): the request middleware covers it.
    for name in ("uvicorn", "uvicorn.error"):
        uvicorn_logger = logging.getLogger(name)
        uvicorn_logger.handlers.clear()
        uvicorn_logger.propagate = True
