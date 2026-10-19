import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import crypto from 'node:crypto';
import type { Server } from 'node:http';
import { app } from '../../src/server.js';
import { sign } from '../../src/auth/jwt-handler.js';

describe('HTTP server integration', () => {
  let server: Server;
  let baseUrl: string;
  let invokeToken: string;
  const previousSecret = process.env.JWT_SECRET;

  beforeAll(async () => {
    process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
    invokeToken = sign({ sub: 'integration-user', scopes: ['mcp:invoke'], roles: [] });
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  const rpc = (method: string, params: Record<string, unknown> = {}) => fetch(`${baseUrl}/mcp/v1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${invokeToken}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: 42, method, params })
  });

  test('serves public liveness and denies unauthenticated cache mutation', async () => {
    const live = await fetch(`${baseUrl}/health/live`);
    expect(live.status).toBe(200);
    expect(await live.json()).toEqual({ alive: true });
    const clear = await fetch(`${baseUrl}/admin/cache/clear`, { method: 'POST' });
    expect(clear.status).toBe(401);
  });

  test('handles authenticated ping', async () => {
    const response = await rpc('ping');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ jsonrpc: '2.0', id: 42, result: { status: 'ok' } });
  });

  test('lists callable hub tools', async () => {
    const response = await rpc('tools/list');
    const data = await response.json() as { result: { tools: unknown[] } };
    expect(response.status).toBe(200);
    expect(Array.isArray(data.result.tools)).toBe(true);
  });

  test('rejects unknown methods', async () => {
    const response = await rpc('invalid/method');
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ id: 42, error: { code: -32601 } });
  });

  test('reports unavailable execution as an error with the original request ID', async () => {
    const response = await rpc('tools/call', { name: 'github_search_repos', arguments: { query: 'mcp' } });
    const data = await response.json();
    expect(data).toMatchObject({ id: 42, error: { code: -32603 } });
    expect(data).not.toHaveProperty('result');
  });
});
