import crypto from 'node:crypto';
const store = new Map();
export function put(userId, service, secret) {
    const key = crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY || 'dev').digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const value = Buffer.concat([iv, tag, enc]).toString('base64');
    store.set(`${userId}:${service}`, value);
}
export function get(userId, service) { return store.get(`${userId}:${service}`); }
//# sourceMappingURL=credential-store.js.map