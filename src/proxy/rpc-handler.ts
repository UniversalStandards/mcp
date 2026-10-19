import type { Request, Response } from 'express';
import { parseIncoming, createErrorResponse, createSuccessResponse, validateMethod } from '../normalizer/request-parser.js';
import { normalizeRequest } from '../normalizer/ai-client.js';
import { recordRequest, recordSearch } from '../monitoring/metrics.js';
import { searchGitHubRegistry } from '../discovery/github-registry.js';
import { searchOfficialRegistry } from '../discovery/official-registry.js';
import { getCached, setCached } from '../discovery/cache-manager.js';
import fs from 'node:fs';
import path from 'node:path';

interface InstalledServer {
  id: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  capabilities?: {
    resources?: boolean;
    tools?: boolean;
    prompts?: boolean;
  };
  metadata?: {
    installedAt: string;
    lastUsed: string;
    version: string;
    source: string;
  };
}

const installedServers = new Map<string, InstalledServer>();
const serverTools = new Map<string, string[]>();

// Load installed servers on startup
initializeServers();

function initializeServers() {
  try {
    const configPath = path.resolve('./config/mcp-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      if (config.mcpServers) {
        for (const [id, server] of Object.entries(config.mcpServers)) {
          installedServers.set(id, server as InstalledServer);
          
          // Extract tool names from metadata
          const metadata = (server as any).metadata;
          if (metadata?.features) {
            serverTools.set(id, metadata.features);
          }
        }
        
        console.log(`Loaded ${installedServers.size} MCP servers`);
      }
    }
  } catch (error) {
    console.error('Failed to load server configuration:', error);
  }
}

export async function handleRpc(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  let method = 'unknown';
  let requestId: string | number = 1;
  
  try {
    // Parse incoming request
    const parsed = parseIncoming(req.body);
    method = parsed.method;
    requestId = parsed.id;
    
    // Validate method
    if (!validateMethod(parsed.method)) {
      res.status(400).json(createErrorResponse(
        parsed.id,
        -32601,
        `Method not found: ${parsed.method}`
      ));
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
      : await normalizeRequest(
          (process.env.AI_PROVIDER as any) || 'local',
          process.env.AI_MODEL || 'gpt-4o-mini',
          req.body
        );
    
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
    
    res.status(400).json(createErrorResponse(parsed.id, -32601, `Method is not implemented: ${parsed.method}`));
    
  } catch (error) {
    console.error('RPC handler error:', { method, message: error instanceof Error ? error.message : 'Unknown error' });
    
    res.status(500).json(createErrorResponse(
      requestId,
      -32603,
      'The requested operation could not be completed'
    ));
  } finally {
    recordRequest(method, Date.now() - startTime, res.statusCode < 400);
  }
}

async function handleToolCall(
  params: Record<string, unknown>,
  suggestedServer?: string
): Promise<any> {
  const toolName = params.name as string;
  
  if (!toolName) {
    throw new Error('Tool name is required');
  }
  if (toolName === 'hub_list_servers') {
    return { content: [{ type: 'text', text: JSON.stringify(Array.from(installedServers.entries()).map(([id, server]) => ({
      id, capabilities: server.capabilities ?? {}, availability: 'configured', callable: false
    }))) }] };
  }
  if (toolName === 'hub_search_servers') {
    const args = params.arguments as Record<string, unknown> | undefined;
    if (!args || typeof args.query !== 'string' || args.query.trim().length === 0 || args.query.length > 256) {
      throw new Error('A search query between 1 and 256 characters is required');
    }
    recordSearch();
    const results = await Promise.all([
      searchGitHubRegistry({ keywords: [args.query] }),
      searchOfficialRegistry({ keywords: [args.query] })
    ]);
    const servers = Array.from(new Map(results.flat().map(server => [server.id, { ...server, availability: 'discoverable', callable: false }])).values());
    return { content: [{ type: 'text', text: JSON.stringify(servers) }] };
  }
  
  // Check cache for tool location
  const cacheKey = `tool-server:${toolName}`;
  let serverId = getCached(cacheKey) as string | null;
  
  // Use suggested server if available
  if (!serverId && suggestedServer) {
    serverId = suggestedServer;
  }
  
  // Find server that provides this tool
  if (!serverId) {
    serverId = findServerForTool(toolName);
  }
  
  // Invocation cannot grant package installation authority. Discovery is a
  // separate catalog operation; deployment tooling owns approved installation.
  if (!serverId || !installedServers.has(serverId)) {
    throw new Error('No configured transport is available for this tool');
  }
  
  // Cache the tool-to-server mapping
  setCached(cacheKey, serverId, 3600 * 1000);
  
  throw new Error(
    `Tool execution is not available for ${toolName}; server ${serverId} is catalogued but no MCP transport bridge is configured`
  );
}

async function handleResourceRead(
  params: Record<string, unknown>,
  suggestedServer?: string
): Promise<any> {
  const uri = params.uri as string;
  
  if (!uri) {
    throw new Error('Resource URI is required');
  }
  
  // Determine server based on URI scheme
  let serverId = suggestedServer;
  
  if (uri.startsWith('file://')) {
    serverId = 'filesystem';
  } else if (uri.startsWith('github://')) {
    serverId = 'github-primary';
  } else if (uri.startsWith('git://')) {
    serverId = 'git-operations';
  }
  
  if (!serverId || !installedServers.has(serverId)) {
    throw new Error(`No server found for resource: ${uri}`);
  }
  
  throw new Error(
    `Resource reading is not available for ${uri}; server ${serverId} is catalogued but no MCP transport bridge is configured`
  );
}

function findServerForTool(toolName: string): string | null {
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


async function listAllTools(): Promise<any[]> {
  const tools: any[] = [];
  
  // Add built-in tools
  tools.push({
    name: 'hub_list_servers',
    description: 'List configured MCP servers and their availability; configuration does not establish execution readiness',
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
        query: { type: 'string', minLength: 1, maxLength: 256, description: 'Search query' }
      },
      required: ['query'],
      additionalProperties: false
    }
  });
  
  return tools;
}

async function listAllResources(): Promise<any[]> {
  const resources: any[] = [];
  
  return resources;
}

function inferServerFromMethod(method: string): string | undefined {
  if (method.includes('github')) return 'github-primary';
  if (method.includes('file')) return 'filesystem';
  if (method.includes('git')) return 'git-operations';
  return undefined;
}
