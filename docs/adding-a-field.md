# Adding a field to a patient

The steps below add an optional `preferred_name` to a patient. Other fields and other models work the same way.

The order matters. The model comes first because the migration is generated from it. The schemas come next because the TypeScript is generated from them. The frontend comes last.

## Before you start

You only need to do these once.

- Install the frontend packages. `make client` and `make lint` run them on your machine, not in Docker.

  ```bash
  cd frontend && npm ci
  ```

- Start the stack in dev mode. Your code is mounted into the backend container, so new files are seen without a rebuild.

  ```bash
  make dev
  ```

## 1. Add the column to the model

In [`backend/app/models/patient.py`](../backend/app/models/patient.py):

```python
preferred_name: Mapped[str | None] = mapped_column(String(100))
```

Make the field optional (`| None`) unless every existing row can be given a value. A required field needs a `server_default`, or the migration has to fill in a value for existing rows.

When you save, the API reloads and patient pages return a 500 until step 2 adds the column to the database. That's expected.

## 2. Generate and apply the migration

```bash
docker compose exec backend alembic revision --autogenerate -m "add preferred name"
```

```bash
docker compose exec backend uv run ruff format migrations
```

```bash
docker compose exec backend alembic upgrade head
```

Open the new file in [`backend/migrations/versions/`](../backend/migrations/versions/) and read it before you commit it. It should have one `op.add_column` in `upgrade()` and the matching `op.drop_column` in `downgrade()`. Autogenerate gives you a draft, so check it.

You don't need to apply migrations anywhere else by hand. Every deployment runs `alembic upgrade head` when it starts.

## 3. Add the field to the schemas

In [`backend/app/schemas/patient.py`](../backend/app/schemas/patient.py), add the field once for writing and once for reading:

```python
class PatientWrite(BaseModel):
    ...
    preferred_name: _optional(_text(100)) = None


class PatientRead(PatientListItem):
    ...
    preferred_name: str | None
```

Use the same maximum length as the column (`100` in both places). Nothing checks that they match. If the schema allows more than the column, a long value gets past validation and fails in the database with a 500.

Leave a field out of `PatientWrite` if clients shouldn't set it, or out of `PatientRead` if they shouldn't see it.

## 4. Regenerate the frontend client

```bash
docker compose build backend
```

```bash
make client
```

`make client` reads the API schema from the backend image, not from your files. Without the rebuild it exports the old schema and nothing changes.

This updates `frontend/openapi.json` and the files under `frontend/src/api/generated/`: the TypeScript types, and the Zod rules the form validates against.

## 5. Add it to the form and the patient page

TypeScript only complains about required fields, so for an optional field go through all of these yourself.

In [`frontend/src/features/patients/patientForm.ts`](../frontend/src/features/patients/patientForm.ts):

- `PatientFormValues`: `preferred_name: string`
- `EMPTY_PATIENT`: `preferred_name: ''`
- `toFormValues`: `preferred_name: patient.preferred_name ?? ''`
- `toRequestBody`: `preferred_name: text(values.preferred_name)`

The `toRequestBody` line turns an empty input into `null`. Without it the form sends `''`, which fails the generated rule, so a field the user left blank shows an error.

In [`frontend/src/features/patients/PatientForm.tsx`](../frontend/src/features/patients/PatientForm.tsx):

```tsx
<TextInput label="Preferred name" autoComplete="off" {...field('preferred_name')} />
```

You don't need to write any validation for it. The form already checks every field against the generated schema.

In [`frontend/src/features/patients/PatientDetailPage.tsx`](../frontend/src/features/patients/PatientDetailPage.tsx):

```tsx
<Field label="Preferred name">{patient.preferred_name}</Field>
```

## 6. Test it

Add the field to `VALID_BODY` in [`backend/tests/test_patients.py`](../backend/tests/test_patients.py), and check that it comes back from the create test. Then run the tests:

```bash
docker compose build backend && make test
```

Like `make client`, `make test` runs the code in the image, so it needs the rebuild.

Finally, open a patient in the app, add a preferred name, clear it again, and check that both save.

## What CI catches

| If you forget to | This fails |
|---|---|
| Create the migration | `alembic check` |
| Run `make client` | The generated-client check (`git diff --exit-code`) |
| Format the migration | `ruff format --check` |
| Add a schema field to the model | The API tests |
| Use a new required field in the frontend | `tsc` |
| Add an optional field to the form or page, or the `text()` line | Nothing. Check it in the app. |

## If something goes wrong

**`Can't locate revision identified by '...'`**
The database has a migration that the backend image doesn't have. Rebuild with `docker compose up --build`, or use `make dev`.

**`column patients.preferred_name does not exist`**
The model has the field but the database doesn't. Run step 2.

**`make client` runs but nothing in `generated/` changes**
The backend image is stale. Run `docker compose build backend`, then `make client` again.

**`orval: command not found`**
The frontend packages aren't installed. Run `cd frontend && npm ci`.

**Not using dev mode?**
Replace `docker compose exec backend` in step 2 with `docker compose run --rm -v "$PWD/backend:/app" backend`. The `-v` mounts your code into the container. Without it, the migration is generated from the old model inside a throwaway container, and the file is lost when the container exits. Start the stack afterwards with `docker compose up --build`.
