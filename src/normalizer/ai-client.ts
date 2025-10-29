export type Provider = 'openai' | 'anthropic' | 'local';
export interface NormalizeResult { method: string; params: Record<string, unknown>; intent?: string; confidence?: number; }
export async function normalizeRequest(_provider: Provider, _model: string, original: unknown): Promise<NormalizeResult> {
  // TODO: implement with selected provider; stub returns passthrough
  return { method: 'tools/call', params: (original as any)?.params ?? {}, intent: 'passthrough', confidence: 0.5 };
}
