import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import http from 'node:http';
import express from 'express';
import type { Request, Response } from 'express';
import { sign } from '../../src/auth/jwt-handler.js';
import { AnonymousPrincipal, parsePrincipalContext, type PrincipalContext } from '../../src/auth/principal-context.js';
import { authenticate } from '../../src/auth/authentication.js';
import { authorize, type AuthorizationDecision } from '../../src/auth/authorization.js';
import {
  createAuthenticationMiddleware,
  createMcpAuthorizationMiddleware,
  createRequestSafetyMiddleware,
} from '../../src/auth/http-authentication.js';

function responseMock() {
  const response = {
    headers: new Map<string, string>(),
    statusCode: 200,
    body: undefined as unknown,
    setHeader(name: string, value: string) {
      this.headers.set(name, value);
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return response as unknown as Response & { headers: Map<string, string>; statusCode: number; body: unknown };
}

function requestMock(headers: Record<string, string> = {}): Request {
  return {
    headers,
    method: 'POST',
    path: '/mcp/v1',
    rawHeaders: Object.entries(headers).flatMap(([name, value]) => [name, value]),
    get(name: string) {
      return headers[name.toLowerCase()];
    },
  } as unknown as Request;
}

describe('HTTP authentication boundary', () => {
  const originalEnvironment = {
    jwtSecret: process.env.JWT_SECRET,
    nodeEnvironment: process.env.NODE_ENV,
    allowedHosts: process.env.MCP_ALLOWED_HOSTS,
    allowedOrigins: process.env.MCP_ALLOWED_ORIGINS,
  };

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256';
    delete process.env.MCP_ALLOWED_HOSTS;
    delete process.env.MCP_ALLOWED_ORIGINS;
  });

  afterEach(() => {
    restoreEnvironment('JWT_SECRET', originalEnvironment.jwtSecret);
    restoreEnvironment('NODE_ENV', originalEnvironment.nodeEnvironment);
    restoreEnvironment('MCP_ALLOWED_HOSTS', originalEnvironment.allowedHosts);
    restoreEnvironment('MCP_ALLOWED_ORIGINS', originalEnvironment.allowedOrigins);
  });

  test('fails closed when a protected request has no credential', async () => {
    const request = requestMock({ host: 'localhost:3000' });
    const response = responseMock();
    let nextCalled = false;

    await createAuthenticationMiddleware('required')(request, response, () => { nextCalled = true; });

    expect(nextCalled).toBe(false);
    expect(response.statusCode).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toContain('Bearer');
  });

  test('rejects tokens when the signing secret is absent instead of using a default', async () => {
    delete process.env.JWT_SECRET;
    const request = requestMock({ authorization: 'Bearer fabricated-token' });
    const response = responseMock();
    let nextCalled = false;

    await createAuthenticationMiddleware('required')(request, response, () => { nextCalled = true; });

    expect(nextCalled).toBe(false);
    expect(response.statusCode).toBe(401);
  });

  test('requires the MCP scope before allowing an authenticated request', async () => {
    const request = requestMock({ authorization: `Bearer ${sign({ sub: 'agent-1' })}` });
    const response = responseMock();
    let nextCalled = false;

    await createAuthenticationMiddleware('required')(request, response, () => { nextCalled = true; });
    nextCalled = false;
    await createMcpAuthorizationMiddleware({
      action: 'mcp:invoke',
      resource: 'mcp://universal-mcp-hub',
      requiredScopes: ['mcp:invoke'],
    })(request, response, () => { nextCalled = true; });

    expect(nextCalled).toBe(false);
    expect(response.statusCode).toBe(403);
    expect(response.body).toMatchObject({ error: 'forbidden', reason: 'required_scope_missing' });
  });

  test('allows an explicitly scoped admin principal through the admin policy', async () => {
    const request = requestMock({ authorization: `Bearer ${sign({
      sub: 'admin-1',
      roles: ['admin'],
      scopes: ['admin:cache'],
    })}` });
    const response = responseMock();
    let nextCalled = false;

    await createAuthenticationMiddleware('required')(request, response, () => { nextCalled = true; });
    await createMcpAuthorizationMiddleware({
      action: 'admin:cache',
      resource: 'mcp://universal-mcp-hub/admin/cache',
      requiredScopes: ['admin:cache'],
      requiredRoles: ['admin'],
    })(request, response, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
    expect(response.statusCode).toBe(200);
  });

  test('rejects an unconfigured browser origin and malformed host', () => {
    process.env.MCP_ALLOWED_HOSTS = 'admin.example.test';
    process.env.MCP_ALLOWED_ORIGINS = 'https://admin.example.test';
    const middleware = createRequestSafetyMiddleware();

    const originResponse = responseMock();
    let originNextCalled = false;
    middleware(
      requestMock({ host: 'admin.example.test', origin: 'https://evil.example.test' }),
      originResponse,
      () => { originNextCalled = true; },
    );
    expect(originNextCalled).toBe(false);
    expect(originResponse.statusCode).toBe(403);

    const hostResponse = responseMock();
    let hostNextCalled = false;
    middleware(
      requestMock({ host: 'admin.example.test@evil.example.test' }),
      hostResponse,
      () => { hostNextCalled = true; },
    );
    expect(hostNextCalled).toBe(false);
    expect(hostResponse.statusCode).toBe(400);
  });

  test('does not treat the anonymous principal as authenticated authorization', async () => {
    const request = requestMock();
    request.principal = AnonymousPrincipal;
    const response = responseMock();
    let nextCalled = false;

    await createMcpAuthorizationMiddleware({
      action: 'mcp:invoke',
      resource: 'mcp://universal-mcp-hub',
      requiredScopes: ['mcp:invoke'],
    })(request, response, () => { nextCalled = true; });

    expect(nextCalled).toBe(false);
    expect(response.statusCode).toBe(401);
    expect(parsePrincipalContext(AnonymousPrincipal)).toEqual(AnonymousPrincipal);
  });

  test('does not execute an unauthenticated admin action', async () => {
    const testApp = express();
    let handlerCalled = false;
    testApp.get(
      '/admin/cache/stats',
      createRequestSafetyMiddleware(),
      createAuthenticationMiddleware('required'),
      createMcpAuthorizationMiddleware({
        action: 'admin:cache',
        resource: 'mcp://universal-mcp-hub/admin/cache',
        requiredScopes: ['admin:cache'],
        requiredRoles: ['admin'],
      }),
      (_request, response) => {
        handlerCalled = true;
        response.json({ ok: true });
      },
    );
    const server = http.createServer(testApp);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected a TCP server address');

    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/admin/cache/stats`);
      expect(response.status).toBe(401);
      expect(handlerCalled).toBe(false);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

describe('identity and authorization contracts', () => {
  const principal = parsePrincipalContext({ principalId: 'worker', principalType: 'agent',
    authMethod: 'api_key', tenantId: 'tenant-a', scopes: ['mcp:invoke'] });

  test.each(['oauth', 'workload_identity', 'api_key', 'jwt'])('preserves the %s identity contract', (authMethod) => {
    expect(parsePrincipalContext({ ...principal, authMethod }).authMethod).toBe(authMethod);
  });

  test.each([
    AnonymousPrincipal,
    { ...principal, expiresAt: Math.floor(Date.now() / 1000) - 1 },
    { ...principal, issuedAt: Math.floor(Date.now() / 1000) + 60 },
    { ...principal, scopes: [42] },
  ])('does not authenticate anonymous, expired, future-issued, or malformed identities', async (candidate) => {
    const result = await authenticate({ headers: {} }, { extract: () => 'credential' },
      { validate: () => candidate as PrincipalContext });
    expect(result.authenticated).toBe(false);
  });

  test('enforces tenant boundaries before invoking an allowing policy', async () => {
    let evaluated = false;
    const decision = await authorize({ principal, action: 'mcp:invoke', resource: 'mcp://hub', tenantId: 'tenant-b' }, {
      evaluate: () => { evaluated = true; return { decision: 'ALLOW', controlId: 'IAM-AUTHZ-001', reason: 'allowed' }; },
    });
    expect(evaluated).toBe(false);
    expect(decision).toMatchObject({ decision: 'DENY', reason: 'tenant_mismatch' });
  });

  test('denies malformed and unavailable policy results', async () => {
    const request = { principal, action: 'mcp:invoke', resource: 'mcp://hub' };
    expect(await authorize(request, { evaluate: () => ({ decision: 'ALLOW' } as AuthorizationDecision) }))
      .toMatchObject({ decision: 'DENY', reason: 'policy_malformed' });
    expect(await authorize(request, { evaluate: () => { throw new Error('unavailable'); } }))
      .toMatchObject({ decision: 'DENY', reason: 'policy_unavailable' });
  });
});
