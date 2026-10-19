import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from '@jest/globals';
import http, { type Server } from 'node:http';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import express from 'express';
import jwt from 'jsonwebtoken';
import { createApp, shutdownServer, startServer } from '../../src/server.js';
import { sign, verify } from '../../src/auth/jwt-handler.js';
import { getDefaultApiKeyRegistry } from '../../src/auth/api-key-registry.js';
import { createRequestSafetyMiddleware } from '../../src/auth/http-authentication.js';

const names = ['JWT_SECRET', 'JWT_ISSUER', 'JWT_AUDIENCE', 'API_KEY_PEPPER', 'API_KEYS_FILE',
  'MCP_ALLOWED_HOSTS', 'MCP_ALLOWED_ORIGINS', 'MCP_REQUIRED_SCOPES', 'BODY_LIMIT', 'HOST', 'PORT'] as const;
const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));
const secret = randomBytes(32).toString('hex');
const directory = mkdtempSync(join(tmpdir(), 'mcp-http-auth-'));
let server: Server;
let baseUrl: string;

function token(scopes: string[] = ['mcp:invoke'], roles: string[] = []): string {
  return sign({ sub: 'agent-1', principal_type: 'agent', tenant_id: 'tenant-a', scopes, roles });
}

async function open(application = createApp()): Promise<void> {
  server = http.createServer(application);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected TCP address');
  baseUrl = `http://127.0.0.1:${address.port}`;
}

function request(path: string, bearer?: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...(bearer ? { authorization: `Bearer ${bearer}` } : {}), ...init.headers },
  });
}

// Node's fetch rewrites Host; use the HTTP client to test the actual wire boundary.
function authorityRequest(headers: Record<string, string>): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const request = http.request(`${baseUrl}/health/live`, { headers }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk: string) => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode!, body: JSON.parse(body) }));
      response.on('error', reject);
    });
    request.on('error', reject);
    request.end();
  });
}

beforeAll(() => {
  process.env.API_KEY_PEPPER = randomBytes(32).toString('hex');
  process.env.API_KEYS_FILE = join(directory, 'keys.json');
});
beforeEach(() => {
  for (const name of names) {
    if (name !== 'API_KEY_PEPPER' && name !== 'API_KEYS_FILE') delete process.env[name];
  }
  process.env.JWT_SECRET = secret;
});
afterEach(async () => {
  if (server?.listening) await shutdownServer(server, 100);
});
afterAll(() => {
  for (const name of names) {
    if (original[name] === undefined) delete process.env[name];
    else process.env[name] = original[name];
  }
  rmSync(directory, { recursive: true, force: true });
});

describe('HTTP security boundary', () => {
  test('public liveness works without signing secrets', async () => {
    delete process.env.JWT_SECRET;
    await open();
    const response = await request('/health/live');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ alive: true });
    expect(response.headers.get('x-powered-by')).toBeNull();
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  test.each([
    ['POST', '/mcp/v1'], ['POST', '/'], ['GET', '/mcp/v1'],
    ['GET', '/admin/cache/stats'], ['POST', '/admin/cache/clear'],
    ['GET', '/metrics'], ['GET', '/metrics/summary'], ['POST', '/metrics/future'],
    ['GET', '/health'],
  ])('%s %s requires credentials before handling a body', async (method, path) => {
    await open();
    const response = await request(path, undefined, {
      method, ...(method === 'POST' ? { body: '{malformed', headers: { 'content-type': 'application/json' } } : {}),
    });
    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain('Bearer');
  });

  test('MCP requires scopes and permits a scoped deterministic ping', async () => {
    await open();
    const init = { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }) };
    expect((await request('/mcp/v1', token([]), init)).status).toBe(403);
    const response = await request('/mcp/v1', token(), init);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: 1, result: { status: 'ok' } });
    expect((await request('/', token(), init)).status).toBe(200);
  });

  test('public readiness exposes only a boolean even when dependencies are unavailable', async () => {
    delete process.env.JWT_SECRET;
    delete process.env.API_KEY_PEPPER;
    try {
      await open();
      const response = await request('/health/ready');
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ ready: false });
    } finally {
      process.env.API_KEY_PEPPER = randomBytes(32).toString('hex');
    }
  });

  test('MCP_REQUIRED_SCOPES overrides the default without allowing an empty bypass', async () => {
    process.env.MCP_REQUIRED_SCOPES = 'custom:invoke,tenant:access';
    await open();
    const init = { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }) };
    expect((await request('/mcp/v1', token(), init)).status).toBe(403);
    expect((await request('/mcp/v1', token(['custom:invoke', 'tenant:access']), init)).status).toBe(200);
  });

  test.each(['/metrics', '/metrics/summary'])('%s requires admin role and metrics:read scope', async (path) => {
    await open();
    expect((await request(path, token(['metrics:read']))).status).toBe(403);
    expect((await request(path, token(['mcp:invoke'], ['admin']))).status).toBe(403);
    expect((await request(path, token(['metrics:read'], ['admin']))).status).toBe(200);
  });

  test('admin cache operations require both admin role and admin:cache scope', async () => {
    await open();
    expect((await request('/admin/cache/stats', token(['admin:cache']))).status).toBe(403);
    expect((await request('/admin/cache/stats', token([], ['admin']))).status).toBe(403);
    expect((await request('/admin/cache/stats', token(['admin:cache'], ['admin']))).status).toBe(200);
    const invalid = await request('/admin/cache/clear', token(['admin:cache'], ['admin']), {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"pattern":42}',
    });
    expect(invalid.status).toBe(400);
  });

  test('accepts provisioned API keys and rejects revoked keys', async () => {
    const registry = getDefaultApiKeyRegistry();
    const { key } = registry.create({ principalId: 'monitor', principalType: 'service_account',
      roles: ['admin'], scopes: ['metrics:read'] });
    await open();
    const init = { headers: { 'x-api-key': key.token } };
    expect((await request('/metrics', undefined, init)).status).toBe(200);
    registry.revoke(key.keyId);
    expect((await request('/metrics', undefined, init)).status).toBe(401);
  });

  test('rejects conflicting credential aliases and duplicate credential headers', async () => {
    await open();
    for (const headers of [
      { 'x-api-key': 'a', 'api-key': 'b' },
      { authorization: `Bearer ${token()}`, 'x-api-key': 'a' },
      { authorization: '' },
    ]) {
      expect((await request('/metrics', undefined, { headers })).status).toBe(401);
    }
    const status = await new Promise<number>((resolve, reject) => {
      const request = http.request(`${baseUrl}/metrics`, { headers: [
        'Host', new URL(baseUrl).host, 'Authorization', `Bearer ${token()}`,
        'Authorization', `Bearer ${token()}`,
      ] }, (response) => { response.resume(); resolve(response.statusCode!); });
      request.on('error', reject);
      request.end();
    });
    expect(status).toBe(401);
  });

  test.each([
    { exp: Math.floor(Date.now() / 1000) - 60 },
    { nbf: Math.floor(Date.now() / 1000) + 60, exp: Math.floor(Date.now() / 1000) + 120 },
    { iat: Math.floor(Date.now() / 1000) + 60, exp: Math.floor(Date.now() / 1000) + 120 },
    { principal_type: 'anonymous', exp: Math.floor(Date.now() / 1000) + 60 },
    { principal_type: 'invented', exp: Math.floor(Date.now() / 1000) + 60 },
    { scopes: ['mcp:invoke', 42], exp: Math.floor(Date.now() / 1000) + 60 },
    {},
  ])('rejects invalid or unbounded JWT claims: %j', async (claims) => {
    await open();
    const signed = jwt.sign({ sub: 'bad-token', scopes: ['mcp:invoke'], ...claims }, secret);
    expect((await request('/mcp/v1', signed, { method: 'POST' })).status).toBe(401);
  });

  test('rejects algorithm substitution, wrong audience, and wrong issuer', async () => {
    process.env.JWT_ISSUER = 'https://issuer.example';
    process.env.JWT_AUDIENCE = 'universal-mcp';
    const good = token(['metrics:read'], ['admin']);
    expect(verify(good).aud).toBe('universal-mcp');
    await open();
    for (const signed of [
      jwt.sign({ sub: 'a' }, secret, { algorithm: 'HS384', expiresIn: '1h' }),
      jwt.sign({ sub: 'a', iss: 'https://issuer.example', aud: 'wrong' }, secret, { expiresIn: '1h' }),
      jwt.sign({ sub: 'a', iss: 'https://wrong.example', aud: 'universal-mcp' }, secret, { expiresIn: '1h' }),
    ]) expect((await request('/metrics', signed)).status).toBe(401);
    expect((await request('/metrics', good)).status).toBe(200);
  });

  test('never falls back to a default JWT key', () => {
    const signed = token();
    delete process.env.JWT_SECRET;
    expect(() => sign({ sub: 'a' })).toThrow('JWT_SECRET');
    expect(() => verify(signed)).toThrow('JWT_SECRET');
    process.env.JWT_SECRET = 'short';
    expect(() => verify(signed)).toThrow('JWT_SECRET');
  });

  test('rejects DNS rebinding and forwarded host spoofing by default', async () => {
    await open();
    const response = await authorityRequest({ host: 'attacker.example', 'x-forwarded-host': 'localhost' });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'invalid_host' });
  });

  test('requires exact configured authorities and explicit allowed browser origins', async () => {
    process.env.MCP_ALLOWED_HOSTS = 'hub.example:8443';
    process.env.MCP_ALLOWED_ORIGINS = 'https://console.example';
    await open();
    const allowed = { host: 'hub.example:8443', origin: 'https://console.example' };
    expect((await authorityRequest(allowed)).status).toBe(200);
    expect((await authorityRequest({ ...allowed, host: 'hub.example:8444' })).status).toBe(400);
    for (const origin of ['null', 'https://console.example.attacker.test', 'https://console.example@attacker.test']) {
      expect((await authorityRequest({ ...allowed, origin })).status).toBe(403);
    }
  });

  test('denies browser origins unless explicitly configured', async () => {
    await open();
    expect((await request('/health/live', undefined, { headers: { origin: baseUrl } })).status).toBe(403);
  });

  test.each(['*', 'http://example.com', 'example.com/path', '127.1', 'example.com:'])('rejects malformed host policy %s', (host) => {
    process.env.MCP_ALLOWED_HOSTS = host;
    expect(() => createRequestSafetyMiddleware()).toThrow('MCP_ALLOWED_HOSTS');
  });

  test('rejects invalid origin configuration without silently weakening the policy', () => {
    process.env.MCP_ALLOWED_ORIGINS = 'null';
    expect(() => createRequestSafetyMiddleware()).toThrow('MCP_ALLOWED_ORIGINS');
  });

  test('returns bounded parser errors without reflecting submitted secrets', async () => {
    process.env.BODY_LIMIT = '64b';
    await open();
    const headers = { 'content-type': 'application/json', 'x-request-id': 'security-test-1' };
    const malformed = await request('/mcp/v1', token(), { method: 'POST', headers, body: '{"secret":"private-value"' });
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({ error: 'invalid_json', requestId: 'security-test-1' });
    const oversized = await request('/mcp/v1', token(), { method: 'POST', headers, body: JSON.stringify({ input: 'x'.repeat(100) }) });
    expect(oversized.status).toBe(413);
  });
});

describe('listener lifecycle', () => {
  test('importing the app does not bind a listener or register shutdown handlers', async () => {
    const source = new URL('../../src/server.ts', import.meta.url).href;
    const code = `const before = process.listenerCount('SIGTERM');
      const { app, createApp } = await import(${JSON.stringify(source)});
      if (typeof app !== 'function' || typeof createApp !== 'function') throw Error('Missing app export');
      if (process.listenerCount('SIGTERM') !== before) throw Error('Unexpected signal handler');
      process.stdout.write('imported');`;
    const { stdout } = await promisify(execFile)(process.execPath,
      ['--import', 'tsx', '--input-type=module', '-e', code], {
        timeout: 8000, windowsHide: true, env: { ...process.env, PORT: 'invalid-on-purpose' },
      });
    expect(stdout).toContain('imported');
  });

  test('validates port and requires host policy before non-loopback binding', () => {
    process.env.PORT = '3000trailing';
    expect(() => startServer()).toThrow('PORT');
    process.env.PORT = '0';
    process.env.HOST = '0.0.0.0';
    expect(() => startServer()).toThrow('MCP_ALLOWED_HOSTS');
  });

  test('drains idle servers and reuses the same shutdown operation', async () => {
    await open();
    const first = shutdownServer(server, 100);
    expect(shutdownServer(server, 100)).toBe(first);
    expect(await first).toBe(true);
    expect(server.listening).toBe(false);
  });

  test('forces closure of an active request after the shutdown deadline', async () => {
    const hanging = express();
    let started!: () => void;
    const incoming = new Promise<void>((resolve) => { started = resolve; });
    hanging.get('/hang', (_req, res) => { res.write('waiting'); started(); });
    await open(hanging);
    const response = await fetch(`${baseUrl}/hang`);
    const consumption = response.text().catch(() => undefined);
    await incoming;
    expect(await shutdownServer(server, 30)).toBe(false);
    await consumption;
    expect(server.listening).toBe(false);
  });
});
