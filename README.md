# Universal MCP Hub

Universal Standards' capability discovery and gateway component for the ATLANTIS portfolio. ATLANTIS coordinates policy and planning; SWARM coordinates workers; HITMAN dispatches tasks; UMOF/MCP supplies capability discovery and interoperability.

## Current capability

The service exposes an authenticated HTTP JSON-RPC gateway, registry search, a configured-server catalog, encrypted credential storage, health checks, and metrics.

The callable built-in tools are `hub_list_servers` and `hub_search_servers`. Configured or discovered downstream servers are metadata entries. Downstream tool execution and resource reading require a transport bridge and currently return errors. The legacy gateway does not implement the complete MCP transport lifecycle; see [API](docs/API.md).

Discovery does not grant installation or execution authority. Automatic installation is disabled by default. The installer additionally requires an exact npm package version on `MCP_APPROVED_PACKAGES`, omits lifecycle scripts, and uses a bounded subprocess without a shell.

## Run locally

Use Node.js 22.x and npm. A clean dependency install is the source of truth; generated dependencies and compiled output are ignored by Git.

```sh
npm ci --ignore-scripts
cp .env.example .env
npm run build
npm start
```

Set `JWT_SECRET` to a randomly generated secret of at least 32 characters before issuing tokens. Alternatively provision a scoped API key with the file-backed registry and a separate `API_KEY_PEPPER`. Set `ENCRYPTION_KEY` separately before storing encrypted credentials. Never commit these values.

The default bind address is loopback. Docker binds to all container interfaces; publish the port to the intended local interface. Protected requests accept loopback Host headers by default. Configure `MCP_ALLOWED_HOSTS` with the deployed authority and `MCP_ALLOWED_ORIGINS` only for approved browser origins.

```sh
curl http://127.0.0.1:3000/health/live
curl http://127.0.0.1:3000/mcp/v1 \
  -H "Authorization: Bearer $MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

JWTs must have a subject, expiration, and the required scope. MCP calls require `mcp:invoke`; metrics require `metrics:read` and the `admin` role; cache administration requires `admin:cache` and the `admin` role. Tokens are issued by trusted operator tooling using `src/auth/jwt-handler.ts`; there is no public token-minting endpoint.

## Verify

```sh
npm run typecheck
npm run lint
npm run validate
npm run test:ci
npm run build
npm audit --omit=dev
docker build --target verify .
docker build --target runtime -t universal-mcp-hub .
```

Tests include real HTTP requests and security regressions. `npm run validate` validates the actual `config/mcp-config.json` against its schema and checks the hub schema baseline with URI/date formats enabled.

## Configuration and operation

- [API and authentication](docs/API.md)
- [Deployment and recovery](docs/DEPLOYMENT.md)
- [Current implementation status](IMPLEMENTATION_SUMMARY.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

External AI normalization is optional; `AI_PROVIDER=local` is the default. Provider requests have timeouts, bounded output, schema validation, and sensitive-field redaction. Redaction is based on field names; arbitrary sensitive text must not be sent to external providers without a deployment data policy.

Registry installation and generated execution remain governed capabilities: approval, package provenance, isolation, lifecycle verification, audit evidence, cancellation, and rollback must be established before broadening execution.

## License

[MIT](LICENSE).
