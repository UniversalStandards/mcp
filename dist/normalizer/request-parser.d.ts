export interface ParsedRequest {
    jsonrpc: string;
    id: string | number;
    method: string;
    params: Record<string, unknown>;
    isValid: boolean;
    errors?: string[];
}
export declare function parseIncoming(body: unknown): ParsedRequest;
export declare function validateMethod(method: string): boolean;
export declare function createErrorResponse(id: string | number, code: number, message: string): object;
export declare function createSuccessResponse(id: string | number, result: unknown): object;
//# sourceMappingURL=request-parser.d.ts.map