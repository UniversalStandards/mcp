import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';
import jwt from 'jsonwebtoken';

assert.equal(process.versions.node.split('.')[0], '22');
assert.notEqual(process.getuid(), 0, 'Container must run without root privileges');
assert.ok(process.env.JWT_SECRET?.length >= 32, 'Smoke test requires an ephemeral signing key');
const base = 'http://127.0.0.1:3000';
const request = (path, init = {}) => fetch(`${base}${path}`, { ...init, signal: AbortSignal.timeout(2000) });

let started = false;
for (let attempt = 0; attempt < 30; attempt++) {
  try {
    const live = await request('/health/live');
    assert.equal(live.status, 200);
    assert.equal((await live.json()).alive, true);
    started = true;
    break;
  } catch {
    if (attempt < 29) await setTimeout(1000);
  }
}
assert.ok(started, 'Runtime did not become live within 30 attempts');
const readiness = await request('/health/ready');
assert.equal(readiness.status, 200);
assert.equal((await readiness.json()).ready, true);

const endpoints = ['/', '/mcp/v1', '/admin/cache/stats', '/admin/cache/clear', '/metrics', '/metrics/summary', '/health'];
for (const endpoint of endpoints) {
  for (const forged of [false, true]) {
    const method = ['/', '/mcp/v1', '/admin/cache/clear'].includes(endpoint) ? 'POST' : 'GET';
    const headers = { 'content-type': 'application/json' };
    if (forged) headers.authorization = 'Bearer invalid-token';
    const response = await request(endpoint, {
      method, headers,
      ...(method === 'POST' ? { body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) } : {})
    });
    assert.equal(response.status, 401, `${method} ${endpoint}: forged=${forged}`);
    assert.equal((await response.json()).error, 'unauthorized');
  }
}

const token = jwt.sign({ sub: 'ci-runtime-smoke', roles: ['admin'], scopes: ['mcp:invoke', 'metrics:read', 'admin:cache'] },
  process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '2m' });
const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
for (const endpoint of ['/metrics', '/admin/cache/stats', '/health']) {
  const response = await request(endpoint, { headers });
  assert.equal(response.status, 200, `Authorized ${endpoint}`);
}
for (const [method, params] of [['ping', {}], ['tools/list', {}], ['tools/call', { name: 'hub_list_servers', arguments: {} }]]) {
  const response = await request('/mcp/v1', { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', id: 42, method, params }) });
  assert.equal(response.status, 200, `Authorized ${method}`);
  const data = await response.json();
  assert.equal(data.id, 42);
  assert.ok(data.result);
}
const unavailable = await request('/mcp/v1', {
  method: 'POST', headers,
  body: JSON.stringify({ jsonrpc: '2.0', id: 43, method: 'tools/call', params: { name: 'github_search_repos' } })
});
assert.equal(unavailable.status, 500);
assert.deepEqual(await unavailable.json(), { jsonrpc: '2.0', id: 43, error: { code: -32603, message: 'The requested operation could not be completed' } });
console.log('Node 22 non-root runtime, public probes, 14 denied requests, scoped access, hub calls, and explicit execution failure passed.');
