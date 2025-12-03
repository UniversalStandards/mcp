import { Octokit } from '@octokit/rest';
import fetch from 'node-fetch';
import { getCached, setCached } from './cache-manager.js';
const CACHE_TTL = 3600 * 1000; // 1 hour
export async function searchGitHubRegistry(query) {
    const cacheKey = `github-registry:${JSON.stringify(query)}`;
    const cached = getCached(cacheKey);
    if (cached) {
        return cached;
    }
    const results = [];
    // Search multiple sources
    try {
        // 1. Search mcp.run registry API
        const mcpRunServers = await searchMcpRun(query);
        results.push(...mcpRunServers);
        // 2. Search GitHub repositories
        const githubServers = await searchGitHubRepos(query);
        results.push(...githubServers);
        // 3. Search known MCP organizations
        const orgServers = await searchKnownOrgs(query);
        results.push(...orgServers);
    }
    catch (error) {
        console.error('GitHub registry search error:', error);
    }
    // Deduplicate by id
    const uniqueServers = Array.from(new Map(results.map(s => [s.id, s])).values());
    // Sort by relevance (stars, recency)
    uniqueServers.sort((a, b) => {
        const scoreA = (a.stars || 0) * 10 + (new Date(a.lastUpdated).getTime() / 1000000000);
        const scoreB = (b.stars || 0) * 10 + (new Date(b.lastUpdated).getTime() / 1000000000);
        return scoreB - scoreA;
    });
    setCached(cacheKey, uniqueServers, CACHE_TTL);
    return uniqueServers;
}
async function searchMcpRun(query) {
    try {
        const url = 'https://mcp.run/api/v1/servers';
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(5000)
        });
        if (!response.ok) {
            return [];
        }
        const data = await response.json();
        const servers = data.servers || data;
        if (!Array.isArray(servers)) {
            return [];
        }
        return servers
            .filter((s) => matchesQuery(s, query))
            .map((s) => ({
            id: s.id || s.name || s.package,
            name: s.name || s.id,
            description: s.description || '',
            repository: s.repository || s.repo || '',
            npmPackage: s.package || s.npmPackage,
            version: s.version || 'latest',
            capabilities: s.capabilities || [],
            tools: s.tools || [],
            author: s.author || 'Unknown',
            stars: s.stars,
            lastUpdated: s.lastUpdated || s.updatedAt || new Date().toISOString()
        }));
    }
    catch (error) {
        console.warn('mcp.run search failed:', error);
        return [];
    }
}
async function searchGitHubRepos(query) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
        return [];
    }
    try {
        const octokit = new Octokit({ auth: token });
        const searchTerms = [
            'mcp-server',
            query.capability,
            ...(query.keywords || [])
        ].filter(Boolean).join(' ');
        const { data } = await octokit.search.repos({
            q: `${searchTerms} language:typescript OR language:javascript`,
            sort: 'stars',
            order: 'desc',
            per_page: 20
        });
        return data.items.map(repo => ({
            id: repo.full_name,
            name: repo.name,
            description: repo.description || '',
            repository: repo.html_url,
            npmPackage: extractNpmPackage(repo.name),
            version: 'latest',
            capabilities: extractCapabilities(repo.description || '', repo.name),
            author: repo.owner?.login || 'Unknown',
            stars: repo.stargazers_count,
            lastUpdated: repo.updated_at
        }));
    }
    catch (error) {
        console.warn('GitHub search failed:', error);
        return [];
    }
}
async function searchKnownOrgs(query) {
    const knownOrgs = [
        'modelcontextprotocol',
        'anthropics',
        'mcp-community'
    ];
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
        return [];
    }
    const results = [];
    try {
        const octokit = new Octokit({ auth: token });
        for (const org of knownOrgs) {
            try {
                const { data } = await octokit.repos.listForOrg({
                    org,
                    type: 'public',
                    per_page: 50
                });
                const orgServers = data
                    .filter(repo => repo.name.includes('server') || repo.name.includes('mcp'))
                    .filter(repo => matchesQuery(repo, query))
                    .map(repo => ({
                    id: repo.full_name,
                    name: repo.name,
                    description: repo.description || '',
                    repository: repo.html_url,
                    npmPackage: extractNpmPackage(repo.name),
                    version: 'latest',
                    capabilities: extractCapabilities(repo.description || '', repo.name),
                    author: org,
                    stars: repo.stargazers_count || 0,
                    lastUpdated: repo.updated_at || new Date().toISOString()
                }));
                results.push(...orgServers);
            }
            catch (error) {
                console.warn(`Failed to fetch repos for ${org}:`, error);
            }
        }
    }
    catch (error) {
        console.warn('Known orgs search failed:', error);
    }
    return results;
}
function matchesQuery(item, query) {
    if (!query.capability && !query.keywords?.length && !query.toolName) {
        return true;
    }
    const searchText = [
        item.name,
        item.description,
        item.id,
        ...(item.capabilities || []),
        ...(item.tools || [])
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
function extractNpmPackage(repoName) {
    if (repoName.startsWith('server-')) {
        return `@modelcontextprotocol/${repoName}`;
    }
    return repoName;
}
function extractCapabilities(description, name) {
    const capabilities = [];
    const text = `${description} ${name}`.toLowerCase();
    const capabilityMap = {
        'github': ['github', 'repository', 'repo', 'issue', 'pr', 'pull request'],
        'filesystem': ['file', 'filesystem', 'disk', 'directory'],
        'git': ['git', 'version control'],
        'database': ['database', 'sql', 'postgres', 'mysql', 'sqlite'],
        'api': ['api', 'rest', 'http', 'fetch'],
        'search': ['search', 'brave', 'google'],
        'ai': ['ai', 'openai', 'anthropic', 'llm']
    };
    for (const [cap, keywords] of Object.entries(capabilityMap)) {
        if (keywords.some(kw => text.includes(kw))) {
            capabilities.push(cap);
        }
    }
    return capabilities;
}
//# sourceMappingURL=github-registry.js.map