import type { Request, RequestHandler, Response } from 'express';
import { AnonymousPrincipal, type PrincipalContext } from './principal-context.js';
import { authenticate, type AuthenticationResult, type CredentialRequest } from './authentication.js';
import { authorize, deny, hasScope, type AuthorizationPolicy } from './authorization.js';
import { getDefaultApiKeyRegistry } from './api-key-registry.js';
import { createOidcVerifierFromEnv, type OidcVerifier } from './oidc.js';
import { writeAuditEvent } from '../audit/audit-log.js';

/* eslint-disable no-unused-vars */
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      principal?: PrincipalContext;
      authentication?: AuthenticationResult;
    }
  }
}
/* eslint-enable no-unused-vars */

export type AuthMode = 'required' | 'optional' | 'disabled';

export interface AuthorizationMiddlewareOptions {
  action: string;
  resource: string;
  requiredScopes?: string[];
  requiredRoles?: string[];
  controlId?: string;
}

function headerValue(request: CredentialRequest, name: string): string | undefined {
  const value = request.headers[name] ?? request.headers[name.toLowerCase()];
  if (Array.isArray(value)) return value.length === 1 ? value[0] : undefined;
  return typeof value === 'string' ? value : undefined;
}

function extractCredential(request: CredentialRequest): { kind: 'bearer' | 'api_key'; token: string } | null {
  const authorization = headerValue(request, 'authorization');
  const apiKeyHeader = headerValue(request, 'x-api-key') ?? headerValue(request, 'api-key');
  if (authorization && apiKeyHeader) throw new Error('multiple_credentials');
  if (apiKeyHeader) return { kind: 'api_key', token: apiKeyHeader };
  if (!authorization) return null;

  const match = /^(Bearer|Api-Key)\s+([^\s]+)$/i.exec(authorization);
  if (!match) throw new Error('malformed_authorization');
  return { kind: match[1].toLowerCase() === 'api-key' ? 'api_key' : 'bearer', token: match[2] };
}

function configuredMode(): AuthMode {
  const configured = process.env.MCP_AUTH_MODE?.trim().toLowerCase();
  if (configured === 'required' || configured === 'optional' || configured === 'disabled') return configured;
  return process.env.NODE_ENV === 'production' ? 'required' : 'optional';
}

function configuredScopes(): string[] {
  const configured = process.env.MCP_REQUIRED_SCOPES ?? (configuredMode() === 'required' ? 'mcp:invoke' : '');
  return configured
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);
}

let oidcVerifier: OidcVerifier | null | undefined;

function getOidcVerifier(): OidcVerifier | null {
  if (oidcVerifier === undefined) oidcVerifier = createOidcVerifierFromEnv();
  return oidcVerifier;
}

async function validateCredential(credential: { kind: 'bearer' | 'api_key'; token: string }): Promise<PrincipalContext | null> {
  if (credential.kind === 'api_key' || credential.token.startsWith('usk_')) {
    return getDefaultApiKeyRegistry().authenticate(credential.token);
  }
  return getOidcVerifier()?.verify(credential.token) ?? null;
}

function requestForAuthentication(req: Request): CredentialRequest {
  return {
    headers: req.headers,
    method: req.method,
    path: req.path,
  };
}

function auditAuthentication(req: Request, result: AuthenticationResult): void {
  writeAuditEvent({
    eventType: 'authentication',
    outcome: result.authenticated ? 'success' : 'failure',
    requestId: req.requestId ?? 'unknown',
    ...(result.authenticated ? { principalId: result.principal.principalId, authMethod: result.principal.authMethod } : {}),
    controlId: 'IAM-OAUTH-001',
    reason: result.authenticated ? 'authenticated' : result.reason,
    action: `${req.method} ${req.path}`,
  });
}

function unauthorized(res: Response, reason: string): void {
  res.setHeader('WWW-Authenticate', 'Bearer realm="universal-mcp"');
  res.status(401).json({ error: 'unauthorized', reason });
}

export function createAuthenticationMiddleware(mode: AuthMode = configuredMode()): RequestHandler {
  return async (req, res, next) => {
    if (mode === 'disabled') {
      req.principal = AnonymousPrincipal;
      req.authentication = { authenticated: true, principal: AnonymousPrincipal };
      next();
      return;
    }

    let result: AuthenticationResult;
    try {
      result = await authenticate(
        requestForAuthentication(req),
        {
          extract: (request) => extractCredential(request),
        },
        {
          validate: (credential) => validateCredential(credential),
        },
      );
    } catch {
      result = { authenticated: false, reason: 'invalid_credential' };
    }

    req.authentication = result;
    auditAuthentication(req, result);
    if (result.authenticated) {
      req.principal = result.principal;
      next();
      return;
    }

    if (result.reason === 'missing_credential' && mode === 'optional') {
      req.principal = AnonymousPrincipal;
      next();
      return;
    }

    unauthorized(res, result.reason);
  };
}

export function createMcpAuthorizationMiddleware(options: AuthorizationMiddlewareOptions): RequestHandler {
  const requiredScopes = options.requiredScopes ?? configuredScopes();
  const controlId = options.controlId ?? 'IAM-AUTHZ-001';

  return async (req, res, next) => {
    const principal = req.principal ?? null;
    const policy: AuthorizationPolicy = {
      evaluate: () => {
        if (!principal) return deny(controlId, 'principal_required');
        const missingScopes = requiredScopes.filter((scope) => !hasScope(principal, scope));
        if (missingScopes.length > 0) return deny(controlId, 'required_scope_missing', missingScopes);
        const missingRoles = (options.requiredRoles ?? []).filter((role) => !principal.roles.includes(role));
        if (missingRoles.length > 0) return deny(controlId, 'policy_denied');
        return { decision: 'ALLOW', controlId, reason: 'allowed' };
      },
    };

    const decision = await authorize({ principal, action: options.action, resource: options.resource }, policy);
    writeAuditEvent({
      eventType: 'authorization',
      outcome: decision.decision === 'ALLOW' ? 'success' : 'failure',
      requestId: req.requestId ?? 'unknown',
      ...(principal ? { principalId: principal.principalId, authMethod: principal.authMethod } : {}),
      controlId: decision.controlId,
      reason: decision.reason,
      action: options.action,
      resource: options.resource,
    });

    if (decision.decision === 'ALLOW') {
      next();
      return;
    }
    if (decision.reason === 'principal_required') {
      unauthorized(res, decision.reason);
      return;
    }
    res.status(403).json({ error: 'forbidden', reason: decision.reason, controlId: decision.controlId });
  };
}

export function getAuthMode(): AuthMode {
  return configuredMode();
}
