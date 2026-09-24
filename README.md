# Universal Standards MCP Server

A local, read-only MCP control plane for discovering public server listings and inspecting locally configured adapters. The current Streamable HTTP endpoint is `/mcp`; it does **not** run or proxy the adapters listed in `config/mcp-config.json`.

## What works today

- `hub_list_servers`: list configured adapter metadata with sensitive fields redacted.
- `hub_search_servers`: search GitHub and the official MCP registry. Results are discovery data, not trusted installation instructions.
- `hub_browse_mcp_registry`: page through the official MCP Registry's published server metadata, including name, version, transport type, provenance, and an opaque continuation cursor. Entries are discoverable only.
- `hub_health`: report local process and dependency health.
- `universal://info`: read hub metadata.

The old `/mcp/v1` and root JSON-RPC routes return HTTP 410. They previously returned mock execution results and could attempt to install registry packages. Automatic installation, downstream tool execution, multi-tenant authorization, and production remote hosting are **not implemented**. Do not grant the hub credentials on the assumption that configured adapters can be called through it.

## Local setup

Requires Node.js 22 and npm, or Docker Desktop with Linux containers.

```bash
npm ci
npm run build
npm run validate
npm test -- --runInBand
npm start
```

The Node process binds to `127.0.0.1:3000` by default. For Docker:

```bash
docker compose up --build -d
docker compose ps
curl http://127.0.0.1:3000/health/live
```

Compose publishes only to host loopback by default. `MCP_HOST_PORT` changes the host port. Set `MCP_AUTH_TOKEN` to require a bearer token for MCP requests and cache administration. Cache administration remains disabled without a token. Browser requests with an `Origin` header are rejected unless that origin is explicitly listed in `MCP_ALLOWED_ORIGINS`. Do not expose this service beyond a trusted local machine without a separate, reviewed authentication and TLS deployment design.

To connect an MCP client, use `http://127.0.0.1:3000/mcp`. The first request must be MCP `initialize`; subsequent requests carry the returned `Mcp-Session-Id`. See [API reference](docs/API.md).

## Configuration and credentials

`config/mcp-config.json` is a local adapter inventory, not an execution plan. Validate edits with `npm run validate`. Use environment variables or a local secret manager for tokens; never commit `.env`, plaintext secrets, or generated credential stores. No GitHub or AI token is required to list configured adapters or read health. Registry search may use a GitHub token for higher API limits.

The checked-in `schema/hub-schema.json` describes an aspirational hub data model; `schema/mcp-config.schema.json` is the schema actually used to validate the adapter inventory.

The intended marketplace includes MCP servers, skills, connectors, and extensions as distinct capability types. A listing does not imply that its code is installed or that this hub can call it. The current source coverage and the governed path for building a missing capability are recorded in [marketplace architecture](docs/MARKETPLACE.md).

## Quality gate

`npm run build`, `npm run lint`, `npm run validate`, the Jest suite, a production dependency audit, and a clean Docker verification build run on pull requests. Locally, `docker build --target verify .` checks the project in a fresh dependency environment. See [contributing](CONTRIBUTING.md) and [security](SECURITY.md).

## Roadmap and limits

Downstream adapter execution requires a separate design for per-tool authorization, process sandboxing, package provenance, approval, timeouts, auditability, and result verification. Registry discovery is deliberately read-only until those controls exist. Historical design notes under `docs/` may describe proposed features; they are not evidence that those features are deployed.

Licensed under [MIT](LICENSE).
