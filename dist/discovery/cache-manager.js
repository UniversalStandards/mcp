const cache = new Map();
export function getCached(key) { const v = cache.get(key); if (!v)
    return null; if (Date.now() - v.ts > v.ttl) {
    cache.delete(key);
    return null;
} return v.data; }
export function setCached(key, data, ttl = 5 * 60_000) { cache.set(key, { data, ts: Date.now(), ttl }); }
//# sourceMappingURL=cache-manager.js.map