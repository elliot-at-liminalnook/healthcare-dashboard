FROM python:3.14-slim

COPY --from=ghcr.io/astral-sh/uv:0.13.8 /uv /bin/uv

# The virtualenv lives outside /app so a bind-mounted source tree cannot hide it.
ENV UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN useradd --create-home --uid 1000 app && mkdir /opt/venv /app && chown app:app /opt/venv /app
WORKDIR /app
USER app

# Install dependencies first so this layer is cached until the lockfile changes.
COPY --chown=app:app pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev

COPY --chown=app:app . .

EXPOSE 8000
# Apply migrations, load sample data into an empty database, then serve.
CMD ["sh", "-c", "alembic upgrade head && python -m scripts.seed && uvicorn app.main:app --host 0.0.0.0 --port 8000 --no-access-log"]
