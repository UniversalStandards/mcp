# Deployment and recovery

Use Node.js 22.x. The service currently supports the authenticated gateway and capability catalog described in [API.md](API.md). Downstream MCP execution is not a deployment-ready feature.

## Container

```sh
docker build --target verify .
docker build --target runtime -t universal-mcp-hub .
docker run --name universal-mcp-hub --init \
  --cap-drop ALL --security-opt no-new-privileges:true \
  -p 127.0.0.1:3000:3000 --env-file .env \
  --env HOST=0.0.0.0 --env MCP_ALLOWED_HOSTS=127.0.0.1:3000,localhost:3000 \
  universal-mcp-hub
```

The image installs locked production dependencies without package lifecycle scripts, compiles with the locked build toolchain, and runs as user `node`. Application code and dependencies remain owned by root; only runtime data directories belong to the service user. The health check probes `/health/live`. Use a secret broker or protected environment file; do not place secret values in command arguments or logs.

Persist the cache/credential directory using a volume appropriate to the host. Secure the volume independently: POSIX modes alone do not establish Windows ACL protection. Back up encrypted credential records together with the separate encryption key through an approved secret backup mechanism.

## Configuration

| Variable | Default / requirement |
| --- | --- |
| `HOST` | Loopback for direct startup; `0.0.0.0` in Docker |
| `PORT` | `3000` |
| `BODY_LIMIT` | `1mb` |
| `JWT_SECRET` | At least 32 random characters for JWT authentication; no fallback |
| `JWT_ISSUER`, `JWT_AUDIENCE` | Optional token issuer/audience restrictions |
| `API_KEY_PEPPER` | At least 32 random characters for API-key authentication |
| `API_KEYS_FILE` | `./cache/api-keys.json`; scoped key registry |
| `ENCRYPTION_KEY` | At least 32 characters when credential storage is used; no fallback |
| `CREDENTIALS_FILE` | `./cache/credentials.json` |
| `CACHE_DIR` | `./cache` |
| `MCP_ALLOWED_HOSTS` | Comma-separated authorities; empty permits loopback only |
| `MCP_ALLOWED_ORIGINS` | Comma-separated approved browser origins; empty denies requests carrying Origin |
| `AI_PROVIDER` | `local`; optional external `openai` or `anthropic` |
| `MCP_AUTO_INSTALL` | `false` |
| `MCP_APPROVED_PACKAGES` | Empty; exact versioned package specifiers only |
| `MCP_INSTALL_TIMEOUT_MS` | `300000`, bounded to 5 seconds–15 minutes |

Use separate values for authentication signing, API-key hashing, and credential encryption. Missing configured-provider credentials or authentication configuration makes readiness fail. Health reports do not verify external registry/provider connectivity or downstream capability execution.

## Release procedure

1. Require successful build, type, lint, schema, unit/integration, dependency, and Docker checks for the proposed commit.
2. Test authenticated routes and denied requests in staging. Verify the intended external Host/Origin configuration.
3. Terminate TLS at an approved ingress; configure network access, request limits, logs, and alerts.
4. Keep automatic installation disabled until package provenance, explicit approval, sandboxing, and recovery are established.
5. Deploy an immutable image digest. Record the source commit, deployment configuration, and rollback digest.
6. Verify liveness and readiness, then make an authenticated hub call.

## Recovery

For a failed rollout, restore the previous image digest and its compatible configuration. Diagnose readiness failures through the health report and protected metrics. Restore credential/configuration backups only with the matching keys; never substitute a default key.

API-key revocation is persisted by the registry. Restart instances after registry changes; concurrent writers and automatic registry reload are not implemented. Use an external identity/secret service for multi-instance deployments.

Stored credentials created with the former development encryption key require an explicit migration: decrypt with the known old key in an isolated process, re-encrypt with the new key, verify retrieval, then retire the old material. Do not overwrite existing credential files with empty data.

`rotateKey(oldKey, newKey)` prepares every encrypted record before replacing the file and preserves metadata. A failed decryption leaves the original store intact. After successful rotation, update the secret broker's `ENCRYPTION_KEY` and restart the service; the function does not mutate process environment configuration.

The server handles SIGTERM/SIGINT and drains the HTTP listener with a bounded shutdown deadline. Configure the orchestrator grace period to exceed that deadline.

## Remaining release work

Full downstream MCP transport execution, registry provenance and package isolation, distributed rate limits, durable audit receipts, and signed/released image distribution need further implementation and verification. CI definitions and a local image build do not establish a production deployment.
