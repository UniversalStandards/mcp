import fs from 'node:fs';
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getHealthStatus } from '../monitoring/health.js';
import { searchGitHubRegistry, type RegistryServer } from '../discovery/github-registry.js';
import { browseOfficialRegistry, searchOfficialRegistry } from '../discovery/official-registry.js';

interface ConfiguredServer {
  id: string;
  command: string;
  argumentCount: number;
  capabilities: Record<string, boolean>;
}

/**
 * Create a fresh MCP server for one Streamable HTTP session.
 *
 * A fresh instance keeps SDK request state isolated between clients while the
 * underlying configuration and cache remain shared by the local process.
 */
export function createUniversalMcpServer(): McpServer {
  const server = new McpServer({
    name: 'universal-standards-mcp',
    version: process.env.MCP_SERVER_VERSION || '1.0.0'
  });

  server.registerTool(
    'hub_list_servers',
    {
      title: 'List configured MCP servers',
      description: 'List locally configured MCP server adapters without exposing secret values.',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async () => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify({ servers: loadConfiguredServers() }, null, 2)
        }
      ]
    })
  );

  server.registerTool(
    'hub_search_servers',
    {
      title: 'Search MCP registries',
      description: 'Search the configured public MCP registries for a capability or server.',
      inputSchema: {
        query: z.string().trim().min(1).max(200).describe('Capability, server name, or keyword to search for'),
        capability: z.string().trim().min(1).max(100).optional().describe('Optional capability filter'),
        limit: z.number().int().min(1).max(25).default(10).describe('Maximum number of results to return')
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ query, capability, limit }) => {
      const searchQuery = {
        toolName: query,
        capability,
        keywords: [query]
      };

      const [githubSearch, officialSearch] = await Promise.allSettled([
        searchGitHubRegistry(searchQuery),
        searchOfficialRegistry(searchQuery)
      ]);

      const githubResults = githubSearch.status === 'fulfilled' ? githubSearch.value : [];
      const officialResults = officialSearch.status === 'fulfilled' ? officialSearch.value : [];
      const warnings = officialSearch.status === 'rejected'
        ? ['Official MCP Registry search is unavailable; results may be incomplete']
        : [];

      const results = deduplicateResults([...githubResults, ...officialResults]).slice(0, limit);

      const output = {
        query,
        capability: capability || null,
        count: results.length,
        results,
        warnings
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(output, null, 2)
          }
        ],
        structuredContent: output
      };
    }
  );

  server.registerTool(
    'hub_browse_mcp_registry',
    {
      title: 'Browse the official MCP Registry',
      description: 'Page through published MCP server metadata. Search matches server names only. Entries are discoverable, not installed, connected, or approved to execute.',
      inputSchema: {
        search: z.string().trim().min(1).max(200).optional().describe('Optional server-name substring'),
        cursor: z.string().min(1).max(512).optional().describe('Opaque nextCursor from the previous page'),
        limit: z.number().int().min(1).max(100).default(25).describe('Maximum entries on this page')
      },
      outputSchema: {
        source: z.literal('official-mcp-registry'),
        entries: z.array(z.object({
          id: z.string(),
          kind: z.literal('mcp_server'),
          name: z.string(),
          description: z.string(),
          version: z.string(),
          repository: z.string().nullable(),
          transportTypes: z.array(z.string()),
          status: z.string(),
          updatedAt: z.string().nullable(),
          source: z.literal('official-mcp-registry'),
          availability: z.literal('discoverable')
        })),
        nextCursor: z.string().nullable(),
        count: z.number().int()
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ search, cursor, limit }) => {
      try {
        const output = await browseOfficialRegistry({ search, cursor, limit });
        return {
          content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
          structuredContent: { ...output }
        };
      } catch (error) {
        return {
          isError: true,
          content: [{
            type: 'text',
            text: error instanceof Error ? error.message : 'Unable to browse the official MCP Registry'
          }]
        };
      }
    }
  );

  server.registerTool(
    'hub_health',
    {
      title: 'Read hub health',
      description: 'Return the local hub health checks and current process status.',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async () => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify(await getHealthStatus(), null, 2)
        }
      ]
    })
  );

  server.registerResource(
    'hub-info',
    'universal://info',
    {
      description: 'Basic metadata about the local Universal Standards MCP server.',
      mimeType: 'application/json'
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(
            {
              name: 'universal-standards-mcp',
              version: process.env.MCP_SERVER_VERSION || '1.0.0',
              transport: 'streamable-http',
              configuredServerCount: loadConfiguredServers().length
            },
            null,
            2
          )
        }
      ]
    })
  );

  return server;
}

function loadConfiguredServers(): ConfiguredServer[] {
  const configFile = getConfigFile();

  try {
    const parsed = JSON.parse(fs.readFileSync(configFile, 'utf8')) as unknown;
    if (!isRecord(parsed) || !isRecord(parsed.mcpServers)) {
      return [];
    }

    return Object.entries(parsed.mcpServers).map(([id, raw]) => {
      const server = isRecord(raw) ? raw : {};
      const capabilities = isRecord(server.capabilities)
        ? Object.fromEntries(
            Object.entries(server.capabilities).map(([key, value]) => [key, value === true])
          )
        : {};

      const metadata = isRecord(server.metadata) ? server.metadata : undefined;

      return {
        id,
        command: typeof server.command === 'string' ? server.command : 'unknown',
        argumentCount: toStringArray(server.args).length,
        capabilities: {
          ...capabilities,
          ...(metadata && Array.isArray(metadata.features) ? { advertisedFeatures: true } : {})
        }
      };
    });
  } catch (error) {
    console.warn(`Unable to load MCP configuration from ${configFile}:`, error);
    return [];
  }
}

function getConfigFile(): string {
  return path.resolve(process.env.MCP_CONFIG_FILE || 'config/mcp-config.json');
}

function deduplicateResults(results: RegistryServer[]): RegistryServer[] {
  return Array.from(new Map(results.map((result) => [result.id, result])).values());
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
