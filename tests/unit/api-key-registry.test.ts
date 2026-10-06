import { afterEach, describe, expect, test } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ApiKeyRegistry } from '../../src/auth/api-key-registry.js';

describe('API-key registry', () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  test('persists only a digest and reconstructs a principal on authentication', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-api-key-'));
    temporaryDirectories.push(directory);
    const registry = new ApiKeyRegistry({
      filePath: path.join(directory, 'api-keys.json'),
      pepper: 'a'.repeat(40),
    });

    const created = registry.create({
      environment: 'test',
      principalId: 'agent-1',
      principalType: 'agent',
      scopes: ['mcp:invoke'],
      expiresInSeconds: 3600,
    });

    const fileContents = fs.readFileSync(path.join(directory, 'api-keys.json'), 'utf8');
    expect(fileContents).not.toContain(created.key.token);
    expect(fileContents).not.toContain('a'.repeat(40));

    expect(registry.authenticate(created.key.token)).toMatchObject({
      principalId: 'agent-1',
      principalType: 'agent',
      authMethod: 'api_key',
      credentialId: created.key.keyId,
      scopes: ['mcp:invoke'],
    });
    expect(registry.authenticate(`${created.key.token}x`)).toBeNull();
  });

  test('revokes a key and rejects insecure pepper configuration', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-api-key-'));
    temporaryDirectories.push(directory);
    const registry = new ApiKeyRegistry({ filePath: path.join(directory, 'api-keys.json'), pepper: 'b'.repeat(40) });
    const created = registry.create({ principalId: 'service-1', principalType: 'service_account' });

    expect(registry.revoke(created.key.keyId)).toBe(true);
    expect(registry.authenticate(created.key.token)).toBeNull();
    expect(registry.revoke(created.key.keyId)).toBe(false);
    expect(() => new ApiKeyRegistry({ filePath: path.join(directory, 'invalid.json'), pepper: 'short' }).create({ principalId: 'x', principalType: 'agent' })).toThrow('API_KEY_PEPPER');
  });
});
