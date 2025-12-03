import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
const memoryStore = new Map();
const CREDENTIALS_FILE = process.env.CREDENTIALS_FILE || './cache/credentials.json';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
// Initialize
initializeStore();
function initializeStore() {
    try {
        const dir = path.dirname(CREDENTIALS_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        loadCredentials();
    }
    catch (error) {
        console.warn('Failed to initialize credential store:', error);
    }
}
function loadCredentials() {
    try {
        if (fs.existsSync(CREDENTIALS_FILE)) {
            const data = fs.readFileSync(CREDENTIALS_FILE, 'utf8');
            const stored = JSON.parse(data);
            for (const [key, value] of Object.entries(stored)) {
                // Only load non-expired credentials
                if (!value.metadata.expiresAt || new Date(value.metadata.expiresAt) > new Date()) {
                    memoryStore.set(key, value);
                }
            }
            console.log(`Loaded ${memoryStore.size} credentials`);
        }
    }
    catch (error) {
        console.warn('Failed to load credentials:', error);
    }
}
function getEncryptionKey() {
    const keySource = process.env.ENCRYPTION_KEY;
    if (!keySource) {
        console.warn('ENCRYPTION_KEY not set, using insecure default');
        return crypto.createHash('sha256').update('dev-key-do-not-use-in-production').digest();
    }
    // Ensure key is exactly 32 bytes for AES-256
    return crypto.createHash('sha256').update(keySource).digest();
}
export function put(userId, service, secret, expiresInSeconds) {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
        cipher.update(secret, 'utf8'),
        cipher.final()
    ]);
    const tag = cipher.getAuthTag();
    const combined = Buffer.concat([iv, tag, encrypted]);
    const encodedValue = combined.toString('base64');
    const now = new Date();
    const expiresAt = expiresInSeconds
        ? new Date(now.getTime() + expiresInSeconds * 1000).toISOString()
        : undefined;
    const credential = {
        encrypted: encodedValue,
        metadata: {
            service,
            userId,
            createdAt: now.toISOString(),
            expiresAt
        }
    };
    const storeKey = `${userId}:${service}`;
    memoryStore.set(storeKey, credential);
    persistCredentials();
}
export function get(userId, service) {
    const storeKey = `${userId}:${service}`;
    const stored = memoryStore.get(storeKey);
    if (!stored) {
        return null;
    }
    // Check expiration
    if (stored.metadata.expiresAt && new Date(stored.metadata.expiresAt) <= new Date()) {
        memoryStore.delete(storeKey);
        persistCredentials();
        return null;
    }
    try {
        const decrypted = decrypt(stored.encrypted);
        // Update last used timestamp
        stored.metadata.lastUsed = new Date().toISOString();
        memoryStore.set(storeKey, stored);
        return decrypted;
    }
    catch (error) {
        console.error('Failed to decrypt credential:', error);
        return null;
    }
}
export function remove(userId, service) {
    const storeKey = `${userId}:${service}`;
    const deleted = memoryStore.delete(storeKey);
    if (deleted) {
        persistCredentials();
    }
    return deleted;
}
export function list(userId) {
    const results = [];
    for (const [key, stored] of memoryStore) {
        if (key.startsWith(`${userId}:`)) {
            results.push(stored.metadata);
        }
    }
    return results;
}
export function rotateKey(oldKey, newKey) {
    let rotated = 0;
    // Save old encryption key
    const oldEnv = process.env.ENCRYPTION_KEY;
    try {
        // Decrypt all with old key
        const decryptedCreds = [];
        process.env.ENCRYPTION_KEY = oldKey;
        for (const [key, stored] of memoryStore) {
            try {
                const [userId, service] = key.split(':');
                const decrypted = decrypt(stored.encrypted);
                decryptedCreds.push([userId, service, stored]);
                decryptedCreds[decryptedCreds.length - 1][2].metadata.lastUsed = decrypted;
            }
            catch (error) {
                console.error(`Failed to decrypt ${key} during rotation`);
            }
        }
        // Re-encrypt with new key
        process.env.ENCRYPTION_KEY = newKey;
        memoryStore.clear();
        for (const [userId, service, stored] of decryptedCreds) {
            const secret = stored.metadata.lastUsed; // Temporarily stored here
            const expiresIn = stored.metadata.expiresAt
                ? Math.floor((new Date(stored.metadata.expiresAt).getTime() - Date.now()) / 1000)
                : undefined;
            put(userId, service, secret, expiresIn);
            rotated++;
        }
        persistCredentials();
    }
    finally {
        // Restore original key
        process.env.ENCRYPTION_KEY = oldEnv;
    }
    return rotated;
}
function decrypt(encryptedValue) {
    const key = getEncryptionKey();
    const buffer = Buffer.from(encryptedValue, 'base64');
    // Extract IV, tag, and encrypted data
    const iv = buffer.subarray(0, IV_LENGTH);
    const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = buffer.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
    ]);
    return decrypted.toString('utf8');
}
function persistCredentials() {
    try {
        const data = {};
        for (const [key, value] of memoryStore) {
            data[key] = value;
        }
        const json = JSON.stringify(data, null, 2);
        fs.writeFileSync(CREDENTIALS_FILE, json, {
            mode: 0o600, // Owner read/write only
            encoding: 'utf8'
        });
    }
    catch (error) {
        console.error('Failed to persist credentials:', error);
    }
}
// Clean up expired credentials periodically
const cleanupInterval = setInterval(() => {
    const now = new Date();
    let cleaned = 0;
    for (const [key, stored] of memoryStore) {
        if (stored.metadata.expiresAt && new Date(stored.metadata.expiresAt) <= now) {
            memoryStore.delete(key);
            cleaned++;
        }
    }
    if (cleaned > 0) {
        console.log(`Cleaned ${cleaned} expired credentials`);
        persistCredentials();
    }
}, 3600000); // Check every hour
// Allow cleanup to be stopped in tests
cleanupInterval.unref();
// Persist on exit
process.on('exit', () => {
    clearInterval(cleanupInterval);
    persistCredentials();
});
//# sourceMappingURL=credential-store.js.map