import type { PrincipalContext } from './principal-context.js';

export interface AuthorizationRequest {
  principal: PrincipalContext | null;
  action: string;
  resource: string;
  tenantId?: string;
}

export type AuthorizationDenyReason =
  | 'principal_required'
  | 'tenant_mismatch'
  | 'required_scope_missing'
  | 'policy_denied'
  | 'policy_unavailable'
  | 'policy_malformed';

export type AuthorizationDecision =
  | { decision: 'ALLOW'; controlId: string; reason: 'allowed' }
  | { decision: 'DENY'; controlId: string; reason: AuthorizationDenyReason; requiredScopes?: string[] };

export interface AuthorizationPolicy {
  evaluate(request: AuthorizationRequest): AuthorizationDecision | Promise<AuthorizationDecision>;
}

export function hasScope(principal: PrincipalContext, requiredScope: string): boolean {
  return principal.scopes.includes(requiredScope) || principal.scopes.includes('*');
}

export function deny(controlId: string, reason: AuthorizationDenyReason, requiredScopes?: string[]): AuthorizationDecision {
  return { decision: 'DENY', controlId, reason, ...(requiredScopes ? { requiredScopes } : {}) };
}

export async function authorize(
  request: AuthorizationRequest,
  policy: AuthorizationPolicy,
): Promise<AuthorizationDecision> {
  if (!request.principal || request.principal.principalType === 'anonymous' || request.principal.authMethod === 'none') {
    return deny('IAM-AUTHZ-001', 'principal_required');
  }
  if (request.tenantId && request.principal.tenantId !== request.tenantId) {
    return deny('IAM-AUTHZ-001', 'tenant_mismatch');
  }

  try {
    const decision = await policy.evaluate(request);
    if (!decision || (decision.decision !== 'ALLOW' && decision.decision !== 'DENY') ||
        typeof decision.controlId !== 'string' || !decision.controlId ||
        typeof decision.reason !== 'string' || !decision.reason ||
        (decision.decision === 'ALLOW' && decision.reason !== 'allowed')) {
      return deny('IAM-AUTHZ-001', 'policy_malformed');
    }
    return decision;
  } catch {
    return deny('IAM-AUTHZ-001', 'policy_unavailable');
  }
}
