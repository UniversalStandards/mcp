# HTTP API

The current service provides an authenticated JSON-RPC gateway and capability catalog. A full MCP transport bridge, initialization negotiation, downstream sessions, and cancellation forwarding are pending implementation. Do not configure clients as if this were a stdio server.

## Authentication and authorization

Supply one credential using `Authorization: Bearer <JWT-or-API-key>`, `Authorization: Api-Key <API-key>`, or `X-API-Key: <API-key>`. Duplicate or conflicting credential headers are rejected.

JWT verification permits HS256 only, requires an expiration, and requires a signing secret of at least 32 characters. Set `JWT_ISSUER` and `JWT_AUDIENCE` to constrain token issuers and intended recipients. A JWT subject identifies the principal; `scopes` and `roles` supply permissions.

API keys are stored as HMAC digests with expiry and revocation metadata. Configure `API_KEY_PEPPER` and provision keys through the operator-side `ApiKeyRegistry`. Registry changes require a process restart to refresh the running instance; this file-backed implementation is intended for a single writer.

| Route | Permission |
| --- | --- |
| `GET /health/live` | Public process liveness |
| `GET /health/ready` | Public readiness boolean |
| `GET /health` | `metrics:read` and role `admin`; component health |
| `GET /` | Public service description |
| `POST /mcp/v1`, `POST /` | Authenticated principal with `mcp:invoke` |
| `GET /metrics`, `GET /metrics/summary` | `metrics:read` and role `admin` |
| `GET /admin/cache/stats`, `POST /admin/cache/clear` | `admin:cache` and role `admin` |

Missing/invalid credentials return 401. Insufficient permissions return 403. Protected routes validate the Host authority and any Origin header. Non-loopback hosts and browser origins require explicit configuration.

## JSON-RPC methods

Requests use JSON-RPC 2.0 and an explicit ID:

```json
{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}
```

- `ping`: returns process status.
- `tools/list`: returns the two callable hub tools.
- `tools/call` with `name: "hub_list_servers"`: returns configured-server metadata with `callable: false`.
- `tools/call` with `name: "hub_search_servers"` and `arguments.query`: searches registries. Queries must contain 1–256 characters. Results are discoverable metadata and do not grant installation authority.
- `resources/list`: returns no downstream resources until a transport bridge is configured.
- Downstream `tools/call` and `resources/read`: return an error. No synthetic execution success is produced.

Unsupported or unavailable behavior must be treated as a failure by callers. Registry failures can produce partial or empty discovery results; they do not establish that a capability is absent.

## Operational responses

Liveness returns `{"alive":true}`. Readiness returns 200 or 503 with `{"ready":true|false}`; missing authentication configuration makes the instance unready while keeping liveness available.

JSON-RPC unknown methods return code `-32601`; unsuccessful operations return `-32603`. Errors preserve the request ID and omit internal failure details. The gateway remains a legacy compatibility API, so clients must not assume complete MCP notification/batch semantics.

Cache administration accepts an optional `pattern`. Use narrowly scoped patterns and authenticated administrative access. Deploy network rate limits and request budgets appropriate to the environment; the service does not yet enforce distributed rate limits.
