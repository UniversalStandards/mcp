# MCP API reference

## Streamable HTTP

`POST /mcp` accepts MCP requests. Initialize first, then send the returned `Mcp-Session-Id` on later requests. `GET /mcp` supports the transport's server stream, and `DELETE /mcp` closes a session. Clients must accept `application/json` and `text/event-stream`.

The current tools are read-only:

| Tool | Input | Result |
| --- | --- | --- |
| `hub_list_servers` | none | Locally configured adapter metadata, with sensitive values redacted |
| `hub_search_servers` | `query` (1–200 characters), optional `capability` and `limit` (1–25) | Matching public registry listings |
| `hub_health` | none | Current local health checks |

The `universal://info` resource returns basic hub metadata. Tool results are text content containing JSON. Registry listings are untrusted external data; no tool installs or executes a listed server.

```bash
curl -i http://127.0.0.1:3000/mcp \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1.0.0"}}}'
```

If `MCP_AUTH_TOKEN` is set, send `Authorization: Bearer <token>` on every MCP request. Browser `Origin` values must appear in `MCP_ALLOWED_ORIGINS`; ordinary non-browser local clients may omit `Origin`.

## Health and administration

| Endpoint | Behavior |
| --- | --- |
| `GET /health/live` | Process liveness; `{ "alive": true }` when live |
| `GET /health/ready` | Readiness; 503 when not ready |
| `GET /health` | Detailed health |
| `GET /metrics` | In-process metrics |
| `GET /metrics/summary` | Text summary |
| `GET /admin/cache/stats` | Cache statistics |
| `POST /admin/cache/clear` | Clear cache; requires configured `MCP_AUTH_TOKEN` and matching bearer token |

The cache-clear body may contain a `pattern` string. With no pattern it clears the entire cache. This is a local administrative endpoint, not a multi-user API.

`POST /mcp/v1` and `POST /` return HTTP 410. Legacy JSON-RPC execution is retired; callers must not interpret the response as a successful tool call.
