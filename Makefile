.PHONY: up down test lint client lock

up: ## Build and start the full stack
	docker compose up --build

down: ## Stop the stack
	docker compose down

test: ## Run backend tests (starts the database; uses a separate test database)
	docker compose run --rm backend uv run pytest

lint: ## Lint backend and frontend
	docker compose run --rm --no-deps backend sh -c "uv run ruff check . && uv run ruff format --check ."
	cd frontend && npm run lint && npm run format:check

client: ## Regenerate the typed frontend API client from the backend's OpenAPI schema
	docker compose run --rm --no-deps -T backend python -m scripts.export_openapi > frontend/openapi.json
	cd frontend && npm run generate:client

lock: ## Update backend/uv.lock after changing dependencies in pyproject.toml
	docker compose run --rm --no-deps -v "$(CURDIR)/backend:/app" backend uv lock
