interface CredentialMetadata {
    service: string;
    userId: string;
    createdAt: string;
    expiresAt?: string;
    lastUsed?: string;
}
export declare function put(userId: string, service: string, secret: string, expiresInSeconds?: number): void;
export declare function get(userId: string, service: string): string | null;
export declare function remove(userId: string, service: string): boolean;
export declare function list(userId: string): CredentialMetadata[];
export declare function rotateKey(oldKey: string, newKey: string): number;
export {};
//# sourceMappingURL=credential-store.d.ts.map