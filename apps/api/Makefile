# ==============================================================================
# LokaSlip API - run this app by itself. Usage: cd apps/api && make help
# ==============================================================================

.DEFAULT_GOAL := help
.PHONY: help env infra-up infra-down infra-reset migrate dev start build typecheck test clean

COMPOSE := docker compose -f docker-compose.yml

# Load .env into every recipe when it exists
ifneq (,$(wildcard .env))
include .env
export
endif

# Display this help summary listing available Makefile targets
help: ## Display this help summary listing available Makefile targets
	@grep -hE '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  %-12s %s\n", $$1, $$2}'

# Create .env from .env.example, reusing Google credentials and admin emails from the repo-root .env when present
env: ## Create .env from .env.example (copies Google credentials from ../../.env when present)
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		for key in GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET ADMIN_EMAILS; do \
			value=$$(grep -E "^$$key=" ../../.env 2>/dev/null | head -n 1 | cut -d= -f2-); \
			if [ -n "$$value" ]; then \
				awk -v k="$$key" -v v="$$value" 'BEGIN{FS=OFS="="} $$1==k{print k"="v; next} {print}' .env > .env.tmp && mv .env.tmp .env; \
			fi; \
		done; \
		echo "Created .env. Review it and make sure the Google credentials are set."; \
	else \
		echo ".env already exists; skipping."; \
	fi

# Start Postgres (5433), Redis (6380), RabbitMQ (5673) and Garage (3910) on localhost and wait until healthy
infra-up: ## Start the local Postgres, Redis, RabbitMQ and Garage containers and wait until healthy
	$(COMPOSE) up -d --wait

# Stop the local infrastructure containers and keep their data
infra-down: ## Stop the local infrastructure containers and keep their data
	$(COMPOSE) down

# Stop the local infrastructure containers and delete their data volumes (destroys local data)
infra-reset: ## Stop the local infrastructure and delete its data volumes (destroys local data)
	$(COMPOSE) down -v

# Apply pending Prisma migrations to the database in DATABASE_URL
migrate: ## Apply pending Prisma migrations to the database in DATABASE_URL
	@test -f .env || { echo ".env is missing; run make env"; exit 1; }
	npx prisma migrate deploy --config prisma.config.ts

# Run the API in watch mode on PORT (default 3000) using .env; needs make infra-up and make migrate first.
# Values in .env win over environment variables, so override on the command line: make dev PORT=3999
dev: ## Run the API in watch mode using .env (needs make infra-up and make migrate first)
	@test -f .env || { echo ".env is missing; run make env"; exit 1; }
	@if lsof -nP -iTCP:$(or $(PORT),3000) -sTCP:LISTEN >/dev/null 2>&1; then \
		echo "Port $(or $(PORT),3000) is already in use (for the compose stack: docker compose stop api)."; exit 1; \
	fi
	npx tsx watch --env-file=.env src/server.ts

# Run the compiled API from dist (run make build first)
start: ## Run the compiled API from dist using .env (run make build first)
	@test -f .env || { echo ".env is missing; run make env"; exit 1; }
	node --env-file=.env dist/server.js

# Compile the API TypeScript into dist
build: ## Compile the API TypeScript into dist
	npm run build

# Typecheck the API without emitting files
typecheck: ## Typecheck the API without emitting files
	npx tsc -p tsconfig.json --noEmit

# Run the API tests (unit and integration; integration tests need Docker)
test: ## Run the API tests (unit and integration; integration tests need Docker)
	cd ../.. && npx vitest run apps/api

# Remove compiled output
clean: ## Remove compiled output
	rm -rf dist
