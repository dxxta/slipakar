# ==============================================================================
# LokaSlip landing web - run this app by itself. Usage: cd apps/landing-web && make help
# ==============================================================================

.DEFAULT_GOAL := help
.PHONY: help env dev build typecheck test clean

ifneq (,$(wildcard .env))
include .env
export
endif

PORT ?= 4302
LANDING_APP_URL ?= http://localhost:4300
LANDING_SITE_URL ?= http://localhost:$(PORT)
LANDING_ADMIN_URL ?= http://localhost:4301
export LANDING_APP_URL LANDING_SITE_URL LANDING_ADMIN_URL

# Display this help summary listing available Makefile targets
help: ## Display this help summary listing available Makefile targets
	@grep -hE '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  %-10s %s\n", $$1, $$2}'

# Create .env from .env.example
env: ## Create .env from .env.example
	@if [ ! -f .env ]; then cp .env.example .env && echo "Created .env."; else echo ".env already exists; skipping."; fi

# Serve the landing web app with live reload
dev: ## Serve the landing web app with live reload on PORT
	@if lsof -nP -iTCP:$(PORT) -sTCP:LISTEN >/dev/null 2>&1; then echo "Port $(PORT) is already in use."; exit 1; fi
	@echo "Sign in -> $(LANDING_APP_URL), admin -> $(LANDING_ADMIN_URL)"
	npx ng serve --port $(PORT)

# Build the production SSR bundle
build: ## Build the production SSR bundle into dist
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
