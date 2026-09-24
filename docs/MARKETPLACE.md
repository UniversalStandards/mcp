# Capability marketplace scope

Universal Standards intends to offer one catalog for MCP servers, agent skills, service connectors, and extensions. These are different capability types. A skill is instructions and supporting assets for an agent host; it is not an MCP tool. A connector may depend on a vendor-managed OAuth session that this server cannot inherit. An MCP server can expose tools, resources, and prompts, but a registry listing alone does not establish that it is safe or runnable here.

## Verified source coverage today

| Source | Implemented behavior | Limitation |
| --- | --- | --- |
| Official MCP Registry | `hub_browse_mcp_registry` reads the versioned `/v0.1/servers` API with cursor pagination and latest-version filtering. | Metadata only; no installation, authentication, tool invocation, or safety approval. |
| GitHub and other discovery feeds | `hub_search_servers` searches existing feeds. | Results may be incomplete and are not a trusted package catalog. |
| Local adapter configuration | `hub_list_servers` redacts and lists configured metadata. | Configured commands are not executed. |
| ChatGPT apps and plugins | No account or directory import. | Product availability and connected accounts are specific to the user's plan, workspace, and permissions. |
| Claude skills, connectors, and plugins | No account or directory import. | Installed and organization-managed items must be discovered through approved sources; their managed credentials are not portable. |

The current tool results must never use `installed`, `connected`, or `callable` for an item discovered only from a public registry. Future catalog records need separate provenance, source version, license, execution method, required credentials, risk, approval state, last verification, and lifecycle status. Importers must avoid copying user credentials or private account data into Git.

## Target compatibility and capability creation

Compatibility means that the hub can *represent* each capability type and, where its provider offers a supported integration path, connect it through an approved adapter. It does not mean copying proprietary ChatGPT or Claude runtimes. A functional adapter requires its own contract, supported protocol/API, consented credentials, permission scope, isolation, timeouts, audit events, and an end-to-end test. Consequential write tools require an enforceable approval gate; MCP annotations alone are not authorization.

When a user requests a missing capability, the intended lifecycle is: discover an existing approved implementation; if absent, specify a typed contract and threat model; generate or compose an adapter in an isolated workspace; run tests and security checks; present the diff, permissions, and provenance for human approval; then register a versioned, removable capability and verify a real invocation. Generated code must not receive production credentials or be installed automatically. This synthesis workflow is **not implemented** in the current server.

The next implementation gates are local installed-item import with secret-safe provenance, real MCP adapter connections and tool calls, enforceable per-tool policy, and a sandboxed synthesis-and-review pipeline. Production claims require tests against each supported source and an actual MCP client, not catalog size alone.
