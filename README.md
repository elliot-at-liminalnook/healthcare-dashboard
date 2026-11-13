# Healthcare Dashboard

A patient management dashboard for a medical practice.

## Run locally

Requires Docker with Compose.

```bash
docker compose up --build
```

| What | URL |
|---|---|
| App | http://localhost:8080 |
| API | http://localhost:8000 (interactive docs at `/docs`) |
| Logs and traces (Grafana) | http://localhost:3000 |

Every setting has a working default. To change ports or database credentials, copy `.env.example` to `.env` and edit it.

On startup the backend applies database migrations, loads 200 sample patients into an empty database, then serves the API. The frontend is served by nginx, which forwards `/api/*` to the backend.

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 19, TypeScript 7, Vite 8, Mantine 9, TanStack Query, React Router |
| API client | Generated from the backend's OpenAPI schema with Orval |
| Backend | Python 3.15, FastAPI, SQLAlchemy 2 (async, asyncpg), Alembic, uv |
| Database | PostgreSQL 18 |
| Logging and tracing | structlog and OpenTelemetry (backend); OpenTelemetry web SDK (frontend); Grafana for viewing |
| Tooling | Ruff and pytest (backend); oxlint and Prettier (frontend) |

## Layout

```
backend/
  app/
    api/routes/   route handlers, one module per resource
    core/         settings, database session, logging, telemetry
    models/       SQLAlchemy models
    main.py       application factory
  fixtures/       patients.json: 200 synthetic patients with clinical notes
  migrations/     Alembic migrations
  scripts/        seed.py, generate_fixture.py, export_openapi.py
  tests/
frontend/
  src/
    api/          http.ts (fetch wrapper) and generated/ (typed client, do not edit)
    app/          router, layout, query client, error pages
    features/     one folder per feature (dashboard, patients)
    telemetry/    logger and OpenTelemetry setup
docker-compose.yml
```

## Data model

| Table | Columns |
|---|---|
| `patients` | `id`, `first_name`, `last_name`, `date_of_birth`, `email`, `phone`, `address_line1`, `address_line2`, `city`, `state`, `postal_code`, `blood_type`, `allergies[]`, `conditions[]`, `status`, `last_visit`, `created_at`, `updated_at` |
| `patient_notes` | `id`, `patient_id`, `timestamp`, `content`, `created_at` |

- Age is computed from `date_of_birth`, never stored.
- `status` is `active`, `inactive` or `critical`; `blood_type` is one of the eight ABO/Rh types or empty when not on file.
- Deleting a patient deletes their notes.

### Sample data

`backend/fixtures/patients.json` holds 200 patients and 448 notes. All of it is synthetic: invented names, `example.com` emails and fictional `555-01xx` phone numbers. It is produced by a seeded generator (`python -m scripts.generate_fixture`), so it is reproducible, and a test fails if the file and generator drift apart. To reload it, remove the database volume: `docker compose down -v`.

## Logging and tracing

Both ends log in a structured way, and one trace follows a request from the browser to the database.

- **Backend:** one JSON log line per request (method, path, status, duration) on stderr, plus anything logged with `structlog.get_logger()`. Every line carries the request's `trace_id`. Requests and SQL queries are traced.
- **Frontend:** `logger` (`src/telemetry/logger.ts`) writes to the console. Failed API calls, render errors and uncaught errors are logged automatically. API calls send a `traceparent` header, so backend logs and spans join the browser's trace.
- **Viewing:** both ends export to the bundled Grafana stack at http://localhost:3000. Use Explore: Loki for logs (`{service_name=~"healthcare-.+"}`), Tempo for traces. The browser's telemetry goes through nginx (`/otlp`), so no extra port is exposed.
- **Turning it off:** set `OTLP_ENDPOINT=` (empty) in `.env`. The app does not depend on Grafana; if it is down, telemetry is dropped.

Health checks are neither logged nor traced. Do not put patient data in log fields or span attributes.

## Development

```bash
make test     # backend tests
make lint     # ruff, oxlint, prettier
make client   # regenerate the typed API client after changing the API
make lock     # update backend/uv.lock after changing dependencies
```

To work on the frontend with hot reload, start the stack, then run the Vite dev server (Node 22+), which proxies `/api` to the backend on port 8000. Set `VITE_TELEMETRY_ENABLED=true` to export telemetry from the dev server to a collector on port 4318.

```bash
cd frontend
npm install
npm run dev
```

### The typed API client

The frontend never hand-writes API calls. `make client` exports the OpenAPI schema from the FastAPI app to `frontend/openapi.json`, and Orval generates typed TanStack Query hooks from it into `frontend/src/api/generated/`. Both are committed, so API changes show up in review as a diff.
