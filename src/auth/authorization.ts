import type { PrincipalContext } from './principal-context.js';

export interface AuthorizationRequest {
  principal: PrincipalContext | null;
  action: string;
  resource: string;
  tenantId?: string;
  environment?: string;
}

export interface AuthorizationDecision {
  decision: 'ALLOW' | 'DENY';
  controlId: string;
  reason:
    | 'principal_required'
    | 'tenant_mismatch'
    | 'required_scope_missing'
    | 'policy_denied'
    | 'policy_unavailable'
    | 'policy_malformed'
    | 'allowed';
  requiredScopes?: string[];
}

export interface AuthorizationPolicy {
  evaluate(request: AuthorizationRequest): AuthorizationDecision | Promise<AuthorizationDecision>;
}

export function hasScope(principal: PrincipalContext, requiredScope: string): boolean {
  return principal.scopes.includes(requiredScope) || principal.scopes.includes('*');
}

export function deny(controlId: string, reason: AuthorizationDecision['reason'], requiredScopes?: string[]): AuthorizationDecision {
  return { decision: 'DENY', controlId, reason, ...(requiredScopes ? { requiredScopes } : {}) };
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
    if (decision.decision !== 'ALLOW' && decision.decision !== 'DENY') {
      return deny('IAM-AUTHZ-001', 'policy_malformed');
    }
    return decision;
  } catch {
    return deny('IAM-AUTHZ-001', 'policy_unavailable');
  }
}
