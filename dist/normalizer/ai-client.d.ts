export type Provider = 'openai' | 'anthropic' | 'local';
export interface NormalizeResult {
    method: string;
    params: Record<string, unknown>;
    intent?: string;
    confidence?: number;
    suggestedServer?: string;
    toolName?: string;
}
export declare function normalizeRequest(provider: Provider, model: string, original: unknown): Promise<NormalizeResult>;
//# sourceMappingURL=ai-client.d.ts.map