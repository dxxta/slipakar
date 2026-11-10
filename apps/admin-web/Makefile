# ==============================================================================
# Slipakar admin web - run this app by itself. Usage: cd apps/admin-web && make help
# ==============================================================================

.DEFAULT_GOAL := help
.PHONY: help env dev build typecheck test clean

# Load .env into every recipe when it exists
ifneq (,$(wildcard .env))
include .env
export
endif

PORT ?= 4301
API_URL ?= http://localhost:3000

# Display this help summary listing available Makefile targets
help: ## Display this help summary listing available Makefile targets
	@grep -hE '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  %-10s %s\n", $$1, $$2}'

# Create .env from .env.example
env: ## Create .env from .env.example
	@if [ ! -f .env ]; then cp .env.example .env && echo "Created .env."; else echo ".env already exists; skipping."; fi

# Serve the app with live reload on PORT, proxying API calls to API_URL (start the API first: cd ../api && make dev)
dev: ## Serve the app with live reload on PORT and proxy API calls to API_URL
	@if lsof -nP -iTCP:$(PORT) -sTCP:LISTEN >/dev/null 2>&1; then echo "Port $(PORT) is already in use."; exit 1; fi
	npx ng serve --port $(PORT) --proxy-config proxy.conf.local.cjs

# Build the production bundle into dist
build: ## Build the production bundle into dist
	npx ng build

# Typecheck the application sources without emitting files
typecheck: ## Typecheck the application sources without emitting files
	npx tsc -p tsconfig.app.json --noEmit

# Run the unit tests once (no watch mode)
test: ## Run the unit tests once (no watch mode)
	CI=1 npx ng test

# Remove build output and the Angular cache
clean: ## Remove build output and the Angular cache
	rm -rf dist .angular
