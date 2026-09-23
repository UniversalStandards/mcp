# Security policy

Report suspected vulnerabilities privately through [GitHub's vulnerability reporting for this repository](https://github.com/UniversalStandards/mcp/security/advisories/new). Do not post exploit details or credentials in a public issue.

## Current security boundary

This server is intended for a trusted, single-user local machine. Docker Compose publishes the MCP port on host loopback only; the bare Node process also defaults to loopback. MCP requests may be protected with `MCP_AUTH_TOKEN`. Cache clearing requires a configured token and a matching bearer header. Browser requests with an unlisted `Origin` are denied. These are local protections, **not** a complete remote authentication or tenant-isolation system.

The MCP tools only inspect configuration, search public registries, and report health. They do not execute configured adapters. The retired legacy RPC paths return HTTP 410. Automatic package installation is disabled. Do not expand the service to a public network or enable downstream execution without a separate threat model, per-tool authorization, package provenance, sandboxing, rate limits, audit logs, and tests.

The repository includes an AES-256-GCM credential-store module, but that module is not the authentication system for `/mcp`. It must be configured with a strong, separately managed `ENCRYPTION_KEY` before use with real credentials. Review backup, rotation, and filesystem access controls before relying on it; no claim of multi-user isolation is made.

Never commit `.env`, access tokens, key material, or credential files. Use narrowly scoped credentials and rotate any credential that may have been exposed. Pull requests run a build, tests, lint, config validation, and dependency audit; CodeQL runs separately. A passing scan does not substitute for human review.
