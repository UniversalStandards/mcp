import type { RegistryServer, SearchQuery } from './github-registry.js';

const REGISTRY_URL = 'https://registry.modelcontextprotocol.io/v0.1/servers';
const REQUEST_TIMEOUT_MS = 10_000;

export interface MarketplaceServer {
  id: string;
  kind: 'mcp_server';
  name: string;
  description: string;
  version: string;
  repository: string | null;
  transportTypes: string[];
  status: string;
  updatedAt: string | null;
  source: 'official-mcp-registry';
  availability: 'discoverable';
}

export interface MarketplacePage {
  source: 'official-mcp-registry';
  entries: MarketplaceServer[];
  nextCursor: string | null;
  count: number;
}

export interface BrowseRegistryOptions {
  search?: string;
  cursor?: string;
  limit?: number;
}

type RegistryFetch = (_url: string, _init: RequestInit) => Promise<Response>;

/** Browse published metadata only. Registry entries are never installed or executed. */
export async function browseOfficialRegistry(
  options: BrowseRegistryOptions = {},
  request: RegistryFetch = globalThis.fetch
): Promise<MarketplacePage> {
  const limit = options.limit ?? 25;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('Registry page limit must be between 1 and 100');
  }
  if (options.search !== undefined && (options.search.length < 1 || options.search.length > 200)) {
    throw new Error('Registry search must be between 1 and 200 characters');
  }
  if (options.cursor !== undefined && (options.cursor.length < 1 || options.cursor.length > 512)) {
    throw new Error('Registry cursor must be between 1 and 512 characters');
  }

  const url = new URL(REGISTRY_URL);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('version', 'latest');
  if (options.search) url.searchParams.set('search', options.search);
  if (options.cursor) url.searchParams.set('cursor', options.cursor);

  let response: Response;
  try {
    response = await request(url.href, {
      headers: { Accept: 'application/json', 'User-Agent': 'Universal-Standards-MCP/1.0' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch {
    throw new Error('Official MCP Registry is unavailable; retry later');
  }
  if (!response.ok) {
    throw new Error(`Official MCP Registry returned HTTP ${response.status}`);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error('Official MCP Registry returned invalid JSON');
  }
  if (!isRecord(data) || !Array.isArray(data.servers)) {
    throw new Error('Official MCP Registry returned an invalid server page');
  }

  const entries = data.servers.map(normalizeEntry);
  const metadata = isRecord(data.metadata) ? data.metadata : {};
  const nextCursor = typeof metadata.nextCursor === 'string' && metadata.nextCursor
    ? metadata.nextCursor
    : null;

  return {
    source: 'official-mcp-registry',
    entries,
    nextCursor,
    count: entries.length
  };
}

/** Compatibility with the existing hub search tool; name search is registry-side. */
export async function searchOfficialRegistry(query: SearchQuery): Promise<RegistryServer[]> {
  const search = query.toolName || query.keywords?.[0] || query.capability;
  if (!search) return [];

  const page = await browseOfficialRegistry({ search, limit: 25 });
  return page.entries.map(toLegacyRegistryServer);
}

/** Keep the existing detail API working against the current versioned registry. */
export async function getServerDetails(
  serverId: string,
  request: RegistryFetch = globalThis.fetch
): Promise<RegistryServer | null> {
  if (!serverId || serverId.length > 255) {
    throw new Error('Registry server ID must be between 1 and 255 characters');
  }
  const url = `https://registry.modelcontextprotocol.io/v0.1/servers/${encodeURIComponent(serverId)}/versions/latest`;
  let response: Response;
  try {
    response = await request(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Universal-Standards-MCP/1.0' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch {
    throw new Error('Official MCP Registry is unavailable; retry later');
  }
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Official MCP Registry returned HTTP ${response.status}`);
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error('Official MCP Registry returned invalid JSON');
  }
  return toLegacyRegistryServer(normalizeEntry(data));
}

function toLegacyRegistryServer(entry: MarketplaceServer): RegistryServer {
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    repository: entry.repository || '',
    version: entry.version,
    capabilities: [],
    author: 'Official MCP Registry',
    lastUpdated: entry.updatedAt || ''
  };
}

function normalizeEntry(raw: unknown): MarketplaceServer {
  if (!isRecord(raw) || !isRecord(raw.server)) {
    throw new Error('Official MCP Registry returned an invalid server entry');
  }
  const server = raw.server;
  if (typeof server.name !== 'string' || !server.name ||
      typeof server.version !== 'string' || !server.version) {
    throw new Error('Official MCP Registry returned a server without name or version');
  }
  const meta = isRecord(raw._meta) && isRecord(raw._meta['io.modelcontextprotocol.registry/official'])
    ? raw._meta['io.modelcontextprotocol.registry/official']
    : {};
  const transports = [
    ...(Array.isArray(server.remotes) ? server.remotes : []),
    ...(Array.isArray(server.packages) ? server.packages : [])
  ];

  return {
    id: server.name,
    kind: 'mcp_server',
    name: typeof server.title === 'string' && server.title ? server.title : server.name,
    description: typeof server.description === 'string' ? server.description : '',
    version: server.version,
    repository: isRecord(server.repository) && typeof server.repository.url === 'string'
      ? server.repository.url
      : null,
    transportTypes: [...new Set(transports
      .filter(isRecord)
      .map((transport) => isRecord(transport.transport)
        ? transport.transport.type
        : transport.type)
      .filter((type): type is string => typeof type === 'string'))],
    status: typeof meta.status === 'string' ? meta.status : 'unknown',
    updatedAt: typeof meta.updatedAt === 'string' ? meta.updatedAt : null,
    source: 'official-mcp-registry',
    availability: 'discoverable'
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
