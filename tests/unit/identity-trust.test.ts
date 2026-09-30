import { describe, expect, test } from '@jest/globals';
import {
  AnonymousPrincipal,
  PrincipalContextSchema,
  authorize,
  constantTimeEqual,
  digestApiKey,
  generateApiKey,
  parseApiKey,
} from '../../src/auth/index.js';

describe('identity trust foundation', () => {
  test('requires a normalized principal and rejects anonymous non-none auth', () => {
    expect(PrincipalContextSchema.safeParse(AnonymousPrincipal).success).toBe(true);
    expect(
      PrincipalContextSchema.safeParse({ ...AnonymousPrincipal, authMethod: 'api_key' }).success,
    ).toBe(false);
  });

  test('rejects an expired principal context', () => {
    expect(
      PrincipalContextSchema.safeParse({
        principalId: 'user-1',
        principalType: 'user',
        authMethod: 'oauth',
        roles: [],
        scopes: [],
        attributes: {},
        issuedAt: 20,
        expiresAt: 10,
      }).success,
    ).toBe(false);
  });

  test('fails closed when policy evaluation is unavailable', async () => {
    const decision = await authorize(
      {
        principal: { ...AnonymousPrincipal, principalId: 'user-1', principalType: 'user', authMethod: 'oauth' },
        action: 'mcp.tools.execute',
        resource: 'tool:example',
      },
      { evaluate: () => { throw new Error('policy store unavailable'); } },
    );

    expect(decision).toEqual({ decision: 'DENY', controlId: 'IAM-AUTHZ-001', reason: 'policy_unavailable' });
  });

  test('denies missing principals and tenant mismatches', async () => {
    const policy = { evaluate: () => ({ decision: 'ALLOW' as const, controlId: 'IAM-AUTHZ-001', reason: 'allowed' as const }) };
    await expect(authorize({ principal: null, action: 'read', resource: 'resource:1' }, policy)).resolves.toMatchObject({ decision: 'DENY', reason: 'principal_required' });
    await expect(authorize({ principal: { ...AnonymousPrincipal, principalId: 'user-1', principalType: 'user', authMethod: 'oauth', tenantId: 'tenant-a' }, action: 'read', resource: 'resource:1', tenantId: 'tenant-b' }, policy)).resolves.toMatchObject({ decision: 'DENY', reason: 'tenant_mismatch' });
  });

  test('generates parseable API keys and never uses the pepper as the stored digest', () => {
    const generated = generateApiKey('test');
    const parsed = parseApiKey(generated.token);
    const digest = digestApiKey(generated.token, 'vault-pepper');

    expect(parsed).toEqual({ environment: 'test', keyId: generated.keyId });
    expect(generated.token).not.toContain('vault-pepper');
    expect(digest).toHaveLength(64);
    expect(constantTimeEqual(digest, digestApiKey(generated.token, 'vault-pepper'))).toBe(true);
    expect(constantTimeEqual(digest, digestApiKey(generated.token, 'other-pepper'))).toBe(false);
  });
});
