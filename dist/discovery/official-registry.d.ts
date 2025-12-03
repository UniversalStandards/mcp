import type { RegistryServer, SearchQuery } from './github-registry.js';
export declare function searchOfficialRegistry(query: SearchQuery): Promise<RegistryServer[]>;
export declare function getServerDetails(serverId: string): Promise<RegistryServer | null>;
//# sourceMappingURL=official-registry.d.ts.map