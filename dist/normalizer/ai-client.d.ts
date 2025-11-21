export type Provider = 'openai' | 'anthropic' | 'local';
export interface NormalizeResult {
    method: string;
    params: Record<string, unknown>;
    intent?: string;
    confidence?: number;
}
export declare function normalizeRequest(_provider: Provider, _model: string, original: unknown): Promise<NormalizeResult>;
//# sourceMappingURL=ai-client.d.ts.map