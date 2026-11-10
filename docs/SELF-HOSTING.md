# Self-Hosting Lokaslip

This guide covers running Lokaslip in production or on a private server using Docker Compose.

---

## 1. Prerequisites

Before starting, ensure the host machine has the following tools installed:

- **Docker Engine** (version 24.0 or newer)
- **Docker Compose** (version 2.20 or newer, plugin `docker compose`)
- **OpenSSL** (for generating cryptographically secure secrets)
- Minimum hardware recommendations:
  - 2 CPUs / vCPUs
  - 4 GB RAM
  - 20 GB free disk space (for PostgreSQL, Garage S3 objects, and Prometheus TSDB)

---

## 2. Configuration & Secrets Setup

1. Copy `.env.example` to create your local `.env` file:

   ```bash
   cp .env.example .env
   ```

2. Fill in the required placeholders under the `# Docker compose` section. You can generate random production secrets using:

   ```bash
   make secrets
   ```

   Key environment variables:

   - **`POSTGRES_PASSWORD`**: Strong random password for PostgreSQL user `lokaslip`.
   - **`RABBITMQ_PASSWORD`**: Strong random password for RabbitMQ user `lokaslip`.
   - **`S3_ACCESS_KEY`**: S3 API access key for Garage (format: `GK` followed by 24 hex characters, e.g. `echo GK$(openssl rand -hex 12)`).
   - **`S3_SECRET_KEY`**: S3 API secret key for Garage (64 hex characters, `openssl rand -hex 32`).
   - **`GARAGE_RPC_SECRET`**: Garage internal cluster communication secret (64 hex characters, `openssl rand -hex 32`).
   - **`GARAGE_ADMIN_TOKEN`**: Garage administrative API bearer token used by the bootstrap container (48 hex characters, `openssl rand -hex 24`).
   - **`APP_ENCRYPTION_KEY`**: 32-byte hex key (64 hex characters) used to encrypt sensitive credentials (project SMTP passwords and `/admin/setup` integration credentials for `uptime`, `grafana`, and `mail`) in the database using AES-256-GCM. Secret credentials are write-only and never returned in API views or `AuditLog`. Generate with:
     ```bash
     openssl rand -hex 32
     ```
   - **`BETTER_AUTH_SECRET`**: Random secret for authentication tokens and sessions:
     ```bash
     openssl rand -base64 32
     ```
   - **`BETTER_AUTH_URL`**: The single public origin users open for both web apps (for example `http://localhost:8080` locally or `https://app.example.com` behind Caddy). The admin app is served under `/console/`. Better Auth uses this URL when constructing OAuth callback URLs.
   - **`TRUSTED_ORIGINS`**: Comma-separated absolute browser origins accepted by Better Auth. Compose defaults to `http://localhost:8080`; the user and admin apps share this origin.
   - **`GOOGLE_CLIENT_ID`** & **`GOOGLE_CLIENT_SECRET`**: OAuth credentials from the Google Cloud Console.
   - **`METRICS_TOKEN`**: High-entropy secret token (at least 16 characters) used by Prometheus to scrape `/metrics`.
   - **`GRAFANA_ADMIN_PASSWORD`**: Password for the Grafana admin account (`admin`).
   - **`ADMIN_EMAILS`**: Comma-separated list of user email addresses granted admin role upon login.
   - **`BIND_ADDRESS`**: Host IP to bind exposed services to (defaults to `127.0.0.1`).
   - **`AUTH_SMTP_HOST`**, **`AUTH_SMTP_PORT`**, **`AUTH_SMTP_SECURE`**, **`AUTH_SMTP_USER`**, **`AUTH_SMTP_PASS`**, **`AUTH_MAIL_FROM`**: Optional platform SMTP fallback settings used to send transactional authentication emails (verified email change links) and administrative broadcasts. Database-configured `mail` integration settings in `/admin/setup` take precedence over these environment variables (cached for 30s and invalidated on update/delete). When neither DB mail nor `AUTH_SMTP_*` is configured, `POST /api/auth/change-email` returns `400 EMAIL_CHANGE_UNAVAILABLE`, and broadcast sending skips email dispatch while still delivering in-app user notices. Note: Docker Compose passes unset optional variables as empty strings, which the API treats as unset.
   - **`APP_URL`**: Optional frontend application URL used for callback redirection in email verification links (defaults to the first origin in `TRUSTED_ORIGINS`).
   - **`LOGIN_EVENT_RETENTION_DAYS`**: Number of days to retain user login events (default: 90 days, range: 1..3650 days). Expired records are pruned at API boot and every 24 hours.
   - **`TRUST_PROXY`**: Trust proxy setting for Express. Values: `false` (default for bare API), a hop count like `1` (compose default behind nginx reverse proxy), or a comma-separated list of CIDRs. Ensures client IP is accurately resolved from `X-Forwarded-For`.

---

## 3. Architecture & Garage S3 Storage

LokaSlip uses [Garage](https://garagehq.deuxfleurs.fr/) (`dxflrs/garage:v1.0.1`) for lightweight, robust, self-hosted S3-compatible object storage (attachments, generated PDF payslips, and artifacts).

### Garage Components in Docker Compose

1. **`garage`**: The Garage server daemon running with `/garage -c /etc/garage/garage.toml server`.
   - Configuration file: `infra/garage/garage.toml` (binds S3 API to port 3900 and Admin API to port 3903).
   - Cluster secrets (`GARAGE_RPC_SECRET`, `GARAGE_ADMIN_TOKEN`) are supplied securely via environment variables without hardcoding secrets in configuration files.
   - Storage volumes: `garage_meta` (metadata / SQLite index) and `garage_data` (chunk storage blocks).
2. **`garage-init`**: A transient bootstrap container (`curlimages/curl`) that runs once when the stack starts (`restart: "no"`).
   - It waits for Garage to report healthy.
   - It communicates with the Garage Admin HTTP API v1 (`http://garage:3903/v1/`) using `GARAGE_ADMIN_TOKEN`.
   - It sets up single-node layout (assigning zone `dc1` and 10GB capacity), applies layout version 1, imports `S3_ACCESS_KEY` / `S3_SECRET_KEY`, ensures bucket `lokaslip` exists, and grants read/write/owner permissions to the access key.
   - Once initialized, `garage-init` exits 0. The `api` service waits for `garage-init` to complete successfully before starting.

---

## 4. Starting the Stack

To build and start all services in detached mode:

```bash
docker compose up -d --build
```

The `api` container automatically executes database migrations via `docker-entrypoint.sh` before launching the application server.

To inspect running containers and health status:

```bash
docker compose ps
```

To tail logs for all services or a specific service:

```bash
docker compose logs -f
docker compose logs -f api
```

---

## 5. Web Interfaces & Endpoints

One Nginx container serves both production Angular apps on container port `8080`: user web is at `/` and admin web at `/console/`. API routes such as `/admin/*` remain proxied to the API, so the admin SPA must stay under `/console/`. Compose publishes the web port on `127.0.0.1` by default through `BIND_ADDRESS`; put a TLS reverse proxy in front of that single origin.

| Service | Container / host port | Default URL | Description |
|---|---:|---|---|
| **Web (user)** | `8080` / `8080` | `http://127.0.0.1:8080/` | Main user application |
| **Web (admin)** | `8080` / `8080` | `http://127.0.0.1:8080/console/` | Admin application, same origin |
| **API** | `3000` / `3000` | `http://127.0.0.1:3000` | Core API, health (`/health`), and interactive docs (`/docs`) |
| **Grafana** | `3000` / `3001` | `http://127.0.0.1:3001` | Monitoring dashboards (default user: `admin`) |
| **Uptime Kuma** | `3001` / `3002` | `http://127.0.0.1:3002` | Uptime and service status monitoring |

The `landing` site is an optional Compose profile, not part of a normal `docker compose up`. Start it with `docker compose --profile landing up -d`; it publishes loopback port `8082` by default and can use its own domain. PostgreSQL, Redis, RabbitMQ, Garage, and Prometheus remain internal to the Compose network. `WEB_PORT` changes the single published web host port while Nginx listens on container port `8080`.

### Google OAuth and public hostnames

Register this redirect URI in Google Cloud Console:

```text
${BETTER_AUTH_URL}/api/auth/callback/google
```

`BETTER_AUTH_URL` must be the public origin users open. For local Compose, use `http://localhost:8080`; behind the reverse proxy below, use `https://app.example.com`. User web lives at `/` and admin web at `/console/` on that origin. The browser sends Better Auth requests through the same-origin Nginx proxy.

The admin and user apps share the same host and port, so their browser cookies are shared by origin. Keep authorization enforced by the API's role checks and the web security policy; the `/console/` path is not an authorization boundary.

Example Caddy configuration for the single app origin:

```caddyfile
app.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

Set these values when using the example hostnames:

```dotenv
BETTER_AUTH_URL=https://app.example.com
TRUSTED_ORIGINS=https://app.example.com
```

The user and admin Sentry DSNs are optional Docker build arguments. Set `SENTRY_DSN_USER` and `SENTRY_DSN_ADMIN` in the Compose environment before building `web`; each value is embedded in that app's production JavaScript bundle. Leave them empty to disable browser Sentry reporting.

Nginx allows same-origin app assets and API requests, Sentry ingestion, Angular inline styles, and the same-origin sandboxed `srcdoc` email preview iframe. That iframe remains sandboxed without scripts or same-origin privileges.

After starting the production stack, run `make smoke-web` to check the shared web origin for both SPA entrypoints and deep links, API routing and content types, cache-variant headers, crawler policy, and the Scalar CSP hash on the protected `/docs` route (which returns 401 without a session). If the web port uses a non-default local mapping, set `WEB_URL`, for example `make smoke-web WEB_URL=http://localhost:18080`.

### Public landing site

The `landing` service is separate from the main web image and is disabled unless the `landing` Compose profile is selected. Start it with `docker compose --profile landing up -d` or `make up-landing`. It serves the public Angular site on container port `8082` (host port `LANDING_PORT`, default `8082`) and binds to `127.0.0.1` by default. Point a separate public domain's DNS at the server and terminate HTTPS at the proxy. For example, Caddy obtains and renews TLS certificates when the domain resolves to the host and ports 80 and 443 are reachable:

```caddyfile
landing.example.com {
    reverse_proxy 127.0.0.1:8082
}
```

The landing site's default `LANDING_APP_URL` follows `BETTER_AUTH_URL`; its other URL settings are independent. Set `API_UPSTREAM` if the Nginx web container needs a non-default API address. `PORT` is the Nginx container listener and defaults to `8080` (the Compose mapping targets that port).

Set these public URLs in `.env` before starting or rebuilding the service:

| Variable | Purpose |
|---|---|
| `LANDING_APP_URL` | User application URL used by the landing site's sign-in links. |
| `LANDING_SITE_URL` | Public landing origin used for canonical, Open Graph, and sitemap URLs. |
| `LANDING_REPO_URL` | Public source repository link. |
| `LANDING_DOCS_URL` | Public self-hosting guide link. |

The Express server reads these values at runtime and places them in an SSR-rendered metadata element; the Angular app reads that value through an injection token rather than a `window` global. Missing values use localhost defaults. The landing site serves a dynamic `robots.txt` that disallows the listed AI model crawlers while allowing general crawling and search crawlers. Express also returns `403` for requests whose user-agent matches the block list. These checks only guide or stop honest clients; user agents can be spoofed, so use a CDN or WAF if access must be enforced.

---

## 6. User Roles & Admin Privileges

LokaSlip uses Better Auth for user authentication.

To grant an account the `admin` role:
1. Include the user's email in the `ADMIN_EMAILS` environment variable in `.env`:
   ```bash
   ADMIN_EMAILS=user1@example.com,user2@example.com
   ```
2. When the user logs in via OAuth, the system evaluates `ADMIN_EMAILS` and assigns the administrative privileges accordingly.

### Seeding the Demo Project

Administrators can seed an example payroll project with sample employees, templates, mapping, and a draft campaign using the Makefile target:

```bash
make seed-demo
```

Alternatively, administrators can trigger the seed via the API:
```bash
curl -X POST http://localhost:8080/admin/demo-project \
  -H "Cookie: better-auth.session_token=..."
```
This endpoint is idempotent and returns HTTP 200 whether the project was newly created or already existed.

---

## 7. Backups & Persistence

Data is persisted across named Docker volumes:

- `postgres_data`: Relational database storage.
- `garage_meta`: Garage metadata database (SQLite index).
- `garage_data`: Garage object chunk data storage.
- `redis_data`: Cache and session store.
- `rabbitmq_data`: Message broker queues and dead-letter state.
- `prometheus_data`: Prometheus metric time-series database.
- `grafana_data`: Grafana configuration and dashboard storage.
- `uptime_kuma_data`: Uptime Kuma monitors and incident history.

### Database Backup (PostgreSQL)

```bash
docker compose exec -T postgres pg_dump -U lokaslip -d lokaslip > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Database Restore

```bash
docker compose exec -T postgres psql -U lokaslip -d lokaslip < backup.sql
```

### Garage Object Storage Backup

Back up both `garage_meta` and `garage_data` volumes together while the server is consistent:

```bash
docker run --rm \
  -v lokaslip_garage_meta:/meta \
  -v lokaslip_garage_data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/garage_$(date +%Y%m%d_%H%M%S).tar.gz /meta /data
```

---

## 8. Upgrades

To upgrade LokaSlip to the latest version:

1. Pull the latest code or update your repository:
   ```bash
   git pull origin main
   ```
2. Rebuild the application image and pull upstream infrastructure images:
   ```bash
   docker compose pull
   docker compose build api web
   ```
3. Restart the containers with zero or minimal downtime:
   ```bash
   docker compose up -d
   ```
   *Note: Database migrations run automatically during the `api` container startup.*

---

## 9. Security Considerations & Privacy

- **Localhost Binding**:
  By default, `docker-compose.yml` binds `web` (8080), `api` (3000), `grafana` (3001), and `uptime-kuma` (3002) to `127.0.0.1` using `${BIND_ADDRESS:-127.0.0.1}`. The optional landing service also defaults to `127.0.0.1` on port `8082`.
- **Isolated Internal Services**:
  PostgreSQL, Redis, RabbitMQ, Garage, and Prometheus publish **no** host ports; they communicate entirely through the internal Docker network.
- **Production Reverse Proxy & `TRUST_PROXY`**:
  Never expose ports directly to the public internet without a reverse proxy. Place a reverse proxy (e.g. Nginx, Caddy, Cloudflare Tunnel, or Traefik) in front of the services to terminate TLS/HTTPS, manage SSL certificates, and configure security headers (HSTS, CSP, X-Frame-Options). Set `TRUST_PROXY` (`1` by default in Docker Compose for the bundled Nginx proxy) so Express accurately resolves client IPs from `X-Forwarded-For`.
- **Encrypted Secrets & Platform Mail Precedence**:
  Project SMTP passwords (`SmtpConfig`) and Admin Setup integration credentials (`IntegrationConfig` for `uptime`, `grafana`, `mail`) are encrypted at rest in PostgreSQL with `APP_ENCRYPTION_KEY`. Secret values are never returned by API endpoints or logged in `AuditLog`. When `mail` is configured in `/admin/setup`, the database configuration takes precedence over `AUTH_SMTP_*` environment variables. Ensure `.env` permissions are restricted (`chmod 600 .env`) and never commit `.env` into version control.
- **Privacy & Map Tiles**:
  Login events store the client IP, best-effort proxy indicator (never set for private/loopback/Docker IPs), parsed user-agent metadata, and offline GeoIP coordinates (`geoip-lite`) for `LOGIN_EVENT_RETENTION_DAYS` (default 90 days). Opening a login location map preview fetches raster tiles on demand from OpenStreetMap (`https://tile.openstreetmap.org`), disclosing the viewer's client IP to OpenStreetMap contributors.

---

## 10. Troubleshooting

- **Hard-refresh after upgrades**:
  After rebuilding and restarting the `web` or `api` containers, hard-refresh your browser (`Cmd+Shift+R` or `Ctrl+Shift+R`) so the latest `/index.html` and hashed bundles are loaded.
- **`403 ACCOUNT_DISABLED`**:
  Returned on every authenticated request when an administrator has disabled the user account via `/admin/users/:id/disable` (active sessions are also deleted immediately). An enabled administrator must re-enable the account via `/admin/users/:id/enable` or the Admin Web **Users** page.
- **`400 EMAIL_CHANGE_UNAVAILABLE`**:
  Returned by `POST /api/auth/change-email` when neither the Admin Setup `mail` integration (`/admin/setup`) nor the `AUTH_SMTP_HOST` + `AUTH_MAIL_FROM` environment variables are configured.
- **`401 Unauthorized` on `/docs` or `/openapi.json`**:
  The Scalar API reference (`/docs`) and OpenAPI specification (`/openapi.json`) require an authenticated session. Sign in to the user app or admin app (`/console/`) on the shared origin first, then open `/docs`. Nginx serves `/docs` with a dedicated per-location CSP `script-src` hash (`'sha256-lmba+p2ZA26l0frITlGt+zVDpF9V987twNchN6VQgQ8='`).
- **Login activity shows `"Local network"`**:
  Signing in from `localhost` or directly through the Docker bridge network records a loopback or Docker gateway IP (e.g. `172.18.0.1`), which is private and has no GeoIP coordinates (`null` location, `proxy: false`). Behind an external reverse proxy, ensure `X-Forwarded-For` is forwarded and `TRUST_PROXY` matches your proxy hop count or CIDRs.
