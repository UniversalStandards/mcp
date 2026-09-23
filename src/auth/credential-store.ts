import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

interface CredentialMetadata {
  service: string;
  userId: string;
  createdAt: string;
  expiresAt?: string;
  lastUsed?: string;
}

interface StoredCredential {
  encrypted: string;
  metadata: CredentialMetadata;
}

const memoryStore = new Map<string, StoredCredential>();
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
  } catch (error) {
    console.warn('Failed to initialize credential store:', error);
  }
}

function loadCredentials() {
  try {
    if (fs.existsSync(CREDENTIALS_FILE)) {
      const data = fs.readFileSync(CREDENTIALS_FILE, 'utf8');
      const stored = JSON.parse(data) as Record<string, StoredCredential>;
      
      for (const [key, value] of Object.entries(stored)) {
        // Only load non-expired credentials
        if (!value.metadata.expiresAt || new Date(value.metadata.expiresAt) > new Date()) {
          memoryStore.set(key, value);
        }
      }
      
      console.log(`Loaded ${memoryStore.size} credentials`);
    }
  } catch (error) {
    console.warn('Failed to load credentials:', error);
  }
}

function getEncryptionKey(): Buffer {
  const keySource = process.env.ENCRYPTION_KEY;
  if (!keySource || keySource.length < 32) {
    throw new Error('ENCRYPTION_KEY must be configured with at least 32 characters');
  }
  
  // Ensure key is exactly 32 bytes for AES-256
  return crypto.createHash('sha256').update(keySource).digest();
}

export function put(
  userId: string,
  service: string,
  secret: string,
  expiresInSeconds?: number
): void {
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
  
  const credential: StoredCredential = {
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

export function get(userId: string, service: string): string | null {
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
  } catch (error) {
    console.error('Failed to decrypt credential:', error);
    return null;
  }
}

export function remove(userId: string, service: string): boolean {
  const storeKey = `${userId}:${service}`;
  const deleted = memoryStore.delete(storeKey);
  
  if (deleted) {
    persistCredentials();
  }
  
  return deleted;
}

export function list(userId: string): CredentialMetadata[] {
  const results: CredentialMetadata[] = [];
  
  for (const [key, stored] of memoryStore) {
    if (key.startsWith(`${userId}:`)) {
      results.push(stored.metadata);
    }
  }
  
  return results;
}

// Key rotation requires an atomic, recoverable migration of the encrypted file.
// Until that migration exists, refusing the operation is safer than partial rotation.
export function rotateKey(_oldKey: string, _newKey: string): never {
  throw new Error('Credential key rotation is unavailable; preserve the current key and migrate with a reviewed procedure');
}

function decrypt(encryptedValue: string): string {
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
    const data: Record<string, StoredCredential> = {};
    
    for (const [key, value] of memoryStore) {
      data[key] = value;
    }
    
    const json = JSON.stringify(data, null, 2);
    fs.writeFileSync(CREDENTIALS_FILE, json, {
      mode: 0o600, // Owner read/write only
      encoding: 'utf8'
    });
  } catch (error) {
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
