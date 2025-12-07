import { z } from 'zod';

// JSON-RPC 2.0 request schema
const JsonRpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]).optional(),
  method: z.string(),
  params: z.record(z.string(), z.unknown()).optional()
});

// Relaxed input schema for normalization
const RelaxedRequestSchema = z.object({
  jsonrpc: z.string().optional(),
  id: z.union([z.string(), z.number()]).optional(),
  method: z.string().optional(),
  params: z.record(z.string(), z.unknown()).optional()
});

export interface ParsedRequest {
  jsonrpc: string;
  id: string | number;
  method: string;
  params: Record<string, unknown>;
  isValid: boolean;
  errors?: string[];
}

export function parseIncoming(body: unknown): ParsedRequest {
  // Try strict JSON-RPC 2.0 first
  try {
    const validated = JsonRpcRequestSchema.parse(body);
    return {
      jsonrpc: validated.jsonrpc,
      id: validated.id ?? generateId(),
      method: validated.method,
      params: validated.params ?? {},
      isValid: true
    };
  } catch (strictError) {
    // Fall back to relaxed parsing
    try {
      const relaxed = RelaxedRequestSchema.parse(body);
      const errors: string[] = [];
      
      if (!relaxed.jsonrpc) {
        errors.push('Missing jsonrpc field, defaulting to "2.0"');
      }
      if (!relaxed.method) {
        errors.push('Missing method field, defaulting to "tools/call"');
      }
      
      return {
        jsonrpc: relaxed.jsonrpc || '2.0',
        id: relaxed.id ?? generateId(),
        method: relaxed.method || 'tools/call',
        params: relaxed.params ?? {},
        isValid: false,
        errors
      };
    } catch (relaxedError) {
      // Complete fallback for any input
      const fallback = body as any;
      return {
        jsonrpc: '2.0',
        id: generateId(),
        method: fallback?.method || 'tools/call',
        params: typeof fallback === 'object' ? fallback : {},
        isValid: false,
        errors: ['Invalid request format, using fallback parsing']
      };
    }
  }
}

export function validateMethod(method: string): boolean {
  const validMethods = [
    'tools/call',
    'tools/list',
    'resources/read',
    'resources/list',
    'resources/templates/list',
    'prompts/get',
    'prompts/list',
    'completion/complete',
    'logging/setLevel',
    'ping'
  ];
  return validMethods.includes(method);
}

export function createErrorResponse(id: string | number, code: number, message: string): object {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message
    }
  };
}

export function createSuccessResponse(id: string | number, result: unknown): object {
  return {
    jsonrpc: '2.0',
    id,
    result
  };
}

function generateId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}
