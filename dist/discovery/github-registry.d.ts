export interface RegistryServer {
    id: string;
    name: string;
    description: string;
    repository: string;
    npmPackage?: string;
    version: string;
    capabilities: string[];
    tools?: string[];
    author: string;
    stars?: number;
    lastUpdated: string;
}
export interface SearchQuery {
    capability?: string;
    keywords?: string[];
    toolName?: string;
}
export declare function searchGitHubRegistry(query: SearchQuery): Promise<RegistryServer[]>;
//# sourceMappingURL=github-registry.d.ts.map