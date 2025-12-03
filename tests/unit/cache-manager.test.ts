import { describe, test, expect, beforeEach } from '@jest/globals';
import { getCached, setCached, clearCache, getCacheStats, hashKey } from '../../src/discovery/cache-manager';

describe('Cache Manager', () => {
  beforeEach(() => {
    clearCache();
  });

  describe('Basic Operations', () => {
    test('should store and retrieve cached data', () => {
      const key = 'test-key';
      const data = { value: 'test-data' };

      setCached(key, data, 60000); // 1 minute TTL
      const retrieved = getCached(key);

      expect(retrieved).toEqual(data);
    });

    test('should return null for non-existent key', () => {
      const result = getCached('non-existent');
      expect(result).toBeNull();
    });

    test('should respect TTL', async () => {
      const key = 'ttl-test';
      const data = { value: 'expires' };

      setCached(key, data, 50); // 50ms TTL
      
      // Should be available immediately
      expect(getCached(key)).toEqual(data);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should be expired
      expect(getCached(key)).toBeNull();
    });

    test('should overwrite existing key', () => {
      const key = 'overwrite-test';
      
      setCached(key, 'first', 60000);
      setCached(key, 'second', 60000);

      expect(getCached(key)).toBe('second');
    });
  });

  describe('clearCache', () => {
    test('should clear all entries', () => {
      setCached('key1', 'value1', 60000);
      setCached('key2', 'value2', 60000);

      const cleared = clearCache();

      expect(cleared).toBe(2);
      expect(getCached('key1')).toBeNull();
      expect(getCached('key2')).toBeNull();
    });

    test('should clear entries matching pattern', () => {
      setCached('github:repo1', 'data1', 60000);
      setCached('github:repo2', 'data2', 60000);
      setCached('npm:package1', 'data3', 60000);

      const cleared = clearCache('github');

      expect(cleared).toBe(2);
      expect(getCached('github:repo1')).toBeNull();
      expect(getCached('github:repo2')).toBeNull();
      expect(getCached('npm:package1')).toBe('data3');
    });
  });

  describe('getCacheStats', () => {
    test('should return accurate stats', () => {
      setCached('key1', 'value1', 60000);
      setCached('key2', 'value2', 60000);

      const stats = getCacheStats();

      expect(stats.entries).toBe(2);
      expect(stats.size).toBeGreaterThan(0);
      expect(stats.oldestEntry).toBeGreaterThan(0);
      expect(stats.newestEntry).toBeGreaterThan(0);
    });

    test('should handle empty cache', () => {
      const stats = getCacheStats();

      expect(stats.entries).toBe(0);
      expect(stats.oldestEntry).toBe(0);
      expect(stats.newestEntry).toBe(0);
    });
  });

  describe('hashKey', () => {
    test('should generate consistent hash for same input', () => {
      const data = { test: 'data' };
      const hash1 = hashKey(data);
      const hash2 = hashKey(data);

      expect(hash1).toBe(hash2);
    });

    test('should generate different hashes for different inputs', () => {
      const hash1 = hashKey({ test: 'data1' });
      const hash2 = hashKey({ test: 'data2' });

      expect(hash1).not.toBe(hash2);
    });

    test('should handle string input', () => {
      const hash = hashKey('test-string');

      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(16);
    });
  });
});
