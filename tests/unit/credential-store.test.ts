import { afterAll, describe, test, expect, beforeEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const previousKey = process.env.ENCRYPTION_KEY;
const previousFile = process.env.CREDENTIALS_FILE;
const directory = mkdtempSync(join(tmpdir(), 'mcp-credentials-'));
const key = randomBytes(32).toString('hex');
process.env.ENCRYPTION_KEY = key;
process.env.CREDENTIALS_FILE = join(directory, 'credentials.json');
const { put, get, remove, list, rotateKey } = await import('../../src/auth/credential-store.js');

afterAll(() => {
  if (previousKey === undefined) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = previousKey;
  if (previousFile === undefined) delete process.env.CREDENTIALS_FILE;
  else process.env.CREDENTIALS_FILE = previousFile;
  rmSync(directory, { recursive: true, force: true });
});

describe('Credential Store', () => {
  const userId = 'test-user';
  const service = 'test-service';
  const secret = 'super-secret-token';

  describe('Basic Operations', () => {
    test('should store and retrieve credentials', () => {
      put(userId, service, secret);
      const retrieved = get(userId, service);

      expect(retrieved).toBe(secret);
    });

    test('should return null for non-existent credentials', () => {
      const result = get('non-existent-user', 'non-existent-service');
      expect(result).toBeNull();
    });

    test('should remove credentials', () => {
      put(userId, service, secret);
      const removed = remove(userId, service);

      expect(removed).toBe(true);
      expect(get(userId, service)).toBeNull();
    });

    test('should return false when removing non-existent credentials', () => {
      const removed = remove('non-existent', 'non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('Expiration', () => {
    test('should respect expiration time', async () => {
      put(userId, 'expiring-service', secret, 1); // 1 second expiration

      // Should be available immediately
      expect(get(userId, 'expiring-service')).toBe(secret);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Should be expired
      expect(get(userId, 'expiring-service')).toBeNull();
    });

    test('should not expire if no expiration set', async () => {
      put(userId, 'permanent-service', secret);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(get(userId, 'permanent-service')).toBe(secret);
    });
  });

  describe('list', () => {
    beforeEach(() => {
      // Clean up - remove all test-user credentials
      const existing = list(userId);
      existing.forEach(cred => remove(userId, cred.service));
    });

    test('should list all credentials for a user', () => {
      put(userId, 'service1', 'secret1');
      put(userId, 'service2', 'secret2');
      put(userId, 'service3', 'secret3');

      const credentials = list(userId);

      expect(credentials.length).toBeGreaterThanOrEqual(3);
      expect(credentials.map(c => c.service)).toContain('service1');
      expect(credentials.map(c => c.service)).toContain('service2');
      expect(credentials.map(c => c.service)).toContain('service3');
    });

    test('should return empty array for user with no credentials', () => {
      const credentials = list('new-user');
      expect(credentials).toEqual([]);
    });

    test('should include metadata', () => {
      put(userId, 'metadata-test', secret, 3600);
      const credentials = list(userId);

      const cred = credentials.find(c => c.service === 'metadata-test');
      expect(cred).toBeDefined();
      expect(cred?.userId).toBe(userId);
      expect(cred?.service).toBe('metadata-test');
      expect(cred?.createdAt).toBeDefined();
    });
  });

  describe('Security', () => {
    test('failed rotation preserves every existing encrypted credential', () => {
      put(userId, 'rotation-failure', secret);
      const before = readFileSync(join(directory, 'credentials.json'), 'utf8');
      expect(() => rotateKey(randomBytes(32).toString('hex'), randomBytes(32).toString('hex'))).toThrow();
      expect(readFileSync(join(directory, 'credentials.json'), 'utf8')).toBe(before);
      expect(get(userId, 'rotation-failure')).toBe(secret);
      expect(process.env.ENCRYPTION_KEY).toBe(key);
    });

    test('rotation preserves metadata without using it for temporary plaintext', () => {
      put(userId, 'rotation-success', secret, 3600);
      const before = list(userId).find((item) => item.service === 'rotation-success');
      const nextKey = randomBytes(32).toString('hex');
      expect(rotateKey(key, nextKey)).toBeGreaterThan(0);
      expect(process.env.ENCRYPTION_KEY).toBe(key);
      try {
        expect(list(userId).find((item) => item.service === 'rotation-success')).toEqual(before);
        expect(readFileSync(join(directory, 'credentials.json'), 'utf8')).not.toContain(secret);
        process.env.ENCRYPTION_KEY = nextKey;
        expect(get(userId, 'rotation-success')).toBe(secret);
      } finally {
        rotateKey(nextKey, key);
        process.env.ENCRYPTION_KEY = key;
      }
    });

    test('requires an explicit encryption key even in development and tests', () => {
      delete process.env.ENCRYPTION_KEY;
      try {
        expect(() => put(userId, 'no-default', secret)).toThrow('ENCRYPTION_KEY');
      } finally {
        process.env.ENCRYPTION_KEY = key;
      }
      expect(get(userId, 'no-default')).toBeNull();
    });

    test('rejects short encryption keys', () => {
      process.env.ENCRYPTION_KEY = 'short';
      try {
        expect(() => put(userId, 'short-key', secret)).toThrow('ENCRYPTION_KEY');
      } finally {
        process.env.ENCRYPTION_KEY = key;
      }
    });

    test('persists ciphertext with a fresh IV for identical secrets', () => {
      put(userId, 'same-a', secret);
      put(userId, 'same-b', secret);
      const serialized = readFileSync(join(directory, 'credentials.json'), 'utf8');
      const stored = JSON.parse(serialized);
      expect(serialized).not.toContain(secret);
      expect(stored[`${userId}:same-a`].encrypted).not.toBe(stored[`${userId}:same-b`].encrypted);
      expect(get(userId, 'same-a')).toBe(secret);
      expect(get(userId, 'same-b')).toBe(secret);
    });

    test('should encrypt different secrets differently', () => {
      put(userId, 'service1', 'secret1');
      put(userId, 'service2', 'secret2');

      const cred1 = get(userId, 'service1');
      const cred2 = get(userId, 'service2');

      expect(cred1).not.toBe(cred2);
    });

    test('should handle special characters in secrets', () => {
      const specialSecret = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';
      put(userId, 'special-chars', specialSecret);

      expect(get(userId, 'special-chars')).toBe(specialSecret);
    });

    test('should handle unicode in secrets', () => {
      const unicodeSecret = '你好世界 🔐 مرحبا';
      put(userId, 'unicode', unicodeSecret);

      expect(get(userId, 'unicode')).toBe(unicodeSecret);
    });
  });
});
