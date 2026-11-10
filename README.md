# Slipakar

![Angular](https://img.shields.io/badge/Angular-DD0031?style=flat&logo=angular&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-5FA04E?style=flat&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat&logo=redis&logoColor=white)
![RabbitMQ](https://img.shields.io/badge/RabbitMQ-FF6600?style=flat&logo=rabbitmq&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat&logo=tailwindcss&logoColor=white)
![Nginx](https://img.shields.io/badge/Nginx-009639?style=flat&logo=nginx&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)
![Prometheus](https://img.shields.io/badge/Prometheus-E6522C?style=flat&logo=prometheus&logoColor=white)
![Grafana](https://img.shields.io/badge/Grafana-F46800?style=flat&logo=grafana&logoColor=white)
![Uptime Kuma](https://img.shields.io/badge/Uptime_Kuma-5CDD8B?style=flat&logo=uptimekuma&logoColor=white)
![Garage S3](https://img.shields.io/badge/Garage_S3-1E1E1E?style=flat)

Slipakar is an open-source, self-hostable platform for personalized bulk email. It lets a company send messages through its own SMTP server and optionally attach a personalized PDF, such as an employee payslip, to each recipient.

The primary use case is HR, finance, or operations uploading a spreadsheet, mapping its columns to a reusable email or PDF template, previewing the result, and sending a campaign without writing code.

## Features

- **Projects, SMTP & Templates**: Projects organize SMTP connections, email templates, uploads, PDF templates, and campaigns. SMTP credentials are configured per project and encrypted at rest with `APP_ENCRYPTION_KEY` (never returned in API views). Email templates use safe `{{placeholder}}` substitution without evaluating expressions or code.
- **Data Upload, Mapping & PDF Builder**: Upload recipient data from CSV, XLSX, or JSON files and map columns to template placeholders. Build personalized PDF templates using a visual node builder (text, table, image, and divider nodes); generated PDFs and extra shared attachments are stored in Garage.
- **Campaigns**: Queued through RabbitMQ and sent asynchronously in the background with Redis token-bucket rate limiting per SMTP connection, per-recipient status tracking, and automatic retries for transient SMTP failures.
- **Notifications & Announcements**: Campaign notifications (`campaign_finished`, `send_failed`) and admin announcements (`UserNotice` from broadcasts) appear in the user app with unread badges.
- **User Profile & Theme Preferences**: Users can edit their display name, upload or reset a custom avatar (`PNG`/`JPEG`/`WebP` up to 2 MB, magic-byte verified, stored in Garage), and change their email address (always requires clicking a verification link sent to the new address). Account-saved theme preferences support `light`, `dark`, or `system` mode and preset accent colors (`slate`, `blue`, `green`, `violet`, `rose`, `amber`).
- **Login Activity**: Records sign-in events with resolved client IP, a best-effort proxy indicator, parsed browser/OS/device type, and offline geolocation via `geoip-lite` ( retained for `LOGIN_EVENT_RETENTION_DAYS`, default 90 days). Optional map previews load OpenStreetMap raster tiles on demand only when opened.
- **Admin Web**: Manage users (view, edit name/image, disable/enable accounts with immediate session revocation), compose and send broadcasts to all users, by role, or selected users, audit login activity across all accounts, toggle instance feature flags (`scalar_docs`, `pdf_builder`, `self_signup`), view service monitoring links and live health, configure required external integrations via the setup gate (`uptime` for Uptime Kuma, `grafana` for Grafana, and `mail` for platform SMTP), and idempotently seed an example payroll project (`make seed-demo` or `POST /admin/demo-project`).
- **OpenAPI & Observability**: Scalar OpenAPI reference at `/docs` and specification at `/openapi.json` (requires authentication; toggleable via `scalar_docs`). Prometheus scrapes `/metrics` for Grafana dashboards, Uptime Kuma monitors service health, API error logs are persisted to object storage, and browser Sentry reporting is optional.

## Architecture

### Services

| Compose service | Purpose | Published host port by default |
|---|---|---:|
| `api` | Express REST API, authentication, and background workers | `3000` |
| `web` | One Nginx container serving user web at `/` and admin web at `/console/` | `8080` |
| `landing` | Public Angular landing site with English and Indonesian pages | `8082` |
| `postgres` | Application database | Internal only |
| `redis` | Session/cache state, rate limiting, and feature-flag updates | Internal only |
| `rabbitmq` | Background email and notification jobs | Internal only |
| `garage` | S3-compatible object storage for attachments, generated PDFs, and error records | Internal only |
| `prometheus` | Scrapes API metrics | Internal only |
| `grafana` | Metrics dashboards | `3001` |
| `uptime-kuma` | Uptime and health monitoring | `3002` |

The API, web, Grafana, and Uptime Kuma published ports bind to `127.0.0.1` by default. The landing site binds to `0.0.0.0` by default; set `LANDING_BIND_ADDRESS=127.0.0.1` when placing a reverse proxy in front. PostgreSQL, Redis, RabbitMQ, Garage, and Prometheus stay on the internal Compose network.

The public landing site is served by the `landing` service on port `8082`. It provides English and Indonesian product information, a terms page, a dynamic sitemap, and a robots policy that blocks selected AI model crawlers while allowing search crawlers. Configure the public app, site, repository, and self-hosting guide URLs with the `LANDING_*_URL` variables.

### Monorepo layout

```text
apps/api/          Express API, domain and internal layers, Prisma schema and migrations
apps/admin-web/    Angular administration app
apps/user-web/     Angular user app
apps/landing-web/  Public Angular SSR landing site
packages/shared/   Shared TypeScript code
packages/ui/       Shared UI package source
infra/             Garage, Prometheus, Grafana, and web-server configuration
tests/             Infrastructure checks and Playwright browser flows
```

### Campaign send flow

The API validates the campaign and its project resources, then queues work in RabbitMQ and returns without waiting for all email deliveries. A worker renders each recipient's email, generates a PDF when the campaign uses a PDF template, applies the SMTP connection's Redis-backed rate limit, and sends through that project's SMTP server. It records each recipient's result, stores generated files in Garage, and publishes campaign-finished or send-failed notifications.

## Quick start with Docker Compose

### Prerequisites

- Docker Engine 24.0 or newer
- Docker Compose v2.20 or newer (`docker compose`)
- OpenSSL

### Configure secrets

Copy the example environment file and generate strong values before starting the stack:

```bash
cp .env.example .env
make secrets
```

`make secrets` prints values for `APP_ENCRYPTION_KEY`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `GARAGE_RPC_SECRET`, and `GARAGE_ADMIN_TOKEN`. Generate the remaining passwords and tokens with OpenSSL, for example:

```bash
openssl rand -hex 32   # POSTGRES_PASSWORD, RABBITMQ_PASSWORD, GRAFANA_ADMIN_PASSWORD, METRICS_TOKEN
openssl rand -base64 32  # BETTER_AUTH_SECRET
```

Put each generated value in the matching field in `.env`. Configure Google OAuth as described below, then replace the example values in the Docker Compose section. Keep `.env` private and do not commit it.

### Start the stack

```bash
docker compose up -d --build
docker compose ps
```

The API applies database migrations during startup. Wait for the services to become healthy, then open the user app. The default URLs are:

| Service | URL | Binding |
|---|---|---|
| User app | `http://127.0.0.1:8080/` | `127.0.0.1:8080` |
| Admin app | `http://127.0.0.1:8080/console/` | Same origin as user app |
| API | `http://127.0.0.1:3000` | `127.0.0.1:3000` |
| Grafana | `http://127.0.0.1:3001` | `127.0.0.1:3001` |
| Uptime Kuma | `http://127.0.0.1:3002` | `127.0.0.1:3002` |
| Landing site (optional) | `http://127.0.0.1:8082` | `127.0.0.1:8082` |

`BIND_ADDRESS` controls the host IP and `WEB_PORT` changes the published web port. The admin app is served from `/console/` on that same origin. The landing site is opt-in: start it with `docker compose --profile landing up -d` or `make up-landing`. For public access, place an HTTPS reverse proxy in front of the web port; see [Self-Hosting](docs/SELF-HOSTING.md).

To grant admin access, add the account's Google email to `ADMIN_EMAILS` before signing in. Admin-only routes compare the signed-in email with this configured list.

## Google sign-in setup

Google OAuth must be configured before users can sign in.

1. In Google Cloud Console, create or choose a project.
2. Configure the OAuth consent screen and add the intended users as test users if the consent screen remains in testing mode.
3. Create an OAuth client ID with application type **Web application**.
4. Add the shared app origin under **Authorized JavaScript origins**. The default local origin is `http://localhost:8080`; user and admin share it, with admin under `/console/`.
5. Add this exact value under **Authorized redirect URIs**:

   ```text
   BETTER_AUTH_URL + /api/auth/callback/google
   ```

   With the local default `BETTER_AUTH_URL=http://localhost:8080`, the URI is `http://localhost:8080/api/auth/callback/google`.

6. Put the Google client ID and client secret in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`.
7. Set `BETTER_AUTH_URL` to the public app origin people open. Set `TRUSTED_ORIGINS` to that origin and any other browser origin you explicitly use; the admin path does not need a separate trusted origin.
8. Add admin account emails to `ADMIN_EMAILS` if needed.
9. Recreate the API container so it receives the updated environment, then sign in from the user app and the admin app at `/console/`:

   ```bash
   docker compose up -d --force-recreate api
   ```

Common sign-in problems:

- **`redirect_uri_mismatch`**: the Google redirect URI must exactly match `BETTER_AUTH_URL` followed by `/api/auth/callback/google`, including scheme, hostname, and port.
- **HTTP 403 invalid origin**: add the browser's full origin to `TRUSTED_ORIGINS`, then recreate the API container. Compose defaults to both local web origins.
- **Different subdomains**: cookies are shared between ports on one hostname, but not between different hostnames such as `app.example.com` and `admin.example.com`. The current auth configuration does not set a shared parent-domain cookie; use one hostname for both apps if they need a shared session.
- **Consent screen in testing mode**: only Google accounts listed as test users can complete OAuth until the consent screen is published or otherwise approved.

## Local development

To run the API, user app and admin app each on their own with per-app `.env` files and Makefiles (infrastructure stays in Docker), follow [docs/LOCAL-DEVELOPMENT.md](docs/LOCAL-DEVELOPMENT.md). The notes below describe the root-level workflow.

Install workspace dependencies with either command:

```bash
npm ci
# or
make install
```

Create `.env` with `make env` or copy `.env.example`, then provide the required API environment values from [Configuration](#configuration-reference). The API process reads from its shell environment; export values from `.env` before starting it:

```bash
set -a
. ./.env
set +a
```

For local browser sign-in, set `BETTER_AUTH_URL` to the user app's development origin and include both development app origins in `TRUSTED_ORIGINS`. For example, if running user web on port `4300` and admin web on `4301`, use those origins instead of the Compose defaults.

The repository Compose file can start only the dependency containers with:

```bash
docker compose up -d postgres redis rabbitmq garage garage-init
```

Those services do not publish their ports to the host. A host-run, hot-reload API therefore needs local or otherwise host-reachable PostgreSQL, Redis, RabbitMQ, and S3-compatible storage at the URLs in its environment. The Compose-only dependencies are reachable by services running inside the Compose network.

Start the API and Angular apps with the Make targets:

```bash
make dev-api
make dev-user
make dev-admin
make dev-landing
```

The API defaults to port `3000`. Angular `ng serve` defaults to port `4200`; run the apps separately or start them on different ports. For example, these workspace scripts accept Angular CLI arguments:

```bash
npm run start -w @slipakar/user-web -- --port 4300
npm run start -w @slipakar/admin-web -- --port 4301
```

The web dev-server proxies API requests to port `3000`.

Generate the Prisma client and manage migrations with:

```bash
make db-generate
make db-migrate-dev
make db-migrate-deploy
make db-studio
```

`db-migrate-dev` creates and applies development migrations; `db-migrate-deploy` applies checked-in migrations to the configured database.

## Testing

API tests use Vitest. Integration tests start PostgreSQL, Redis, RabbitMQ, and S3-compatible containers with Testcontainers, so Docker must be running:

```bash
npm test
# or
make test
```

Run the Angular tests once in CI mode (Angular 22 `ng test` has no `--watch` option):

```bash
cd apps/user-web && CI=1 npx ng test
cd apps/admin-web && CI=1 npx ng test
make test-landing
```

Run browser flows with Playwright:

```bash
npm run e2e
```

Playwright starts both web development servers and mocks API responses. Mocked browser tests do not replace a smoke test against a real Compose stack.

With the production web service already running, `make smoke-web` checks the single `WEB_URL` for both app entrypoints, `/console/` deep links, API routing, crawler policy, and the user app's `Vary: Accept` and cache policies. Set `WEB_URL` to check an alternate local port.

Useful Make targets are listed below. `make check` runs typechecking, lint, and the API and web unit/integration test targets. Playwright remains a separate `npm run e2e` (`make e2e`) step.

### Makefile targets

| Target | Purpose |
|---|---|
| `help` | Display the help summary listing available Makefile targets. |
| `install` | Install repository dependencies across all workspaces using `npm ci`. |
| `env` | Initialize local `.env` from `.env.example` if missing. |
| `secrets` | Generate cryptographically secure secrets (`APP_ENCRYPTION_KEY`, `S3_*`, `GARAGE_*`) using OpenSSL. |
| `dev-api` | Start the API service in development watch mode. |
| `dev-admin` | Start the admin web frontend in development mode. |
| `dev-user` | Start the user web frontend in development mode. |
| `dev-landing` | Start the public landing frontend in development mode. |
| `typecheck` | Run TypeScript typechecking (`tsc -b`) across all workspace projects. |
| `lint` | Run ESLint across the codebase. |
| `test` | Run the API unit and integration test suite using Vitest (requires Docker for Testcontainers). |
| `test-api-file` | Run a single API test spec file passed via `FILE=<path>`. |
| `test-admin` | Run unit tests for the admin web frontend. |
| `test-user` | Run unit tests for the user web frontend. |
| `test-landing` | Run unit tests for the public landing frontend. |
| `test-all` | Run all test suites across the API and frontend apps. |
| `check` | Run all quality checks: `typecheck`, `lint`, and `test-all`. |
| `build` | Build all TypeScript packages and applications across the workspace. |
| `docker-build` | Build the production Docker image for the API service (`slipakar-api:dev`). |
| `docker-build-web` | Build the combined production Docker image for both web apps (`slipakar-web:dev`). |
| `db-generate` | Generate the Prisma Client from `apps/api/prisma/schema.prisma`. |
| `db-migrate-dev` | Create and apply a new Prisma database migration in development. |
| `db-migrate-deploy` | Deploy pending Prisma database migrations to the target database. |
| `db-studio` | Launch Prisma Studio to browse and edit database records. |
| `seed-demo` | Idempotently seed the example payroll demo project for the configured administrator. |
| `up` | Start all Docker Compose stack services in the background. |
| `up-build` | Rebuild images and start all Docker Compose stack services in the background. |
| `down` | Stop and remove Docker Compose containers and networks while preserving volumes. |
| `down-volumes` | Stop containers and delete all persistent data volumes (requires `CONFIRM=yes`). |
| `ps` | List running containers in the Docker Compose stack. |
| `logs` | Tail logs for a Compose service (defaults to `SERVICE=api`; use `SERVICE=web` for Nginx). |
| `restart` | Restart a service container in the Docker Compose stack (defaults to `SERVICE=api`). |
| `config` | Validate and render the Docker Compose configuration against the env file. |
| `playwright-install` | Install Playwright Chromium browser binaries. |
| `e2e` | Run end-to-end browser tests using Playwright. |
| `up-landing` | Start the optional `landing` Compose profile and build its image. |
| `smoke-web` | Check both apps on the single web origin, API routing, crawler policy, cache/Vary headers, and `/docs` CSP hash. |
| `clean` | Remove `dist`, `.angular`, and `*.tsbuildinfo` build artifacts across `apps` and `packages`. |

## Ports and routes

In Docker Compose, a single Nginx container (`web`) serves both Angular apps on the same host port, proxying backend paths to `api:3000`:

| Port / App | Frontend SPA Routes | Proxied API & System Paths |
|---|---|---|
| **User web (`/`)** | `/login`, `/account-disabled`, `/projects`, `/projects/:projectId` (`overview`, `smtp`, `templates`, `data`, `campaigns`, `campaigns/new`, `campaigns/:campaignId`, `pdf-templates`, `pdf-templates/new`, `pdf-templates/:templateId`), `/notifications`, `/profile`, `/login-activity` | `/api/*`, `/health`, `/healthz` (Nginx), `/docs`, `/docs/*`, `/openapi.json`, `/notifications/unread-count`, `/me/*`, `/projects` & `/projects/*` (content-negotiated via `Accept`: `text/html` serves SPA `/index.html`, `application/json` proxies to API) |
| **Admin web (`/console/`)** | `/console/login`, `/console/forbidden`, `/console/flags`, `/console/monitoring`, `/console/users`, `/console/preferences`, `/console/broadcasts`, `/console/login-activity`, `/console/setup`, `/console/user-app` | `/api/*`, `/health`, `/healthz` (Nginx), `/docs`, `/docs/*`, `/openapi.json`, `/admin/*`, `/me/*` |
| **Direct API (`3000`)** | — | All REST endpoints, `/health`, `/metrics` (bearer token `METRICS_TOKEN`), `/docs`, `/openapi.json` |

Note: `/docs` and `/openapi.json` require an authenticated session (returning `401` when signed out, or `404` when the `scalar_docs` feature flag is disabled). Nginx serves `/docs` with a per-location Content-Security-Policy `script-src` hash (`'sha256-lmba+p2ZA26l0frITlGt+zVDpF9V987twNchN6VQgQ8='`) permitting Scalar's bootstrap script without relaxing the rest of the app's CSP.

## Configuration reference

The API environment schema is in `apps/api/src/config/env.ts`. Compose-specific inputs and defaults are in `.env.example` and `docker-compose.yml`. Required values must be set even if the example file contains a sample value. Docker Compose passes unset optional variables (`APP_URL`, `AUTH_SMTP_*`, `AUTH_MAIL_FROM`, `LOGIN_EVENT_RETENTION_DAYS`, `TRUST_PROXY`) as empty strings, and `loadEnv()` in the API treats empty strings for those variables as unset so defaults and optional validations work cleanly.

### Where secrets live

- **Project SMTP passwords** (`SmtpConfig`) and **Admin setup integration credentials** (`IntegrationConfig` for `uptime`, `grafana`, and `mail`) are encrypted at rest in PostgreSQL using AES-256-GCM with `APP_ENCRYPTION_KEY`.
- Credentials are write-only and are never returned in API responses or written to `AuditLog` (responses include only `hasCredentials` and a masked 4-character suffix `credentialHint`; for `mail`, non-secret settings `{host, port, secure, username, fromAddress}` are returned so the UI can prefill edits).
- For platform mail (email change verification and broadcast emails), database-stored `mail` credentials configured via `/admin/setup` take precedence over the `AUTH_SMTP_*` / `AUTH_MAIL_FROM` environment variables (cached for 30s and invalidated immediately on `PUT`/`DELETE`).

| Variable | Required? | Default or Compose value | Description |
|---|---|---|---|
| `DATABASE_URL` | API: yes | Compose builds it from `POSTGRES_PASSWORD` | PostgreSQL connection URL. |
| `POSTGRES_PASSWORD` | Compose: yes | None | Password for the PostgreSQL Compose user. |
| `APP_ENCRYPTION_KEY` | API/Compose: yes | None | Exactly 64 hex characters; encrypts stored SMTP credentials. |
| `GOOGLE_CLIENT_ID` | API/Compose: yes | None | Google OAuth client ID. |
| `GOOGLE_CLIENT_SECRET` | API/Compose: yes | None | Google OAuth client secret. |
| `BETTER_AUTH_SECRET` | API/Compose: yes | None | Secret used by Better Auth for sessions and tokens. |
| `BETTER_AUTH_URL` | API/Compose: yes | Compose example: `http://localhost:8080` | Public user-app URL used to construct OAuth callback URLs. |
| `TRUSTED_ORIGINS` | No for API; Compose supplies a default | Empty in API; Compose defaults to `http://localhost:8080` | Comma-separated absolute browser origins accepted by Better Auth. User and admin share the same origin. |
| `S3_ENDPOINT` | API: yes | Compose uses `garage`; local example uses `localhost` | Hostname of the S3-compatible object store. |
| `S3_PORT` | No | `3900` | Object-store API port. |
| `S3_USE_SSL` | No | `false` | Whether to use TLS to the object store. |
| `S3_ACCESS_KEY` | API/Compose: yes | None | Object-store access key; Garage keys use the `GK` prefix plus 24 hex characters. |
| `S3_SECRET_KEY` | API/Compose: yes | None | Object-store secret key; Garage expects 64 hex characters. |
| `S3_BUCKET` | API: yes | Compose uses `slipakar` | Bucket for attachments, generated PDFs, and error records. |
| `S3_REGION` | No | `garage` | S3 signing region. |
| `S3_PATH_STYLE` | No | `true` | Use path-style S3 requests. |
| `REDIS_URL` | API: yes | Compose uses `redis://redis:6379` | Redis connection URL. |
| `RABBITMQ_URL` | API: yes | Compose builds it from `RABBITMQ_PASSWORD` | RabbitMQ AMQP or AMQPS connection URL. |
| `RABBITMQ_PASSWORD` | Compose: yes | None | Password for the RabbitMQ Compose user. |
| `ADMIN_EMAILS` | No | Empty | Comma-separated admin email allowlist. |
| `METRICS_TOKEN` | API: optional; Compose: required | None in API schema | Bearer token for `/metrics`; must be at least 16 characters. |
| `PORT` | No | `3000` | API listen port; Compose sets it to `3000`. |
| `APP_URL` | No | Empty (falls back to first entry in `TRUSTED_ORIGINS`) | Frontend application URL used for email verification redirect callbacks. |
| `AUTH_SMTP_HOST` | Optional (all `AUTH_SMTP_*` must be set together) | None | Platform SMTP server hostname for transactional auth emails (email change verification). |
| `AUTH_SMTP_PORT` | No | `587` | Platform SMTP server port. |
| `AUTH_SMTP_SECURE` | No | `false` | Enable TLS/SSL connection for platform SMTP (`true` or `false`). |
| `AUTH_SMTP_USER` | Optional (all `AUTH_SMTP_*` must be set together) | None | Username for platform SMTP authentication. |
| `AUTH_SMTP_PASS` | Optional (all `AUTH_SMTP_*` must be set together) | None | Password for platform SMTP authentication. |
| `AUTH_MAIL_FROM` | Optional (all `AUTH_SMTP_*` must be set together) | None | `From` email address for platform transactional auth emails (e.g. `noreply@example.com`). |
| `LOGIN_EVENT_RETENTION_DAYS` | No | `90` | Number of days to retain user login activity records (1..3650 days). Expired records purged at startup and daily. |
| `TRUST_PROXY` | No | `false` (API default; `1` in Compose) | Trust proxy setting for Express: `false`, hop count (e.g. `1`), or comma-separated CIDRs. |
| `GARAGE_RPC_SECRET` | Compose: yes | None | Garage cluster RPC secret, 64 hex characters. |
| `GARAGE_ADMIN_TOKEN` | Compose: yes | None | Garage bootstrap admin token, 48 hex characters. |
| `GARAGE_METRICS_TOKEN` | No | Empty | Optional token forwarded to the Garage container. |
| `GRAFANA_ADMIN_USER` | No | `admin` | Grafana login name. |
| `GRAFANA_ADMIN_PASSWORD` | Compose: yes | None | Grafana login password. |
| `BIND_ADDRESS` | No | `127.0.0.1` | Host IP used for published Compose ports. |
| `WEB_PORT` | No | `8080` | Host port for the user and admin web apps; admin is under `/console/`. |
| `API_UPSTREAM` | No | `api:3000` | Nginx upstream address for API requests inside Compose. |
| `PORT` | No | `8080` | Nginx listener port inside the web container. |
| `SENTRY_DSN_USER` | No | Empty | Build-time Sentry DSN embedded in the user-web production bundle. |
| `SENTRY_DSN_ADMIN` | No | Empty | Build-time Sentry DSN embedded in the admin-web production bundle. |

## Operations

- **Backups:** PostgreSQL and service state live in named volumes. Back up the database and both Garage volumes (`garage_meta` and `garage_data`) consistently. The backup examples and volume list are in [Self-Hosting](docs/SELF-HOSTING.md).
- **Upgrades:** rebuild and restart with the steps in [Self-Hosting](docs/SELF-HOSTING.md). API migrations run on startup. Keep a verified backup before upgrading.
- **Sentry:** set `SENTRY_DSN_USER` and/or `SENTRY_DSN_ADMIN` in the build environment, then rebuild the `web` image. The DSNs are embedded in production browser bundles; keep them out of committed source.
- **Reverse proxy and security:** Compose binds the API and web service to loopback by default. The optional landing service also binds to loopback and can be started with the `landing` profile. Review [Self-Hosting](docs/SELF-HOSTING.md) for TLS proxy examples, cookie behavior, port details, and deployment security notes.

## Contributing

Use test-driven development for behavior changes and keep API code in the `domain/` and `internal/` layers. For Angular work, keep tests colocated with the code and add HTTP contract checks. Treat API DTOs and response views as the contract source of truth; do not invent client request fields. Run the relevant tests, typecheck, and lint before submitting changes.

## Troubleshooting

- **Stale UI or cached responses after upgrades**: Hard-refresh the browser (`Cmd+Shift+R` / `Ctrl+Shift+R`) after redeploying `web` or `api`. Hashed static assets are cached immutably (`max-age=31536000`), while `/index.html` and content-negotiated `/projects` routes use `Cache-Control: no-cache` and `Vary: Accept, Accept-Encoding`.
- **`403 ACCOUNT_DISABLED`**: Returned on every authenticated request when an administrator has disabled the user account via `/admin/users/:id/disable` (existing sessions are also revoked immediately). Another administrator must re-enable the account via `/admin/users/:id/enable`.
- **`400 EMAIL_CHANGE_UNAVAILABLE`**: Returned by `POST /api/auth/change-email` when no platform mailer is configured. Configure the `mail` integration in Admin Setup (`/admin/setup`) or set `AUTH_SMTP_HOST` and `AUTH_MAIL_FROM` (plus `AUTH_SMTP_USER`/`AUTH_SMTP_PASS` if required) in `.env`.
- **`401 Unauthorized` on `/docs` or `/openapi.json`**: The OpenAPI reference and spec require an active authenticated session. Sign in to the user or admin web app first, then open `/docs` on the same origin. (If `/docs` returns `404`, enable the `scalar_docs` feature flag in the admin app.)
- **Login activity shows `"Local network"`**: Accessing the stack locally over loopback or the Docker bridge network (`172.18.0.1`) produces a private client IP, which has no public GeoIP record (`null` coordinates, `proxy: false`). Behind a reverse proxy, set `TRUST_PROXY` (`1` by default in Docker Compose for Nginx) and ensure the proxy forwards `X-Forwarded-For`.

## Security

Please report vulnerabilities privately according to [SECURITY.md](SECURITY.md); do not open a public issue for an unpatched vulnerability.

### Privacy note

- **IP & device data**: Every sign-in records a `LoginEvent` with the resolved client IP (`TRUST_PROXY`-aware), a best-effort proxy flag (never set for private/loopback/Docker IPs), parsed browser/OS/device type, and offline city/region/country/coordinates via `geoip-lite`.
- **Retention**: Login events are retained for `LOGIN_EVENT_RETENTION_DAYS` (default `90` days, range `1..3650`) and purged automatically at API startup and every 24 hours.
- **OpenStreetMap tiles**: Map previews in Login Activity fetch raster tiles from `https://tile.openstreetmap.org` only when a user opens the map drawer for an event. Loading those tiles discloses the viewer's client IP address to OpenStreetMap contributors; see [SECURITY.md](SECURITY.md).

## Code of Conduct

Participation in the project is covered by the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

Slipakar is distributed under the [Apache License 2.0](LICENSE).

## Acknowledgements

Slipakar stands on the work of many open-source projects and free services. Thank you to the maintainers and communities behind:

- **Frontend**: [Angular](https://angular.dev), [Spartan NG](https://www.spartan.ng), [Tailwind CSS](https://tailwindcss.com), [ng-icons](https://ng-icons.github.io/ng-icons/) with [Tabler Icons](https://tabler.io/icons), [RxJS](https://rxjs.dev).
- **Backend**: [Node.js](https://nodejs.org), [Express](https://expressjs.com), [Better Auth](https://www.better-auth.com), [Prisma](https://www.prisma.io), [Zod](https://zod.dev), [Pino](https://getpino.io), [Nodemailer](https://nodemailer.com), [PDFKit](https://pdfkit.org), [ExcelJS](https://github.com/exceljs/exceljs), [Scalar](https://scalar.com).
- **Infrastructure**: [PostgreSQL](https://www.postgresql.org), [Redis](https://redis.io), [RabbitMQ](https://www.rabbitmq.com), [Garage](https://garagehq.deuxfleurs.fr), [Nginx](https://nginx.org), [Docker](https://www.docker.com).
- **Observability**: [Prometheus](https://prometheus.io), [Grafana](https://grafana.com), [Uptime Kuma](https://github.com/louislam/uptime-kuma), and [Sentry](https://sentry.io) for optional browser error reporting.
- **Data**: [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors for map tiles, and [geoip-lite](https://github.com/geoip-lite/node-geoip), which includes GeoLite data created by [MaxMind](https://www.maxmind.com).

Each project keeps its own license; please read them before redistributing or offering Slipakar as a hosted service.

## Brand assets (TODO)

- Create a Slipakar favicon for the three web apps: `apps/user-web/public`, `apps/admin-web/public`, and `apps/landing-web/public`.
- Create a landing-page Open Graph image at 1200×630 pixels.
- Create a Slipakar wordmark.
