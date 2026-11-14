.PHONY: up dev down test lint client lock demos

up: ## Build and start the full stack
	docker compose up --build

dev: ## Start the stack with hot reload for the backend and the frontend
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build --renew-anon-volumes

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

demos: ## Run the end-to-end demo specs and re-record the GIFs in docs/demos (stack must be up). SPEC=part-2 records one.
	docker build -q -t healthcare-e2e e2e
	docker run --rm --network host --ipc host -u "$$(id -u):$$(id -g)" -e HOME=/tmp \
		-e GIF_DIR=/out -e RESULTS_DIR=/tmp/results -v "$(CURDIR)/docs/demos:/out" healthcare-e2e $(SPEC)

lock: ## Update backend/uv.lock after changing dependencies in pyproject.toml
	docker compose run --rm --no-deps -v "$(CURDIR)/backend:/app" backend uv lock
