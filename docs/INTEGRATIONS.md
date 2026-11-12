# API integrations

Self-hosted Slipakar can expose a scoped bearer-key API for server-to-server integrations. It is disabled by default. The hosted cloud service at `slipakar.akarun.site` keeps this capability disabled.

## Enablement

Both switches must be on:

| Setting | Default | Purpose |
| --- | --- | --- |
| `API_ACCESS_ENABLED` | `false` | Operator-controlled environment master switch. Recreate the API service after changing it. |
| `API_ALLOWED_ORIGINS` | empty | Comma-separated absolute browser origins allowed to use bearer keys. Empty allows no browser origins, command-line/server requests without an `Origin` remain possible. |
| Admin Setup → API access | `false` | Runtime switch persisted through System Config. Takes effect only while the environment master switch is enabled. |

Allowed origins must be origins such as `https://console.example.com`, with no path. API access is enabled only when both switches are true. The admin setup card shows the environment state and origin allowlist, it never shows project keys.

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
| `templates:write` | Create/update/delete email and PDF templates, render PDF previews. |
| `uploads:read` | List uploads and read upload metadata/preview. |
| `uploads:write` | Upload or delete data files. |
| `mappings:read` | Read a project's field mapping. |
| `mappings:write` | Create or update a mapping. |
| `campaigns:read` | List campaigns and read campaign details. |
| `campaigns:write` | Create a campaign. |
| `campaigns:send` | Start a campaign send. |
| `recipients:read` | List a campaign's recipients and delivery status. |
| `smtp:read` | List SMTP connections without credentials. |

All routes are denied to API keys unless listed above. A key is bound to one project, requests for any other project are forbidden. API keys cannot use admin, authentication, user settings, notifications, SMTP details or mutations, project-management, retry, or key-management routes.

## Examples

```sh
export SLIPAKAR_API_URL="https://app.example.com"
export SLIPAKAR_API_KEY="slp_<id>_<secret>"

curl --fail-with-body "$SLIPAKAR_API_URL/projects/<project-id>/templates" \
  -H "Authorization: Bearer $SLIPAKAR_API_KEY"

curl --fail-with-body -X POST "$SLIPAKAR_API_URL/projects/<project-id>/campaigns/<campaign-id>/send" \
  -H "Authorization: Bearer $SLIPAKAR_API_KEY"
```

The interactive scoped reference is at `/integrations/docs`, the raw OpenAPI document is `/integrations/openapi.json`. Both are available without a cookie only while API access is active.

## Limits and security

Each key is limited to 120 requests per minute using the server's Redis limiter. Requests from browsers are accepted only when their exact `Origin` appears in `API_ALLOWED_ORIGINS`, CORS allows only `Authorization` and `Content-Type` and never enables credentials or wildcard origins. Server-to-server requests without an `Origin` are not restricted by the browser-origin list.

Only a SHA-256 digest of the full key is stored. Hash comparisons are constant-time, revoked and expired keys are rejected. Keys are never returned after creation or written to audit records. Store the one-time value in a secrets manager, avoid shell history and logs, and revoke it immediately if exposed. API keys inherit the project owner's account-disabled status and project boundary.

## Embedding a project

Embedding lets a third-party site display selected Slipakar screens for one project in an iframe. It is off by default and the hosted cloud keeps it disabled.

### Enablement

All three gates must allow it:

| Setting | Default | Purpose |
| --- | --- | --- |
| `EMBED_ALLOWED_ORIGINS` | empty | Comma-separated parent-site origins. Use absolute HTTPS origins, `http://localhost[:port]` is allowed for development. Wildcards, paths, credentials, and other HTTP hosts are rejected. |
| Admin Setup → API access | `false` | The API access environment and runtime switches must both be active. |
| Admin Setup → Embedding | `false` | Runtime embedding switch, the setup card is read-only/disabled while origins or API access are inactive. |

A project API key also needs the `embed:create` scope and the project data scopes to be shown. Embed scopes are limited to templates, uploads, mappings, campaigns, and recipients. SMTP, project/key management, admin, user settings, authentication, and notifications are not available in an embed session.

### Three-step flow

1. Your server calls `POST /projects/{projectId}/embed-tokens` with its project API key and a strict JSON body such as `{ "parentOrigin": "https://payroll.example.com", "scopes": ["templates:read", "uploads:read"] }`. The API returns a one-use launch token and an iframe URL. Keep the API key on your server, never put it in browser code.
2. Put the returned URL in an iframe. Slipakar exchanges the launch token once, removes it from the address bar, and uses a short-lived bearer session inside the frame.
3. Optionally listen for the documented `postMessage` events below. Always check the message origin and source before acting.

Example server-side JavaScript (keep `SLIPAKAR_API_KEY` in server configuration):

```js
const response = await fetch(`${SLIPAKAR_API_URL}/projects/${projectId}/embed-tokens`, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${process.env.SLIPAKAR_API_KEY}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    parentOrigin: 'https://payroll.example.com',
    scopes: ['templates:read', 'uploads:read'],
    theme: { mode: 'system', style: 'styled' },
  }),
});
const result = await response.json();
if (!response.ok) throw new Error(result.error?.message ?? 'Could not create embed session');
// Render result.data.url into the page's iframe src from your server.
```

```html
<iframe id="slipakar-embed" title="Slipakar project workspace" src="SERVER_RENDERED_EMBED_URL" style="width:100%;border:0"></iframe>
<script>
  window.addEventListener('message', (event) => {
    if (event.origin !== 'https://slipakar.example.com') return;
    if (event.data?.source !== 'slipakar') return;
    if (event.data.type === 'resize' && Number.isFinite(event.data.height)) {
      document.querySelector('#slipakar-embed').style.height = `${event.data.height}px`;
    }
    if (event.data.type === 'expired') {
      // Ask the host page to request a fresh URL from its server.
    }
  });
</script>
```

The frame sends `{source: "slipakar", type: "ready"}` after exchange, `{source: "slipakar", type: "expired"}` when the session expires or an API request returns 401, and `{source: "slipakar", type: "resize", height}` as its content height changes. It does not accept inbound messages in this version.

### Security and browser behavior

Launch tokens are random, stored only in Redis as SHA-256 hashes, expire after five minutes, and can be exchanged once. The resulting `slpe_` session is also stored hashed, expires after 60 minutes, is bound to one project, parent origin, selected scopes, and source API key, and stops working immediately if that key is revoked/expired or its owner is disabled. Exchange is limited to 20 attempts per IP per minute, embed API sessions are limited to 120 requests per minute. Requests use bearer authorization and do not send or set cookies, so cross-site cookies and third-party-cookie settings are not required. The frame response's CSP permits only the configured origins as frame ancestors, other web routes continue to deny framing.
