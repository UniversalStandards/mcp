# Local deployment

The supported deployment profile is a single-user local Docker Desktop or Node.js process. Remote/multi-tenant production deployment has not been validated.

1. Review `config/mcp-config.json` and run `npm run validate`.
2. Optionally set a local `MCP_AUTH_TOKEN` in an uncommitted `.env` file. Do not add credentials unless a specific read-only registry integration requires them.
3. Run `docker compose up --build -d`. Compose binds the host port to `127.0.0.1` and starts the application as a non-root user.
4. Check `docker compose ps` and `curl http://127.0.0.1:3000/health/live`.
5. Connect an MCP client to `http://127.0.0.1:3000/mcp` and verify `initialize`, `tools/list`, one read-only tool call, and session close.

For updates, run `docker compose build` and `docker compose up -d`; check health and tool calls again. Keep a copy of any local configuration and Docker volumes before changing runtime versions. To roll back, restore the previously known-good image and configuration rather than deleting volumes.

Do not publish the port on a non-loopback interface or put it behind a public proxy merely by setting a bearer token. Remote deployment needs an explicit identity, TLS, authorization, rate-limit, audit, and secret-handling design, with negative tests.
