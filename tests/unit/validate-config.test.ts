import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, test } from '@jest/globals';

describe('MCP configuration validation', () => {
  test('accepts the checked-in adapter inventory', () => {
    const result = spawnSync(process.execPath, ['scripts/validate-config.js'], { encoding: 'utf8' });
    expect(result.status).toBe(0);
  });

  test('rejects an adapter without a command', () => {
    const fixture = path.resolve('tests/fixtures/invalid-config.json');
    const result = spawnSync(process.execPath, ['scripts/validate-config.js', fixture], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Invalid MCP configuration');
  });
});
