import fetch from 'node-fetch';
import { getCached, setCached } from './cache-manager.js';
const CACHE_TTL = 3600 * 1000; // 1 hour
const REGISTRY_URLS = [
    'https://registry.modelcontextprotocol.io/api/servers',
    'https://mcp-registry.anthropic.com/api/servers'
];
export async function searchOfficialRegistry(query) {
    const cacheKey = `official-registry:${JSON.stringify(query)}`;
    const cached = getCached(cacheKey);
    if (cached) {
        return cached;
    }
    const results = [];
    for (const url of REGISTRY_URLS) {
        try {
            const servers = await fetchRegistry(url);
            const filtered = servers.filter(s => matchesQuery(s, query));
            results.push(...filtered);
        }
        catch (error) {
            console.warn(`Failed to fetch from ${url}:`, error);
        }
    }
    // Deduplicate
    const uniqueServers = Array.from(new Map(results.map(s => [s.id, s])).values());
    setCached(cacheKey, uniqueServers, CACHE_TTL);
    return uniqueServers;
}
async function fetchRegistry(url) {
    const response = await fetch(url, {
        headers: {
            'Accept': 'application/json',
            'User-Agent': 'Universal-MCP-Hub/1.0'
        },
        signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) {
        throw new Error(`Registry returned ${response.status}`);
    }
    const data = await response.json();
    // Handle different response formats
    const servers = data.servers || data.items || data;
    if (!Array.isArray(servers)) {
        return [];
    }
    return servers.map((s) => normalizeServerData(s));
}
function normalizeServerData(raw) {
    return {
        id: raw.id || raw.name || raw.package || raw.identifier,
        name: raw.name || raw.displayName || raw.id,
        description: raw.description || raw.summary || '',
        repository: raw.repository || raw.repo || raw.github || raw.source || '',
        npmPackage: raw.package || raw.npmPackage || raw.npm,
        version: raw.version || 'latest',
        capabilities: Array.isArray(raw.capabilities) ? raw.capabilities : [],
        tools: Array.isArray(raw.tools) ? raw.tools :
            Array.isArray(raw.toolNames) ? raw.toolNames : [],
        author: raw.author || raw.maintainer || raw.owner || 'Unknown',
        stars: raw.stars || raw.stargazers || 0,
        lastUpdated: raw.lastUpdated || raw.updatedAt || raw.updated || new Date().toISOString()
    };
}
function matchesQuery(server, query) {
    if (!query.capability && !query.keywords?.length && !query.toolName) {
        return true;
    }
    const searchText = [
        server.name,
        server.description,
        server.id,
        server.npmPackage,
        ...server.capabilities,
        ...(server.tools || [])
    ].join(' ').toLowerCase();
    if (query.capability && searchText.includes(query.capability.toLowerCase())) {
        return true;
    }
    if (query.toolName && searchText.includes(query.toolName.toLowerCase())) {
        return true;
    }
    if (query.keywords) {
        return query.keywords.some(kw => searchText.includes(kw.toLowerCase()));
    }
    return false;
}
export async function getServerDetails(serverId) {
    const cacheKey = `server-details:${serverId}`;
    const cached = getCached(cacheKey);
    if (cached) {
        return cached;
    }
    for (const url of REGISTRY_URLS) {
        try {
            const response = await fetch(`${url}/${encodeURIComponent(serverId)}`, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Universal-MCP-Hub/1.0'
                },
                signal: AbortSignal.timeout(10000)
            });
            if (response.ok) {
                const data = await response.json();
                const server = normalizeServerData(data);
                setCached(cacheKey, server, CACHE_TTL);
                return server;
            }
        }
        catch (error) {
            console.warn(`Failed to get details for ${serverId} from ${url}:`, error);
        }
    }
    return null;
}
//# sourceMappingURL=official-registry.js.map