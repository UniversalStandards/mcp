export declare function getCached(key: string): any;
export declare function setCached(key: string, data: any, ttl?: number): void;
export declare function clearCache(pattern?: string): number;
export declare function getCacheStats(): {
    entries: number;
    size: number;
    oldestEntry: number;
    newestEntry: number;
};
export declare function hashKey(data: any): string;
//# sourceMappingURL=cache-manager.d.ts.map