# Implementation status

This file replaces historical production-readiness claims with the current implementation boundaries.

## Implemented in the hardening branch

- Node.js 22 container runtime and a TypeScript/Jest-compatible locked toolchain.
- Clean dependency installation; generated dependencies and compiled output removed from Git tracking.
- Authenticated MCP, metrics, and cache administration with explicit scopes and administrative roles.
- JWT expiry/algorithm checks, API-key digest storage, and removal of default signing/encryption secrets.
- Host/Origin validation, public liveness, configuration-sensitive readiness, and bounded listener shutdown.
- An installer using argument-based subprocess execution, exact approved package versions, disabled lifecycle scripts, and a timeout.
- Callable server-catalog and registry-search hub tools. Downstream execution fails explicitly until a transport bridge is implemented.
- Actual MCP configuration schema validation, enabled URI/date formats, and active HTTP integration tests.
- CI/workflow hardening and Docker verification.

## Operational boundaries

Configured, discoverable, approved, installed, and callable capabilities are separate states. Registry search and package installation do not prove execution readiness.

The HTTP JSON-RPC gateway does not yet implement the full MCP transport/session lifecycle. Existing transport and identity work on other branches must be reconciled through reviewed integration changes.

Credential storage and the API-key registry use local files. Multi-instance writes, automatic revocation reload, protected secret brokering, and durable audit storage require further work.

## Verification

Use the current CI run and checked commit as the verification record. The supported commands are listed in [README.md](README.md). Local Windows checks may run under a different host Node version; the Docker verification target runs the supported Node 22 toolchain.

## Release requirements still outstanding

- Complete and test downstream MCP transport execution, lifecycle, cancellation, and recovery.
- Establish capability approval, package provenance, isolation, verification, and rollback.
- Add rate limits, durable audit receipts, and a production identity/secret integration.
- Triage remaining development-tool dependency advisories.
- Verify CI on the proposed pull request and release signed, traceable images.
- Validate the target deployment, restore procedures, and operational alerts.

This branch is a hardening foundation. It is not a declaration that the entire platform is ready for production.
