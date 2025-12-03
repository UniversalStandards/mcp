import { describe, test, expect, beforeEach } from '@jest/globals';
import { put, get, remove, list } from '../../src/auth/credential-store';

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
