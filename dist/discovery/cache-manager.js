import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const memoryCache = new Map();
const CACHE_DIR = process.env.CACHE_DIR || './cache';
const PERSISTENT_CACHE_FILE = path.join(CACHE_DIR, 'registry-cache.json');
const MAX_MEMORY_ENTRIES = 1000;
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
// Initialize cache
initializeCache();
function initializeCache() {
    try {
        if (!fs.existsSync(CACHE_DIR)) {
            fs.mkdirSync(CACHE_DIR, { recursive: true });
        }
        loadPersistentCache();
    }
    catch (error) {
        console.warn('Failed to initialize cache:', error);
    }
}
function loadPersistentCache() {
    try {
        if (fs.existsSync(PERSISTENT_CACHE_FILE)) {
            const data = fs.readFileSync(PERSISTENT_CACHE_FILE, 'utf8');
            const entries = JSON.parse(data);
            const now = Date.now();
            entries.forEach(entry => {
                if (now - entry.ts <= entry.ttl) {
                    memoryCache.set(entry.key, entry);
                }
            });
            console.log(`Loaded ${memoryCache.size} cached entries`);
        }
    }
    catch (error) {
        console.warn('Failed to load persistent cache:', error);
    }
}
export function getCached(key) {
    const entry = memoryCache.get(key);
    if (!entry) {
        return null;
    }
    const now = Date.now();
    if (now - entry.ts > entry.ttl) {
        memoryCache.delete(key);
        return null;
    }
    return entry.data;
}
export function setCached(key, data, ttl = DEFAULT_TTL) {
    const entry = {
        key,
        data,
        ts: Date.now(),
        ttl
    };
    memoryCache.set(key, entry);
    // Evict oldest entries if cache is too large
    if (memoryCache.size > MAX_MEMORY_ENTRIES) {
        const sortedEntries = Array.from(memoryCache.entries())
            .sort((a, b) => a[1].ts - b[1].ts);
        const toDelete = sortedEntries.slice(0, 100);
        toDelete.forEach(([k]) => memoryCache.delete(k));
    }
    // Persist periodically
    debouncedPersist();
}
export function clearCache(pattern) {
    if (!pattern) {
        const size = memoryCache.size;
        memoryCache.clear();
        persistCache();
        return size;
    }
    const regex = new RegExp(pattern);
    let cleared = 0;
    for (const [key] of memoryCache) {
        if (regex.test(key)) {
            memoryCache.delete(key);
            cleared++;
        }
    }
    if (cleared > 0) {
        debouncedPersist();
    }
    return cleared;
}
export function getCacheStats() {
    const entries = Array.from(memoryCache.values());
    const timestamps = entries.map(e => e.ts);
    return {
        entries: memoryCache.size,
        size: JSON.stringify(Array.from(memoryCache.values())).length,
        oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : 0,
        newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : 0
    };
}
export function hashKey(data) {
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    return crypto.createHash('sha256').update(str).digest('hex').substring(0, 16);
}
let persistTimer = null;
function debouncedPersist() {
    if (persistTimer) {
        clearTimeout(persistTimer);
    }
    persistTimer = setTimeout(() => {
        persistCache();
        persistTimer = null;
    }, 5000); // Persist 5 seconds after last write
}
function persistCache() {
    try {
        const entries = Array.from(memoryCache.values());
        const json = JSON.stringify(entries, null, 2);
        fs.writeFileSync(PERSISTENT_CACHE_FILE, json, 'utf8');
    }
    catch (error) {
        console.warn('Failed to persist cache:', error);
    }
}
// Cleanup expired entries periodically
setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, entry] of memoryCache) {
        if (now - entry.ts > entry.ttl) {
            memoryCache.delete(key);
            cleaned++;
        }
    }
    if (cleaned > 0) {
        console.log(`Cleaned ${cleaned} expired cache entries`);
        debouncedPersist();
    }
}, 60000); // Check every minute
// Persist on process exit
process.on('exit', () => {
    persistCache();
});
//# sourceMappingURL=cache-manager.js.map