# Security Policy

## Supported Versions

LokaSlip is currently in active pre-release development (0.x). Security patches are applied exclusively to the latest released version and the `main` branch.

| Version | Supported          |
| ------- | ------------------ |
| 0.x     | Yes                |
| main    | Yes                |
| < 0.x   | No                 |

## Reporting a Vulnerability

We take the security of LokaSlip seriously. If you discover a vulnerability, please do not open a public GitHub issue or discussion.

Send a security report by email to dintasyaifuddin@gmail.com with the following details:

* Description of the vulnerability.
* Affected component (e.g., API, admin-web, user-web, worker, Docker compose).
* Clear step-by-step reproduction instructions or proof-of-concept.
* Assessment of the potential impact.
* Specific version, branch, or commit hash where the vulnerability was observed.

### Response Timeline

* **Acknowledgement**: Within 3 business days of receiving your report.
* **Status Update**: Within 7 business days with a validation assessment and remediation timeline.
* **Coordinated Disclosure**: We ask for coordinated disclosure to ensure a fix can be prepared and released before public discussion.
* **Credit**: Reporters who discover and report vulnerabilities in good faith will be credited in release notes upon request.

## Scope

### In Scope

* LokaSlip Express API and background workers.
* Admin and User web applications.
* The official Docker Compose deployment configurations.
* Authentication and session management mechanisms.
* Stored SMTP credential encryption at rest.
* File upload processing, validation, and object storage interactions.
* System metrics endpoints and OpenAPI/Scalar documentation routes.

### Out of Scope

* Social engineering attacks against project maintainers or users.
* Denial of service attacks relying solely on network or request volume.
* Vulnerabilities requiring root access or an already compromised host system.
* Vulnerabilities in external third-party services (such as user-configured SMTP providers or Google OAuth).
* Automated scanner output without a demonstrated practical impact or proof of concept.

## Safe Harbor

We consider security research conducted under this policy to be authorized. If you make a good-faith effort to avoid privacy violations, destruction of data, and interruption or degradation of service during your research, we will not pursue legal action against you or request that law enforcement investigate you.

## Hardening Notes for Self-Hosters

When self-hosting LokaSlip, keep the following security practices in mind:

* **Generate strong random secrets**: Generate cryptographically secure secrets for `POSTGRES_PASSWORD`, `RABBITMQ_PASSWORD`, `S3_SECRET_KEY`, `GARAGE_RPC_SECRET`, `GARAGE_ADMIN_TOKEN`, `BETTER_AUTH_SECRET`, and `METRICS_TOKEN`.
* **Bind ports to localhost**: Keep container ports bound to `127.0.0.1` (using `BIND_ADDRESS=127.0.0.1`) and expose services to the Internet only through an HTTPS reverse proxy with TLS termination.
* **Protect the metrics endpoint**: Keep `METRICS_TOKEN` high-entropy and restrict access to the `/metrics` endpoint.
* **Where secrets live & encryption key care**: Project SMTP passwords and admin integration credentials (`uptime`, `grafana`, `mail` in the `IntegrationConfig` table) are encrypted at rest in PostgreSQL using AES-256-GCM with `APP_ENCRYPTION_KEY`. Secret values are write-only and are never returned in API responses or recorded in `AuditLog` entries (only a masked 4-character suffix hint is returned). For platform mail, database-stored credentials configured via `/admin/setup` take precedence over `AUTH_SMTP_*` environment variables. Rotate `APP_ENCRYPTION_KEY` carefully; changing or losing this key without re-encrypting existing records prevents the platform from decrypting stored credentials.
* **Content Security Policy on `/docs`**: The OpenAPI reference at `/docs` requires an authenticated session (returns `401` when signed out) and is served by Nginx with a per-location Content-Security-Policy `script-src` SHA-256 hash (`'sha256-lmba+p2ZA26l0frITlGt+zVDpF9V987twNchN6VQgQ8='`) for the Scalar inline bootstrap script.

## Privacy & Data Retention

* **Login Activity & Device Metadata**: LokaSlip records login event metadata (`ipAddress`, best-effort proxy flag, browser, OS, device type, and approximate geolocation derived offline via `geoip-lite`) when a user signs in.
* **Local Network IPs & `TRUST_PROXY`**: Private, loopback, and Docker bridge gateway addresses (such as `172.18.0.1` when accessing local Compose ports directly) have no public geolocation and are shown as "Local network" in the UI with `null` coordinates. Behind a reverse proxy (including the bundled Nginx container), Express resolves the client IP from `X-Forwarded-For` according to `TRUST_PROXY` (`1` by default in Docker Compose for the single Nginx hop, `false` by default for bare API).
* **Proxy Detection**: The proxy indicator is best-effort only: it is set only when the resolved client IP is public and `X-Forwarded-For` contains multiple hops. Private, loopback, and Docker network IPs never set `proxy=true`. It is an informational signal, not a guarantee.
* **SSRF Protection in Integrations**: External integration endpoints (`/admin/setup`) enforce strict SSRF protections: only HTTP and HTTPS schemes are permitted, credentials in URLs are rejected, redirects are not followed during connectivity checks, and link-local/cloud metadata IPs (`169.254.0.0/16`, `fe80::/10`) are blocked.
* **Retention Policy**: Login activity records are retained for `LOGIN_EVENT_RETENTION_DAYS` (default: 90 days, range 1–3650 days). Expired records are automatically purged during API startup and every 24 hours.
* **Map Tile Requests**: Both web apps offer optional map previews for login events with coordinates. Map tiles are fetched on demand from OpenStreetMap (`https://tile.openstreetmap.org`) only when the user opens the map drawer, which discloses the viewer's client IP address to OpenStreetMap contributors under OpenStreetMap's privacy policy.
