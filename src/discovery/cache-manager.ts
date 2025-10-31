const cache = new Map<string, { data: any; ts: number; ttl: number }>();
export function getCached(key: string) { const v = cache.get(key); if (!v) return null; if (Date.now() - v.ts > v.ttl) { cache.delete(key); return null; } return v.data; }
export function setCached(key: string, data: any, ttl = 5 * 60_000) { cache.set(key, { data, ts: Date.now(), ttl }); }
