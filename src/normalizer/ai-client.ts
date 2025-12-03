import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export type Provider = 'openai' | 'anthropic' | 'local';

export interface NormalizeResult {
  method: string;
  params: Record<string, unknown>;
  intent?: string;
  confidence?: number;
  suggestedServer?: string;
  toolName?: string;
}

interface RequestBody {
  jsonrpc?: string;
  id?: string | number;
  method?: string;
  params?: Record<string, unknown>;
}

const NORMALIZATION_PROMPT = `You are an AI assistant that normalizes MCP (Model Context Protocol) requests.
Your task is to analyze a request and return a structured JSON response with:
- method: The MCP method (tools/call, tools/list, resources/read, resources/list, prompts/get, prompts/list)
- params: Normalized parameters as an object
- intent: A brief description of what the user wants to do
- confidence: A number between 0 and 1 indicating your confidence
- toolName: The specific tool name if method is tools/call
- suggestedServer: The suggested MCP server to handle this request (github, filesystem, git, brave-search, etc.)

Return ONLY valid JSON, no markdown or explanation.`;

export async function normalizeRequest(
  provider: Provider,
  model: string,
  original: unknown
): Promise<NormalizeResult> {
  const body = original as RequestBody;

  // If already well-formed, pass through with high confidence
  if (body?.jsonrpc === '2.0' && body?.method && body?.params) {
    const toolName = body.method === 'tools/call' ? (body.params as any)?.name : undefined;
    return {
      method: body.method,
      params: body.params,
      intent: 'direct',
      confidence: 0.95,
      toolName,
      suggestedServer: inferServer(toolName || body.method)
    };
  }

  // Use AI to normalize
  try {
    if (provider === 'openai') {
      return await normalizeWithOpenAI(model, original);
    } else if (provider === 'anthropic') {
      return await normalizeWithAnthropic(model, original);
    } else {
      // Local/fallback logic
      return normalizeLocal(original);
    }
  } catch (error) {
    console.error('AI normalization failed:', error);
    return normalizeLocal(original);
  }
}

async function normalizeWithOpenAI(model: string, original: unknown): Promise<NormalizeResult> {
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('No OpenAI API key found, falling back to local normalization');
    return normalizeLocal(original);
  }

  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: model || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: NORMALIZATION_PROMPT },
      { role: 'user', content: `Normalize this request: ${JSON.stringify(original)}` }
    ],
    temperature: 0.1,
    max_tokens: 500,
    response_format: { type: 'json_object' }
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return normalizeLocal(original);
  }

  const result = JSON.parse(content);
  return {
    method: result.method || 'tools/call',
    params: result.params || {},
    intent: result.intent,
    confidence: result.confidence || 0.8,
    toolName: result.toolName,
    suggestedServer: result.suggestedServer || inferServer(result.toolName || result.method)
  };
}

async function normalizeWithAnthropic(model: string, original: unknown): Promise<NormalizeResult> {
  const apiKey = process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('No Anthropic API key found, falling back to local normalization');
    return normalizeLocal(original);
  }

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: model || 'claude-3-5-sonnet-20241022',
    max_tokens: 500,
    temperature: 0.1,
    messages: [
      {
        role: 'user',
        content: `${NORMALIZATION_PROMPT}\n\nNormalize this request: ${JSON.stringify(original)}`
      }
    ]
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    return normalizeLocal(original);
  }

  const result = JSON.parse(content.text);
  return {
    method: result.method || 'tools/call',
    params: result.params || {},
    intent: result.intent,
    confidence: result.confidence || 0.8,
    toolName: result.toolName,
    suggestedServer: result.suggestedServer || inferServer(result.toolName || result.method)
  };
}

function normalizeLocal(original: unknown): NormalizeResult {
  const body = original as RequestBody;
  const method = body?.method || 'tools/call';
  const params = body?.params || {};
  const toolName = method === 'tools/call' ? (params as any)?.name : undefined;

  return {
    method,
    params,
    intent: 'fallback',
    confidence: 0.5,
    toolName,
    suggestedServer: inferServer(toolName || method)
  };
}

function inferServer(identifier: string): string {
  const lower = identifier.toLowerCase();
  
  if (lower.includes('github') || lower.includes('repo') || lower.includes('issue') || lower.includes('pr')) {
    return 'github-primary';
  }
  if (lower.includes('file') || lower.includes('read') || lower.includes('write') || lower.includes('dir')) {
    return 'filesystem';
  }
  if (lower.includes('git') && !lower.includes('github')) {
    return 'git-operations';
  }
  if (lower.includes('search') || lower.includes('brave') || lower.includes('web')) {
    return 'brave-search';
  }
  
  return 'unknown';
}
