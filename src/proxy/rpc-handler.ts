import type { Request, Response } from 'express';
import { parseIncoming } from '../normalizer/request-parser.js';
import { normalizeRequest } from '../normalizer/ai-client.js';

export async function handleRpc(req: Request, res: Response) {
  const body = parseIncoming(req.body);
  const norm = await normalizeRequest((process.env.AI_PROVIDER as any) || 'openai', process.env.AI_MODEL || 'gpt-4o', body);
  // TODO: route to installed servers or trigger discovery+install
  res.json({ jsonrpc: '2.0', id: body.id ?? 1, result: { normalized: norm, note: 'routing TBD' } });
}
