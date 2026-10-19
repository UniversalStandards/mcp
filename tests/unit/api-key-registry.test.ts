import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ApiKeyRegistry } from '../../src/auth/api-key-registry.js';

describe('API key registry', () => {
  let directory: string;
  let filePath: string;
  let registry: ApiKeyRegistry;
  const pepper = randomBytes(32).toString('hex');
  const principal = { principalId: 'worker-1', principalType: 'agent' as const,
    tenantId: 'tenant-1', scopes: ['mcp:invoke'], attributes: { nested: { trusted: true } } };

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'mcp-api-keys-'));
    filePath = join(directory, 'keys.json');
    registry = new ApiKeyRegistry({ filePath, pepper });
  });
  afterEach(() => { rmSync(directory, { recursive: true, force: true }); });

  test('stores only a digest and preserves the principal across reloads', () => {
    const { key } = registry.create(principal);
    expect(readFileSync(filePath, 'utf8')).not.toContain(key.token);
    const reloaded = new ApiKeyRegistry({ filePath, pepper });
    expect(reloaded.authenticate(key.token)).toMatchObject({ ...principal, authMethod: 'api_key', credentialId: key.keyId });
    expect(reloaded.get(key.keyId)).not.toHaveProperty('digest');
  });

  test('rejects forged, revoked, and wrong-pepper keys', () => {
    const { key } = registry.create(principal);
    const replacement = key.token.endsWith('A') ? 'B' : 'A';
    expect(registry.authenticate(key.token.slice(0, -1) + replacement)).toBeNull();
    expect(new ApiKeyRegistry({ filePath, pepper: randomBytes(32).toString('hex') }).authenticate(key.token)).toBeNull();
    expect(registry.revoke(key.keyId)).toBe(true);
    expect(new ApiKeyRegistry({ filePath, pepper }).authenticate(key.token)).toBeNull();
  });

  test.each(['invalid', '', '2020-01-01T00:00:00.000Z'])('denies persisted expiry %j', (expiresAt) => {
    const { key } = registry.create(principal);
    const stored = JSON.parse(readFileSync(filePath, 'utf8'));
    stored[key.keyId].expiresAt = expiresAt;
    writeFileSync(filePath, JSON.stringify(stored));
    expect(new ApiKeyRegistry({ filePath, pepper }).authenticate(key.token)).toBeNull();
  });

  test('denies malformed principal and creation timestamps from the registry', () => {
    const { key } = registry.create(principal);
    const stored = JSON.parse(readFileSync(filePath, 'utf8'));
    stored[key.keyId].createdAt = 'invalid';
    writeFileSync(filePath, JSON.stringify(stored));
    expect(new ApiKeyRegistry({ filePath, pepper }).authenticate(key.token)).toBeNull();
    stored[key.keyId].createdAt = new Date().toISOString();
    stored[key.keyId].principal.principalType = 'anonymous';
    writeFileSync(filePath, JSON.stringify(stored));
    expect(new ApiKeyRegistry({ filePath, pepper }).authenticate(key.token)).toBeNull();
  });

  test('returned metadata cannot mutate authorization records', () => {
    const { key, record } = registry.create(principal);
    record.principal.scopes!.push('admin:cache');
    registry.get(key.keyId)!.principal.attributes!.nested = { trusted: false };
    expect(registry.authenticate(key.token)?.scopes).toEqual(['mcp:invoke']);
    expect(registry.authenticate(key.token)?.attributes).toEqual(principal.attributes);
  });

  test('never uses a default pepper and rejects malformed principal input', () => {
    expect(() => new ApiKeyRegistry({ filePath, pepper: 'short' }).create(principal)).toThrow('API_KEY_PEPPER');
    expect(() => registry.create({ ...principal, principalId: '' })).toThrow();
    expect(() => registry.create({ ...principal, expiresInSeconds: -1 })).toThrow();
  });
});
