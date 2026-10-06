# Identity trust reference implementation

This repository is the reference MCP implementation for the Universal Identity, Authentication, Authorization & Trust Program. The cross-project manifest lives in `UniversalStandards/UniversalStandards/manifests/IDENTITY_TRUST_CONTROLS.json`; this document records the implementation boundary and must not become a second status tracker.

## Implemented contract slice

- `IAM-ARCH-001`: provider-neutral `PrincipalContext` parsing and validation.
- `IAM-ARCH-002`: separate credential extraction, validation, authentication and authorization interfaces.
- `IAM-AUTHZ-001`: fail-closed authorization wrapper for missing principals, tenant mismatch, malformed decisions and unavailable policy.
- `IAM-KEY-001` / `IAM-KEY-002`: secure API-key generation, keyed digest primitives and constant-time comparison. Durable issuance, one-time display, lifecycle persistence and vault brokering remain release-gated work.

`authMethod=none` is reserved for the anonymous principal type; named principals
must use an actual authentication method. Policy adapters are treated as
untrusted boundaries: an `ALLOW` decision must include a non-empty control ID
and the `allowed` reason, and malformed decisions are denied.

## Explicit non-claims

The current slice does not claim that the HTTP server is protected, that OAuth/OIDC is wired, that credentials are stored in a durable database, or that MCP protected-resource metadata is complete. Those capabilities require the remaining controls, integration tests, conformance evidence and independent review before release.

Raw credentials are not accepted in `PrincipalContext`, policy requests or audit metadata. The existing legacy credential store remains outside this contract slice until its insecure development fallback and persistence model are replaced under the credential-lifecycle workstream.
