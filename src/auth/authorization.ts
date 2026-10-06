import type { PrincipalContext } from './principal-context.js';

export interface AuthorizationRequest {
  principal: PrincipalContext | null;
  action: string;
  resource: string;
  tenantId?: string;
  environment?: string;
}

export type AuthorizationDenyReason =
  | 'principal_required'
  | 'tenant_mismatch'
  | 'required_scope_missing'
  | 'policy_denied'
  | 'policy_unavailable'
  | 'policy_malformed';

export type AuthorizationDecision =
  | {
      decision: 'ALLOW';
      controlId: string;
      reason: 'allowed';
      requiredScopes?: string[];
    }
  | {
      decision: 'DENY';
      controlId: string;
      reason: AuthorizationDenyReason;
      requiredScopes?: string[];
    };

export interface AuthorizationPolicy {
  evaluate(request: AuthorizationRequest): AuthorizationDecision | Promise<AuthorizationDecision>;
}

export function hasScope(principal: PrincipalContext, requiredScope: string): boolean {
  return principal.scopes.includes(requiredScope) || principal.scopes.includes('*');
}

export function deny(controlId: string, reason: AuthorizationDecision['reason'], requiredScopes?: string[]): AuthorizationDecision {
  if (reason === 'allowed') {
    throw new Error('DENY decisions cannot use the allowed reason');
  }
  return { decision: 'DENY', controlId, reason, ...(requiredScopes ? { requiredScopes } : {}) };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isValidRequiredScopes(value: unknown): value is string[] | undefined {
  return value === undefined || (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(isNonEmptyString) &&
    new Set(value).size === value.length
  );
}

export function isAuthorizationDecision(value: unknown): value is AuthorizationDecision {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (!isNonEmptyString(candidate.controlId) || !isValidRequiredScopes(candidate.requiredScopes)) return false;
  if (candidate.decision === 'ALLOW') return candidate.reason === 'allowed';
  if (candidate.decision === 'DENY') {
    return candidate.reason !== 'allowed' && [
      'principal_required',
      'tenant_mismatch',
      'required_scope_missing',
      'policy_denied',
      'policy_unavailable',
      'policy_malformed',
    ].includes(candidate.reason as AuthorizationDenyReason);
  }
  return false;
}

export async function authorize(
  request: AuthorizationRequest,
  policy: AuthorizationPolicy,
): Promise<AuthorizationDecision> {
  if (!request.principal) return deny('IAM-AUTHZ-001', 'principal_required');
  if (request.tenantId && request.principal.tenantId !== request.tenantId) {
    return deny('IAM-AUTHZ-001', 'tenant_mismatch');
  }

  try {
    const decision = await policy.evaluate(request);
    if (!isAuthorizationDecision(decision)) {
      return deny('IAM-AUTHZ-001', 'policy_malformed');
    }
    return decision;
  } catch {
    return deny('IAM-AUTHZ-001', 'policy_unavailable');
  }
}
