import { describe, expect, test } from '@jest/globals';
import type { Request, Response } from 'express';
import { AnonymousPrincipal } from '../../src/auth/principal-context.js';
import { createAuthenticationMiddleware, createMcpAuthorizationMiddleware } from '../../src/auth/http-authentication.js';

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
  return { headers, method: 'POST', path: '/mcp/v1', requestId: 'request-1' } as unknown as Request;
}

describe('HTTP authentication boundary', () => {
  test('fails closed when authentication is required and no credential is present', async () => {
    const request = requestMock();
    const response = responseMock();
    let nextCalled = false;

    await createAuthenticationMiddleware('required')(request, response, () => { nextCalled = true; });

    expect(nextCalled).toBe(false);
    expect(response.statusCode).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toContain('Bearer');
  });

  test('uses an explicit anonymous principal only in optional mode', async () => {
    const request = requestMock();
    const response = responseMock();
    let nextCalled = false;

    await createAuthenticationMiddleware('optional')(request, response, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
    expect(request.principal).toEqual(AnonymousPrincipal);
  });

  test('requires the configured MCP scope before allowing an authenticated request', async () => {
    const request = requestMock();
    request.principal = { ...AnonymousPrincipal, principalId: 'agent-1', principalType: 'agent', authMethod: 'api_key', scopes: [] };
    const response = responseMock();
    let nextCalled = false;

    await createMcpAuthorizationMiddleware({
      action: 'mcp:invoke',
      resource: 'mcp://universal-mcp-hub',
      requiredScopes: ['mcp:invoke'],
    })(request, response, () => { nextCalled = true; });

    expect(nextCalled).toBe(false);
    expect(response.statusCode).toBe(403);
    expect(response.body).toMatchObject({ error: 'forbidden', reason: 'required_scope_missing' });
  });
});
