# Healthcare Dashboard

A patient management dashboard for a medical practice. The frontend is React and TypeScript, the backend is FastAPI, and the data is stored in PostgreSQL.

**[Open the live dashboard →](https://healthcare-dashboard-eight-delta.vercel.app)** It runs on sample data that is restored on every deploy, so feel free to add, edit and delete patients.

[![CI](https://github.com/elliot-at-liminalnook/healthcare-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/elliot-at-liminalnook/healthcare-dashboard/actions/workflows/ci.yml)

## Run locally

Docker with Compose is the only requirement.

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| App | http://localhost:8080 |
| API | http://localhost:8000 (interactive documentation at `/docs`) |
| Logs and traces (Grafana) | http://localhost:3000 |

No configuration is needed. To change ports or database credentials, copy `.env.example` to `.env` and edit it.

When the backend starts, it applies the database migrations and, if the database is empty, loads 200 sample patients and their notes from [`backend/fixtures/patients.json`](backend/fixtures/patients.json). All of that data is invented. To go back to it after making changes, run `docker compose down -v` and start the stack again.

## Feature tour

Each recording below is produced by a Playwright test in [`e2e/specs`](e2e/specs) that uses the running app and checks what it sees, so the recordings are also the end-to-end tests.

### Dashboard and patient list

![The dashboard, the patient list with search, sorting and paging, a patient page, and the 404 page](docs/demos/dashboard.gif)

Start on the dashboard and click one of the counts, and you land on the patient list already filtered to that status. From there you can search by name, sort by any column, page through all 200 patients, and open any patient's page.

- The server does the searching, sorting and paging, so the browser only ever holds one page of patients.
- Searching doesn't blank the list. The current rows stay where they are until the new ones arrive.
- The search, sort and page are all in the URL. You can share a link to exactly what you're looking at, and the Back button takes you back to it.

### Patient notes

![A patient's summary, adding a clinical note, the summary being regenerated, and deleting the note](docs/demos/notes.gif)

Every patient page opens with a short written summary, built from their profile and their notes. When you add a note, it appears at the top of the list and the summary is rewritten to include it. Delete the note and the summary changes back.

- The summary is built from a template, not a language model, so it needs no API key and no patient data leaves the app. The code that writes it ([`summary.py`](backend/app/services/summary.py)) sits behind a small interface, so a language model could replace it later without changing the endpoint.
- A note can only be reached through its own patient. One patient's URL can't be used to read or delete another patient's notes.

### Adding and editing patients

![Adding a patient with validation errors from the browser and the server, a failed connection, then saving, editing and deleting](docs/demos/forms.gif)

One form handles both adding and editing a patient. It catches missing fields and badly formatted ones as you fill it in. When the server rejects something the browser had no way to check, the message appears under the field it's about. If the connection drops while saving, the form says so and keeps everything you typed.

- The validation rules are written once, in the backend ([`backend/app/schemas`](backend/app/schemas)). The form's checks are generated from the API's schema, so the two always agree.
- A few rules depend on today's date, which that schema can't express. The server checks those, and the form shows its answer.

### Logging and tracing

![A phone number is changed in the app, then the matching log lines and the trace are shown in Grafana](docs/demos/tracing.gif)

The browser and the backend both write structured logs. Every API call carries a trace ID from the browser to the API, and both sides write that ID into their logs. In the recording, a patient's phone number is changed and saved. Searching Grafana for that request's trace ID finds two log lines, one from the browser and one from the API, and the trace follows the request down to the SQL `UPDATE` that changed the row.

To look at this locally, open Grafana at http://localhost:3000, go to Explore, and choose Loki for logs (the query is `{service_name=~"healthcare-.+"}`) or Tempo for traces. To turn it off, set `OTLP_ENDPOINT=` (empty) in `.env`. The app works without Grafana. Health checks are not logged or traced, and patient data should not be written to logs or trace attributes.

## Stack

| Area | Choice |
|---|---|
| Frontend | React 19, TypeScript 7, Vite 8, Mantine 9, TanStack Query, React Router |
| State management | Data from the server is held by TanStack Query. The patient list's view state is held in the URL. Form state is held by `@mantine/form`. The app does not use a global store. |
| API client | TanStack Query hooks and Zod schemas, generated from the backend's OpenAPI schema by Orval |
| Backend | Python 3.14, FastAPI, SQLAlchemy 2 (async, with asyncpg), Alembic, uv |
| Database | PostgreSQL 18 |
| Logging and tracing | structlog and OpenTelemetry in the backend, the OpenTelemetry web SDK in the browser, and Grafana to view them |
| Testing and tooling | pytest, Ruff, oxlint, Prettier, Playwright, GitHub Actions |

## Project layout

```
backend/
  app/
    api/routes/   route handlers, one module per resource
    schemas/      request and response models, including the validation rules
    services/     database queries and writes
    models/       SQLAlchemy models
    core/         settings, database session, logging, telemetry
  fixtures/  migrations/  scripts/  tests/
frontend/src/
  api/            fetch wrapper, and the generated client in generated/
  app/            router, layout, theme, query client, error pages
  features/       one folder per feature: dashboard, patients, notes
  telemetry/      logger and OpenTelemetry setup
e2e/              Playwright tests, which also record the GIFs above
```

## API

The API has endpoints for patients, for a patient's notes, and for a patient's summary. The interactive documentation lists all of them with their request and response schemas. It is at `/docs` when running locally, and [here on the live site](https://healthcare-dashboard-eight-delta.vercel.app/api/docs).

`GET /patients` accepts these query parameters, and returns `{items, total, page, page_size}`:

| Parameter | Meaning |
|---|---|
| `page`, `page_size` | Which page to return, and how many patients per page (up to 100) |
| `search` | Words to look for in the first or last name |
| `status` | `active`, `inactive` or `critical` |
| `sort_by` | `name`, `age`, `last_visit` or `status` |
| `sort_order` | `asc` or `desc` |

An unknown id returns 404. Invalid input returns 422 with one entry for each problem. Each entry names the field, an error code and a message:

```json
{ "loc": ["body", "date_of_birth"], "type": "date_in_future", "msg": "Cannot be in the future" }
```

The data is stored in two tables, `patients` and `patient_notes`, which are defined in [`backend/app/models/patient.py`](backend/app/models/patient.py). A patient's age is calculated from their date of birth and is not stored. Deleting a patient also deletes their notes.

## Development

`make dev` starts the same stack with the source code mounted into the containers. Saving a file in `backend/app` restarts the API, and saving a file in `frontend/src` updates the page in the browser without a reload.

```bash
make dev      # start the stack with hot reload
make test     # run the backend tests against a separate test database
make lint     # run Ruff, oxlint and Prettier
make client   # regenerate the frontend API client after changing the API
make lock     # update backend/uv.lock after changing dependencies
make demos    # run the end-to-end tests and re-record the GIFs (the stack must be running)
```

The OpenAPI schema and the client generated from it are both committed, so a change to the API is visible in code review.

[GitHub Actions](.github/workflows/ci.yml) runs on every push and pull request. It lints and tests the backend and checks that the migrations match the models. It lints, type-checks and builds the frontend. It checks that the committed API client matches a freshly generated one. Finally, it starts the app with Docker Compose and runs the end-to-end tests against it.

The live demo runs on Vercel, with PostgreSQL from Neon, and every push to `main` is deployed. [`vercel.json`](vercel.json) defines the frontend and the API as two services in one project. Before each deploy, [`scripts/release.py`](backend/scripts/release.py) applies the database migrations and restores the sample data. Log and trace export is turned off there, because the demo has no Grafana.
