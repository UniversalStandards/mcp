# Identity trust reference implementation

This repository is the reference MCP implementation for the Universal Identity, Authentication, Authorization & Trust Program. The cross-project manifest lives in `UniversalStandards/UniversalStandards/manifests/IDENTITY_TRUST_CONTROLS.json`; this document records the implementation boundary and must not become a second status tracker.

## Implemented contract slice

- `IAM-ARCH-001`: provider-neutral `PrincipalContext` parsing and validation.
- `IAM-ARCH-002`: separate credential extraction, validation, authentication and authorization interfaces.
- `IAM-AUTHZ-001`: fail-closed authorization wrapper for missing principals, tenant mismatch, malformed decisions and unavailable policy.
- `IAM-KEY-001` / `IAM-KEY-002`: secure API-key generation, keyed digest primitives, constant-time comparison, digest-only file-backed issuance, expiration and revocation. Database-backed persistence and vault brokering remain release-gated work.
- `IAM-OAUTH-001`: OIDC JWT verification through configured issuer, audience and remote JWKS, with claims normalized into `PrincipalContext`.
- `IAM-MCP-001`: HTTP authentication boundary for MCP and admin routes, `401`/`WWW-Authenticate` handling, RFC 9728 protected-resource metadata and configurable scope/role authorization.
- `IAM-AUDIT-001`: structured authentication and authorization audit events with credential/token field redaction.
- `IAM-TEST-001`: unit coverage for API-key lifecycle, fail-closed HTTP authentication and scope enforcement.

`authMethod=none` is reserved for the anonymous principal type; named principals
must use an actual authentication method. Policy adapters are treated as
untrusted boundaries: an `ALLOW` decision must include a non-empty control ID
and the `allowed` reason, and malformed decisions are denied.

## Explicit non-claims

The current slice does not claim production readiness. Production requires
explicit `MCP_AUTH_MODE=required`, configured API-key pepper or OIDC issuer/
audience/JWKS, protected secret delivery, deployment-specific integration and
conformance evidence, dependency/security review, rollback evidence and an
independent approving review. The registry is file-backed for this slice; a
multi-instance durable store and vault/managed-identity broker remain open.

Raw credentials are not accepted in `PrincipalContext`, policy requests or
audit metadata. The legacy credential store now fails closed in production
without `ENCRYPTION_KEY`; its file-backed persistence still requires a later
managed secret/vault integration for multi-instance production use.

## Runtime configuration

The server defaults to optional authentication outside production and required
authentication in production. Set these values explicitly in every deployment:

```text
MCP_AUTH_MODE=required
MCP_REQUIRED_SCOPES=mcp:invoke
API_KEY_PEPPER=<managed secret, at least 32 characters>
API_KEYS_FILE=./cache/api-keys.json
AUDIT_LOG_FILE=./cache/audit.log
OIDC_ISSUER=https://issuer.example
OIDC_AUDIENCE=universal-mcp
OIDC_JWKS_URL=https://issuer.example/.well-known/jwks.json
```

API-key tokens are displayed only at creation time. The registry persists the
HMAC digest and principal metadata, never the token or pepper. The API-key
creation/revocation functions are library contracts in this slice; an
administrative issuance API must add explicit operator authorization,
approval, rate limits and vault delivery before exposure.
