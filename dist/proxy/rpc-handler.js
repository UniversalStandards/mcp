import { parseIncoming, createErrorResponse, createSuccessResponse, validateMethod } from '../normalizer/request-parser.js';
import { normalizeRequest } from '../normalizer/ai-client.js';
import { searchGitHubRegistry } from '../discovery/github-registry.js';
import { searchOfficialRegistry } from '../discovery/official-registry.js';
import { npmInstall } from '../installer/npm-installer.js';
import { addServerToConfigs } from '../installer/config-generator.js';
import { getCached, setCached } from '../discovery/cache-manager.js';
import fs from 'node:fs';
import path from 'node:path';
const installedServers = new Map();
const serverTools = new Map();
// Load installed servers on startup
initializeServers();
function initializeServers() {
    try {
        const configPath = path.resolve('./config/mcp-config.json');
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (config.mcpServers) {
                for (const [id, server] of Object.entries(config.mcpServers)) {
                    installedServers.set(id, server);
                    // Extract tool names from metadata
                    const metadata = server.metadata;
                    if (metadata?.features) {
                        serverTools.set(id, metadata.features);
                    }
                }
                console.log(`Loaded ${installedServers.size} MCP servers`);
            }
        }
    }
    catch (error) {
        console.error('Failed to load server configuration:', error);
    }
}
export async function handleRpc(req, res) {
    const startTime = Date.now();
    try {
        // Parse incoming request
        const parsed = parseIncoming(req.body);
        // Validate method
        if (!validateMethod(parsed.method)) {
            res.status(400).json(createErrorResponse(parsed.id, -32601, `Method not found: ${parsed.method}`));
            return;
        }
        // Handle built-in methods
        if (parsed.method === 'ping') {
            res.json(createSuccessResponse(parsed.id, { status: 'ok', timestamp: Date.now() }));
            return;
        }
        if (parsed.method === 'tools/list') {
            const tools = await listAllTools();
            res.json(createSuccessResponse(parsed.id, { tools }));
            return;
        }
        if (parsed.method === 'resources/list') {
            const resources = await listAllResources();
            res.json(createSuccessResponse(parsed.id, { resources }));
            return;
        }
        // Normalize request with AI if needed
        const normalized = parsed.isValid
            ? {
                method: parsed.method,
                params: parsed.params,
                suggestedServer: inferServerFromMethod(parsed.method),
                confidence: 0.95
            }
            : await normalizeRequest(process.env.AI_PROVIDER || 'openai', process.env.AI_MODEL || 'gpt-4o-mini', req.body);
        // Route to appropriate server
        if (normalized.method === 'tools/call') {
            const result = await handleToolCall(normalized.params, normalized.suggestedServer);
            res.json(createSuccessResponse(parsed.id, result));
            return;
        }
        if (normalized.method === 'resources/read') {
            const result = await handleResourceRead(normalized.params, normalized.suggestedServer);
            res.json(createSuccessResponse(parsed.id, result));
            return;
        }
        // Log performance
        const duration = Date.now() - startTime;
        console.log(`Request processed in ${duration}ms`);
        res.json(createSuccessResponse(parsed.id, {
            normalized,
            processingTime: duration,
            note: 'Request normalized and routed'
        }));
    }
    catch (error) {
        console.error('RPC handler error:', error);
        res.status(500).json(createErrorResponse(1, -32603, `Internal error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
}
async function handleToolCall(params, suggestedServer) {
    const toolName = params.name;
    if (!toolName) {
        throw new Error('Tool name is required');
    }
    // Check cache for tool location
    const cacheKey = `tool-server:${toolName}`;
    let serverId = getCached(cacheKey);
    // Use suggested server if available
    if (!serverId && suggestedServer) {
        serverId = suggestedServer;
    }
    // Find server that provides this tool
    if (!serverId) {
        serverId = findServerForTool(toolName);
    }
    // If not found, try to discover and install
    if (!serverId || !installedServers.has(serverId)) {
        console.log(`Tool ${toolName} not found, attempting discovery...`);
        serverId = await discoverAndInstall(toolName);
    }
    if (!serverId) {
        throw new Error(`No server found for tool: ${toolName}`);
    }
    // Cache the tool-to-server mapping
    setCached(cacheKey, serverId, 3600 * 1000);
    // For now, return a mock response indicating the server that would handle it
    // In a full implementation, this would spawn the server process and forward the request
    return {
        tool: toolName,
        server: serverId,
        status: 'would_execute',
        params: params.arguments || {},
        note: 'Full server execution to be implemented'
    };
}
async function handleResourceRead(params, suggestedServer) {
    const uri = params.uri;
    if (!uri) {
        throw new Error('Resource URI is required');
    }
    // Determine server based on URI scheme
    let serverId = suggestedServer;
    if (uri.startsWith('file://')) {
        serverId = 'filesystem';
    }
    else if (uri.startsWith('github://')) {
        serverId = 'github-primary';
    }
    else if (uri.startsWith('git://')) {
        serverId = 'git-operations';
    }
    if (!serverId || !installedServers.has(serverId)) {
        throw new Error(`No server found for resource: ${uri}`);
    }
    return {
        uri,
        server: serverId,
        status: 'would_read',
        note: 'Full resource reading to be implemented'
    };
}
function findServerForTool(toolName) {
    const toolLower = toolName.toLowerCase();
    // Check if any server explicitly lists this tool
    for (const [serverId, tools] of serverTools) {
        if (tools.some(t => t.toLowerCase().includes(toolLower) || toolLower.includes(t.toLowerCase()))) {
            return serverId;
        }
    }
    // Infer based on tool name patterns
    if (toolLower.includes('github') || toolLower.includes('repo') || toolLower.includes('issue')) {
        return 'github-primary';
    }
    if (toolLower.includes('file') || toolLower.includes('read') || toolLower.includes('write')) {
        return 'filesystem';
    }
    if (toolLower.includes('git') && !toolLower.includes('github')) {
        return 'git-operations';
    }
    return null;
}
async function discoverAndInstall(toolName) {
    try {
        console.log(`Searching registries for tool: ${toolName}`);
        // Search both registries in parallel
        const [githubResults, officialResults] = await Promise.all([
            searchGitHubRegistry({ toolName, keywords: [toolName] }),
            searchOfficialRegistry({ toolName, keywords: [toolName] })
        ]);
        const allResults = [...githubResults, ...officialResults];
        if (allResults.length === 0) {
            console.log(`No servers found for tool: ${toolName}`);
            return null;
        }
        // Pick the best match (first result, assumed to be most relevant)
        const bestMatch = allResults[0];
        console.log(`Found server: ${bestMatch.name} (${bestMatch.id})`);
        // Check if already installed
        if (installedServers.has(bestMatch.id)) {
            return bestMatch.id;
        }
        // Install the server
        const packageName = bestMatch.npmPackage || bestMatch.id;
        console.log(`Installing ${packageName}...`);
        await npmInstall(packageName);
        addServerToConfigs(bestMatch.id, bestMatch.repository);
        // Reload servers
        initializeServers();
        console.log(`Successfully installed ${bestMatch.id}`);
        return bestMatch.id;
    }
    catch (error) {
        console.error('Discovery and installation failed:', error);
        return null;
    }
}
async function listAllTools() {
    const tools = [];
    // Add built-in tools
    tools.push({
        name: 'hub_list_servers',
        description: 'List all installed MCP servers',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    });
    tools.push({
        name: 'hub_search_servers',
        description: 'Search for MCP servers in registries',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search query' },
                capability: { type: 'string', description: 'Specific capability to search for' }
            }
        }
    });
    // In a full implementation, would query each server for its tools
    for (const [serverId, server] of installedServers) {
        if (server.capabilities?.tools) {
            const toolsForServer = serverTools.get(serverId) || [];
            toolsForServer.forEach((tool) => {
                tools.push({
                    name: tool,
                    description: `${tool} from ${serverId}`,
                    server: serverId
                });
            });
        }
    }
    return tools;
}
async function listAllResources() {
    const resources = [];
    // In a full implementation, would query each server for its resources
    for (const [serverId, server] of installedServers) {
        if (server.capabilities?.resources) {
            resources.push({
                uri: `${serverId}://`,
                name: `${serverId} resources`,
                description: `Resources provided by ${serverId}`
            });
        }
    }
    return resources;
}
function inferServerFromMethod(method) {
    if (method.includes('github'))
        return 'github-primary';
    if (method.includes('file'))
        return 'filesystem';
    if (method.includes('git'))
        return 'git-operations';
    return undefined;
}
//# sourceMappingURL=rpc-handler.js.map