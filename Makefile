.DEFAULT_GOAL := help

# ==============================================================================
# Variables
# ==============================================================================
COMPOSE ?= docker compose
ENV_FILE ?= .env
COMPOSE_PROJECT ?= lokaslip
SERVICE ?= api
FILE ?=
CONFIRM ?=
WEB_USER_URL ?= http://localhost:8080
WEB_ADMIN_URL ?= http://localhost:8081

.PHONY: help install env secrets dev-api dev-admin dev-user typecheck lint test test-api-file test-admin test-user test-all check build docker-build docker-build-web db-generate db-migrate-dev db-migrate-deploy db-studio seed-demo up up-build down down-volumes ps logs restart config playwright-install e2e smoke-web clean

# ==============================================================================
# Help
# ==============================================================================

# Display this help summary listing available Makefile targets
help: ## Display this help summary listing available Makefile targets
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z0-9_-]+:.*?## / {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# ==============================================================================
# SETUP
# ==============================================================================

# Install repository dependencies across all workspaces using npm ci
install: ## Install repository dependencies across all workspaces using npm ci
	npm ci

# Initialize local .env from .env.example if missing and remind to populate secrets
env: ## Initialize local .env from .env.example if missing and remind to populate secrets
	@if [ ! -f $(ENV_FILE) ]; then \
		cp .env.example $(ENV_FILE); \
		echo "Created $(ENV_FILE) from .env.example."; \
		echo "Please review $(ENV_FILE) and replace all placeholder values."; \
	else \
		echo "$(ENV_FILE) already exists; skipping copy."; \
	fi

# Generate cryptographically secure secrets for production and compose deployment
secrets: ## Generate cryptographically secure secrets for production and compose deployment
	@echo "APP_ENCRYPTION_KEY=$$(openssl rand -hex 32)"
	@echo "S3_ACCESS_KEY=GK$$(openssl rand -hex 12)"
	@echo "S3_SECRET_KEY=$$(openssl rand -hex 32)"
	@echo "GARAGE_RPC_SECRET=$$(openssl rand -hex 32)"
	@echo "GARAGE_ADMIN_TOKEN=$$(openssl rand -hex 24)"

# ==============================================================================
# DEVELOPMENT
# ==============================================================================

# Start the API service in development watch mode
dev-api: ## Start the API service in development watch mode
	npm run dev:api

# Start the admin web frontend in development mode
dev-admin: ## Start the admin web frontend in development mode
	npm run dev:admin

# Start the user web frontend in development mode
dev-user: ## Start the user web frontend in development mode
	npm run dev:user

# ==============================================================================
# QUALITY
# ==============================================================================

# Run TypeScript typechecking across all workspace projects
typecheck: ## Run TypeScript typechecking across all workspace projects
	npm run typecheck

# Run ESLint across the codebase
lint: ## Run ESLint across the codebase
	npm run lint

# Run API unit and integration test suite using Vitest (requires Docker for containers)
test: ## Run API unit and integration test suite using Vitest (requires Docker for containers)
	npm test

# Run a specific API test spec file passed via FILE=<path>
test-api-file: ## Run a specific API test spec file passed via FILE=<path>
	@if [ -z "$(FILE)" ]; then \
		echo "Error: FILE variable is required. Example: make test-api-file FILE=apps/api/src/internal/storage/storage.spec.ts"; \
		exit 1; \
	fi
	npx vitest run $(FILE)

# Run unit tests for the admin web frontend
test-admin: ## Run unit tests for the admin web frontend
	npm run test:admin

# Run unit tests for the user web frontend
test-user: ## Run unit tests for the user web frontend
	npm run test:user

# Run all test suites across the API and frontend applications
test-all: ## Run all test suites across the API and frontend applications
	npm test
	npm run test:admin
	npm run test:user

# Run all quality checks: typechecking, linting, and all test suites
check: ## Run all quality checks: typechecking, linting, and all test suites
	npm run typecheck
	npm run lint
	$(MAKE) test-all

# ==============================================================================
# BUILD
# ==============================================================================

# Build all TypeScript packages and applications across the workspace
build: ## Build all TypeScript packages and applications across the workspace
	npm run build

# Build the production Docker image for the API service
docker-build: ## Build the production Docker image for the API service
	docker build -f apps/api/Dockerfile -t lokaslip-api:dev .

# Build the combined production image that serves user-web on 8080 and admin-web on 8081
docker-build-web: ## Build the combined production Docker image for both web apps
	docker build -f infra/web/Dockerfile -t lokaslip-web:dev .

# ==============================================================================
# DATABASE
# ==============================================================================

# Generate the Prisma Client from prisma/schema.prisma
db-generate: ## Generate the Prisma Client from prisma/schema.prisma
	npx prisma generate --config apps/api/prisma.config.ts

# Create and apply a new Prisma database migration in development
db-migrate-dev: ## Create and apply a new Prisma database migration in development
	npx prisma migrate dev --config apps/api/prisma.config.ts

# Deploy pending Prisma database migrations to the target database
db-migrate-deploy: ## Deploy pending Prisma database migrations to the target database
	npx prisma migrate deploy --config apps/api/prisma.config.ts

# Launch Prisma Studio to browse and edit database records
db-studio: ## Launch Prisma Studio to browse and edit database records
	npx prisma studio --config apps/api/prisma.config.ts

# Seed example payroll demo project idempotently for administrator
seed-demo: ## Seed example payroll demo project idempotently for administrator
	npx tsx --env-file=$(ENV_FILE) apps/api/scripts/seed-demo.ts

# ==============================================================================
# DOCKER
# ==============================================================================

# Start all Docker Compose stack services in the background
up: ## Start all Docker Compose stack services in the background
	$(COMPOSE) -p $(COMPOSE_PROJECT) --env-file $(ENV_FILE) up -d

# Rebuild images and start all Docker Compose stack services in the background
up-build: ## Rebuild images and start all Docker Compose stack services in the background
	$(COMPOSE) -p $(COMPOSE_PROJECT) --env-file $(ENV_FILE) up -d --build

# Stop and remove Docker Compose containers and networks while preserving volumes
down: ## Stop and remove Docker Compose containers and networks while preserving volumes
	$(COMPOSE) -p $(COMPOSE_PROJECT) --env-file $(ENV_FILE) down

# Stop and remove containers and delete all data volumes (WARNING: destroys all persistent data)
down-volumes: ## Stop and remove containers and delete all data volumes (WARNING: destroys all persistent data)
	@if [ "$(CONFIRM)" != "yes" ]; then \
		echo "WARNING: This will permanently delete all database and object storage volumes!"; \
		echo "Re-run with CONFIRM=yes to execute: make down-volumes CONFIRM=yes"; \
		exit 1; \
	fi
	$(COMPOSE) -p $(COMPOSE_PROJECT) --env-file $(ENV_FILE) down -v

# List running containers, including the combined user/admin web service, in the Docker Compose stack
ps: ## List running containers in the Docker Compose stack
	$(COMPOSE) -p $(COMPOSE_PROJECT) --env-file $(ENV_FILE) ps

# View and tail logs for a service (default: SERVICE=api; use SERVICE=web for Nginx)
logs: ## View and tail logs for a service (default: SERVICE=api)
	$(COMPOSE) -p $(COMPOSE_PROJECT) --env-file $(ENV_FILE) logs -f $(SERVICE)

# Restart a service container in the Docker Compose stack (default: SERVICE=api)
restart: ## Restart a service container in the Docker Compose stack (default: SERVICE=api)
	$(COMPOSE) -p $(COMPOSE_PROJECT) --env-file $(ENV_FILE) restart $(SERVICE)

# Validate and render the Docker Compose configuration against the specified env file
config: ## Validate and render the Docker Compose configuration against the specified env file
	$(COMPOSE) -p $(COMPOSE_PROJECT) --env-file $(ENV_FILE) config

# ==============================================================================
# E2E
# ==============================================================================

# Install Playwright browser binaries and dependencies
playwright-install: ## Install Playwright browser binaries and dependencies
	npx playwright install chromium

# Run end-to-end browser tests using Playwright
e2e: ## Run end-to-end browser tests using Playwright
	npx playwright test

# Check running production web ports for safe cache variants, API MIME types, and SPA deep links
smoke-web: ## Check running user and admin web apps and their API proxy routes
	@set -eu; \
	tmp=$$(mktemp -d); trap 'rm -rf "$$tmp"' EXIT; \
	check_header() { file="$$1"; name="$$2"; expected="$$3"; \
		if ! grep -Fqi "$$name: $$expected" "$$file"; then \
			echo "Missing header $$name: $$expected in $$file" >&2; return 1; fi; }; \
	check_vary_accept() { file="$$1"; \
		if [ "$$(awk 'tolower(substr($$0, 1, 5)) == "vary:" { count++; header_value=tolower($$0); sub(/^[^:]*:[[:space:]]*/, "", header_value); sub(/\r$$/, "", header_value); if (header_value == "accept, accept-encoding") found=1 } END { if (count == 1 && found) print "yes" }' "$$file")" != yes ]; then \
			echo "Expected exactly one Vary: Accept in $$file" >&2; return 1; fi; }; \
	request() { url="$$1"; accept="$$2"; prefix="$$3"; \
		status=$$(curl -sS -D "$$tmp/$$prefix.headers" -o "$$tmp/$$prefix.body" -w '%{http_code}' -H "Accept: $$accept" "$$url"); \
		printf '%s' "$$status" > "$$tmp/$$prefix.status"; }; \
	assert_status() { actual=$$(cat "$$tmp/$$1.status"); if [ "$$actual" != "$$2" ]; then echo "Expected HTTP $$2, got $$actual for $$1" >&2; return 1; fi; }; \
	request "$(WEB_USER_URL)/projects/abc/templates?page=1&limit=20&sortBy=createdAt&sortDir=desc" 'text/html' user-html; \
	assert_status user-html 200; check_header "$$tmp/user-html.headers" Content-Type 'text/html'; \
	check_header "$$tmp/user-html.headers" Vary Accept; check_header "$$tmp/user-html.headers" Cache-Control no-cache; \
	grep -q '<app-root' "$$tmp/user-html.body" || { echo 'User project deep link did not serve the Angular app' >&2; exit 1; }; \
	request "$(WEB_USER_URL)/projects/abc/templates?page=1&limit=20&sortBy=createdAt&sortDir=desc" 'application/json' user-api; \
	assert_status user-api 401; check_header "$$tmp/user-api.headers" Content-Type 'application/json; charset=utf-8'; \
	check_vary_accept "$$tmp/user-api.headers"; check_header "$$tmp/user-api.headers" Cache-Control no-store; \
	request "$(WEB_USER_URL)/projects?page=1&limit=100&sortBy=createdAt&sortDir=desc" 'application/json' user-projects-100; \
	assert_status user-projects-100 401; check_header "$$tmp/user-projects-100.headers" Content-Type 'application/json; charset=utf-8'; \
	check_vary_accept "$$tmp/user-projects-100.headers"; check_header "$$tmp/user-projects-100.headers" Cache-Control no-store; \
	request "$(WEB_USER_URL)/notifications/unread-count" 'application/json' unread-api; \
	assert_status unread-api 401; check_vary_accept "$$tmp/unread-api.headers"; \
	check_header "$$tmp/unread-api.headers" Cache-Control no-store; \
	request "$(WEB_USER_URL)/docs" 'text/html' user-docs; \
	assert_status user-docs 401; \
	grep -Fqi "sha256-lmba+p2ZA26l0frITlGt+zVDpF9V987twNchN6VQgQ8=" "$$tmp/user-docs.headers" || { echo 'User /docs response is missing the Scalar script hash' >&2; exit 1; }; \
	check_header "$$tmp/user-docs.headers" X-Content-Type-Options nosniff; \
	check_header "$$tmp/user-docs.headers" X-Frame-Options DENY; \
	check_header "$$tmp/user-docs.headers" Referrer-Policy strict-origin-when-cross-origin; \
	check_header "$$tmp/user-docs.headers" Permissions-Policy 'camera=(), microphone=(), geolocation=()'; \
	request "$(WEB_ADMIN_URL)/flags" 'text/html' admin-html; \
	assert_status admin-html 200; check_header "$$tmp/admin-html.headers" Content-Type 'text/html'; \
	grep -q '<app-root' "$$tmp/admin-html.body" || { echo 'Admin deep link did not serve the Angular app' >&2; exit 1; }; \
	request "$(WEB_ADMIN_URL)/admin/config" 'application/json' admin-api; \
	assert_status admin-api 401; check_header "$$tmp/admin-api.headers" Content-Type 'application/json; charset=utf-8'; \
	request "$(WEB_ADMIN_URL)/admin/config" 'text/html' admin-api-html-accept; \
	assert_status admin-api-html-accept 401; check_header "$$tmp/admin-api-html-accept.headers" Content-Type 'application/json; charset=utf-8'; \
	request "$(WEB_ADMIN_URL)/docs" 'text/html' admin-docs; \
	assert_status admin-docs 401; \
	grep -Fqi "sha256-lmba+p2ZA26l0frITlGt+zVDpF9V987twNchN6VQgQ8=" "$$tmp/admin-docs.headers" || { echo 'Admin /docs response is missing the Scalar script hash' >&2; exit 1; }; \
	check_header "$$tmp/admin-docs.headers" X-Content-Type-Options nosniff; \
	check_header "$$tmp/admin-docs.headers" X-Frame-Options DENY; \
	check_header "$$tmp/admin-docs.headers" Referrer-Policy strict-origin-when-cross-origin; \
	check_header "$$tmp/admin-docs.headers" Permissions-Policy 'camera=(), microphone=(), geolocation=()'; \
	echo 'Web smoke checks passed for user and admin apps.'

# ==============================================================================
# CLEAN
# ==============================================================================

# Clean build artifacts, .angular caches, and tsbuildinfo files in apps and packages
clean: ## Clean build artifacts, .angular caches, and tsbuildinfo files in apps and packages
	@echo "Removing build artifacts and caches..."
	@find apps packages -maxdepth 3 \( -name "dist" -o -name ".angular" \) -not -path "*/node_modules/*" -exec echo "Removing directory: {}" \; -exec rm -rf {} +
	@find apps packages -name "*.tsbuildinfo" -not -path "*/node_modules/*" -exec echo "Removing file: {}" \; -exec rm -f {} +
	@echo "Clean complete."
