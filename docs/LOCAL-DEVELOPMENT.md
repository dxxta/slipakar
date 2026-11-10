# Running each app locally

Run the API, the user app, the admin app and the optional landing site directly on your machine (hot reload), while the backing services (PostgreSQL, Redis, RabbitMQ, Garage S3) stay in Docker. Each app has its own `.env` and `Makefile`, so you can start and stop them independently.

| App | Folder | Default port | Env file |
| --- | --- | --- | --- |
| API | `apps/api` | 3000 | `apps/api/.env` |
| User web | `apps/user-web` | 4300 | `apps/user-web/.env` |
| Admin web | `apps/admin-web` | 4301 | `apps/admin-web/.env` |
| Landing web (optional) | `apps/landing-web` | 4302 | `apps/landing-web/.env` |

## Prerequisites

- Node.js and `npm ci` run once at the repository root (`make install`).
- Docker running (for the infrastructure containers).
- Google OAuth credentials if you want to sign in (see [Sign-in](#sign-in)).

## 1. Environment files

Each app ships a `.env.example`. Create the real `.env` (ignored by git) with:

```bash
cd apps/api        && make env
cd apps/user-web   && make env
cd apps/admin-web  && make env
cd apps/landing-web && make env   # optional
```

`make env` never overwrites an existing `.env`. The defaults point at the local infrastructure below; fill in `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `ADMIN_EMAILS` in `apps/api/.env`. Values in `.env` take priority over exported shell variables, so override on the command line instead (for example `make dev PORT=3999`).

## 2. Infrastructure (Docker)

Two Compose files provide the dependencies on host-published ports that do not clash with the main stack:

| | `apps/api/docker-compose.yml` | `docker-compose.dev.yml` (root) |
| --- | --- | --- |
| Compose project | `slipakar-api-dev` | `slipakar-dev` |
| PostgreSQL | 5433 | 5434 |
| Redis | 6380 | 6381 |
| RabbitMQ | 5673 | 5674 |
| Garage S3 | 3910 | 3911 |
| Start | `cd apps/api && make infra-up` | `make dev-infra-up` |
| Stop | `make infra-down` | `make dev-infra-down` |
| Wipe data | `make infra-reset` | `make dev-infra-reset` |

The API `.env` defaults use the `apps/api` development ports. To use the root dev stack, change the ports in `apps/api/.env` accordingly.

## 3. Start the API

```bash
cd apps/api
make infra-up   # start Postgres, Redis, RabbitMQ, Garage
make migrate    # apply Prisma migrations
make dev        # tsx watch on http://localhost:3000
```

Other targets: `make start`, `make build`, `make typecheck`, `make test`, `make clean`, `make help`.

Port 3000 is also used by the `api` container of the main Compose stack. Stop it (`docker compose stop api`) or run `make dev PORT=3999` and point the web apps at it with `make dev API_URL=http://localhost:3999`.

## 4. Start the web apps

```bash
cd apps/user-web  && make dev    # http://localhost:4300
cd apps/admin-web && make dev    # http://localhost:4301
```

Both use `proxy.conf.local.cjs`, which forwards `/api`, `/admin`, `/me`, `/health`, `/docs`, `/openapi.json` and `/metrics` to `API_URL` (default `http://localhost:3000`). Other targets: `make build`, `make typecheck`, `make test`, `make clean`, `make help`.

## 5. Start the landing site (optional)

The public landing site does not need the API or the infrastructure containers. Start the user app first, then the landing site:

```bash
cd apps/user-web && make dev       # http://localhost:4300
cd apps/landing-web && make dev    # http://localhost:4302 (live reload)
```

In local development, “Sign in” opens `http://localhost:4300`. Override the sign-in destination with `make dev LANDING_APP_URL=http://localhost:4999`. Other targets: `make build`, `make typecheck`, `make test`, `make clean`, `make help`. The `LANDING_*` values in `apps/landing-web/.env` (sign-in, site, repository and docs URLs) are read by the production server, so to check them, the sitemap, `robots.txt` or the AI-crawler block, build and run the production server:

```bash
cd apps/landing-web && make build
PORT=8082 node dist/landing-web/server/server.mjs    # http://localhost:8082
curl -s -o /dev/null -w "%{http_code}\n" -A GPTBot http://localhost:8082/        # 403
curl -s -o /dev/null -w "%{http_code}\n" -A Googlebot http://localhost:8082/     # 200
```

The production server still defaults to `http://localhost:8080` (the Compose web port). Local `make dev` defaults to the user app on port 4300. The landing site never links to the admin app or the API.

## Sign-in

`BETTER_AUTH_URL` is `http://localhost:4300` in development, and `TRUSTED_ORIGINS` includes both `http://localhost:4300` and `http://localhost:4301`. Register this redirect URI in your Google OAuth client:

```
http://localhost:4300/api/auth/callback/google
```

## Quick check

```bash
curl -s http://localhost:3000/health          # API
curl -s http://localhost:4300/health          # through the user-web proxy
curl -s http://localhost:4301/health          # through the admin-web proxy
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4302/   # landing (optional)
```

## Troubleshooting

- **`EADDRINUSE` / port in use**: another process (often the Compose `api`) holds the port; the Makefile guard stops early. Free it or override `PORT`.
- **Database errors on start**: run `make infra-up` then `make migrate` in `apps/api`.
- **HTTP 403 invalid origin**: add the browser's origin to `TRUSTED_ORIGINS` in `apps/api/.env` and restart `make dev`.
- **`redirect_uri_mismatch`**: the Google redirect URI must match `BETTER_AUTH_URL` + `/api/auth/callback/google` exactly.
