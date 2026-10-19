# Repository review and hardening record

Review baseline: `origin/main` at `9b145a6`. Implementation branch: `codex/mcp-hardening-integration`. Review date: 2026-10-18.

## Component status

| Area | Observed status after this hardening pass |
| --- | --- |
| Build/toolchain | Clean Node 22 Docker install, build, type check, lint, schema validation, and tests pass. TypeScript is aligned with ts-jest. |
| Git hygiene | 12,919 dependency files and 48 build outputs removed from version control. Local copies remain available; caches and credential stores are ignored. |
| HTTP security | Explicit JWT/API-key identity; scopes and admin roles; Host/Origin checks; bounded bodies and listener shutdown; protected MCP/admin/metrics/detail-health namespaces. |
| Credential storage | Default encryption key removed. Ciphertext writes use file replacement; rotation prepares all records before replacing the store. Failed rotation preserves data. |
| API-key lifecycle | Digest-only storage, expiry validation, revocation, and defensive copies. Single-process/single-writer design; external file changes require restart. |
| Capability catalog | Configured-server listing and registry search are callable hub tools. Results distinguish configured/discoverable metadata from callable capabilities. |
| Downstream MCP execution | Still incomplete. Tool/resource execution returns an error rather than simulated success. Full transport/session negotiation must be integrated. |
| Installation | Invocation cannot install packages. The separate installer requires explicit opt-in and exact approved versions, disables lifecycle scripts, avoids shell expansion, and has a timeout. |
| AI normalization | Local default; optional provider calls have timeouts, bounded responses, schema validation, sensitive-field redaction, and safe error logging. Free-text sensitive data still needs a deployment data policy. |
| Registry integration | Existing adapters and caching remain. End-to-end live registry compatibility, trustworthy package mapping, partial-failure reporting, and provenance remain open work. |
| CI | Added quality and Docker checks, action SHA pins, least-privilege permissions, dependency review/audit, and recoverably disabled unfinished automation. Automatic merge/install paths removed. CodeQL uses the existing repository-managed default setup; the duplicate custom workflow was removed. |
| Container | Node 22, non-root, locked production-only dependencies, liveness healthcheck, root-owned code/dependencies, separate writable runtime directories. |
| Documentation | README/API/deployment/status now describe implementation boundaries. Remaining older architecture/troubleshooting material requires reconciliation with the eventual transport design. |
| Production operations | No production rollout, image registry publication, protected-branch configuration change, or release was performed in this pass. |

## Verified evidence

- Windows host checks: lint with zero warnings, build/type checking, schema validation, and 124 tests across nine suites pass. The host uses Node 26; supported-runtime verification was performed separately in Docker.
- Docker `verify` target on Node 22: clean locked install, build, type check, lint, schema validation, and all 124 tests pass.
- Docker runtime: non-root identity and image metadata confirmed. An isolated container with networking disabled and Linux capabilities dropped passes public liveness/readiness, 14 invalid/missing-credential denials, scoped metrics/admin access, authenticated hub calls, and explicit downstream execution failure.
- Runtime code and dependencies are not writable by the service user; the cache directory is writable.
- `npm audit --omit=dev` reports zero findings. Full audit reports 20 moderate findings through the test-tooling chain ending in `sprintf-js`; no high/critical findings were observed. Registry metadata checked during this pass did not offer a patched compatible release for that leaf. No forced major downgrade was applied.
- Workflow authoring checks include actionlint, shell syntax, and official action-reference verification. The later Docker-smoke refactor uses the same repository script for local and CI execution.

These are local verification results, not evidence that GitHub checks ran or a deployment succeeded. The local CLI identity preflight returned HTTP 401; the separate GitHub connector confirmed the authenticated UniversalStandards account.

## GitHub verification and CodeQL reconciliation

The first remote quality gate, dependency review, and npm audit passed. Custom CodeQL analysis completed but GitHub rejected its SARIF upload because repository default setup is already enabled. An authenticated read of `/repos/UniversalStandards/mcp/code-scanning/default-setup` confirmed `state: configured`, Actions and JavaScript/TypeScript languages, and weekly scanning. The duplicate advanced workflow was removed while retaining that managed security configuration. No security setting was disabled.

GitHub documents that [default setup blocks advanced CodeQL uploads](https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/configure-code-scanning/configure-code-scanning). Managed default-setup results must be verified independently; a configuration read is not a successful scan of this branch.

## Prioritized remaining work

1. **MCP interoperability:** reconcile the existing runtime/identity branches and implement full Streamable HTTP lifecycle with SDK-client integration tests. Keep installation authority separate from invocation.
2. **Governed execution:** add approved capability manifests, exact package integrity/provenance, isolated workers, short-lived secret brokering, cancellation, idempotency, durable receipts, and rollback. Discovery alone must never authorize execution.
3. **Identity operations:** replace or explicitly constrain local-file registries for multiple instances, implement timely revocation propagation, operational key provisioning, tenant/resource policies, and durable audit storage.
4. **Registry correctness:** verify current official registry endpoints/pagination, normalize contracts with validation, and expose partial outages. Do not infer executable package identity from repository names.
5. **Availability/abuse controls:** add per-principal request budgets, rate limits, controlled worker egress, and external-provider policy. Health configuration checks do not prove external service connectivity.
6. **Supply chain/releases:** triage development advisories, generate SBOMs, scan runtime images, sign release artifacts, record provenance, and protect publishing environments. Require the new quality and Docker checks through reviewed repository rules.
7. **Operations:** validate target deployment, backup/restore, alert thresholds, load behavior, and migration from historical default encryption material. Use immutable image digests for rollback.
8. **Documentation/backlog:** reconcile remaining historical docs and overlapping PRs against the selected implementation. The earlier Docker PR remains separate; this branch starts from current main and carries the combined hardening work.

The repository now has a tested hardening foundation. Full downstream capability execution and production readiness remain explicit engineering work.
