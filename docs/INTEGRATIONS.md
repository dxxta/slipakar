# API integrations

Self-hosted Slipakar can expose a scoped bearer-key API for server-to-server integrations. It is disabled by default. The hosted cloud service at `slipakar.akarun.site` keeps this capability disabled.

## Enablement

Both switches must be on:

| Setting | Default | Purpose |
| --- | --- | --- |
| `API_ACCESS_ENABLED` | `false` | Operator-controlled environment master switch. Recreate the API service after changing it. |
| `API_ALLOWED_ORIGINS` | empty | Comma-separated absolute browser origins allowed to use bearer keys. Empty allows no browser origins; command-line/server requests without an `Origin` remain possible. |
| Admin Setup → API access | `false` | Runtime switch persisted through System Config. Takes effect only while the environment master switch is enabled. |

Allowed origins must be origins such as `https://console.example.com`, with no path. API access is enabled only when both switches are true. The admin setup card shows the environment state and origin allowlist; it never shows project keys.

## Create and manage keys

A project owner signs in with a normal browser session and opens **API keys** in that project's navigation. Create a key with a clear name, one or more scopes, and optionally a future expiry date. The full value has the form `slp_<id>_<secret>` and is returned once. Copy it immediately. Lists show only the public prefix and metadata. Revoking a key takes effect immediately. A project may have up to 10 active keys.

Management endpoints require a cookie session and project ownership:

- `GET /projects/{projectId}/api-keys`
- `POST /projects/{projectId}/api-keys` with `{ "name": "Payroll sync", "scopes": ["templates:read"] }`
- `DELETE /projects/{projectId}/api-keys/{id}`

## Scopes

| Scope | Allowed operations |
| --- | --- |
| `templates:read` | List/read email and PDF templates. |
| `templates:write` | Create/update/delete email and PDF templates; render PDF previews. |
| `uploads:read` | List uploads and read upload metadata/preview. |
| `uploads:write` | Upload or delete data files. |
| `mappings:read` | Read a project's field mapping. |
| `mappings:write` | Create or update a mapping. |
| `campaigns:read` | List campaigns and read campaign details. |
| `campaigns:write` | Create a campaign. |
| `campaigns:send` | Start a campaign send. |
| `recipients:read` | List a campaign's recipients and delivery status. |
| `smtp:read` | List SMTP connections without credentials. |

All routes are denied to API keys unless listed above. A key is bound to one project; requests for any other project are forbidden. API keys cannot use admin, authentication, user settings, notifications, SMTP details or mutations, project-management, retry, or key-management routes.

## Examples

```sh
export SLIPAKAR_API_URL="https://app.example.com"
export SLIPAKAR_API_KEY="slp_<id>_<secret>"

curl --fail-with-body "$SLIPAKAR_API_URL/projects/<project-id>/templates" \
  -H "Authorization: Bearer $SLIPAKAR_API_KEY"

curl --fail-with-body -X POST "$SLIPAKAR_API_URL/projects/<project-id>/campaigns/<campaign-id>/send" \
  -H "Authorization: Bearer $SLIPAKAR_API_KEY"
```

The interactive scoped reference is at `/integrations/docs`; the raw OpenAPI document is `/integrations/openapi.json`. Both are available without a cookie only while API access is active.

## Limits and security

Each key is limited to 120 requests per minute using the server's Redis limiter. Requests from browsers are accepted only when their exact `Origin` appears in `API_ALLOWED_ORIGINS`; CORS allows only `Authorization` and `Content-Type` and never enables credentials or wildcard origins. Server-to-server requests without an `Origin` are not restricted by the browser-origin list.

Only a SHA-256 digest of the full key is stored. Hash comparisons are constant-time; revoked and expired keys are rejected. Keys are never returned after creation or written to audit records. Store the one-time value in a secrets manager, avoid shell history and logs, and revoke it immediately if exposed. API keys inherit the project owner's account-disabled status and project boundary.
