import type { Request, RequestHandler, Response } from 'express';
import { getDefaultApiKeyRegistry } from './api-key-registry.js';
import { authenticate, type AuthenticationResult, type CredentialRequest } from './authentication.js';
import { authorize, deny, hasScope, type AuthorizationPolicy } from './authorization.js';
import { parsePrincipalContext, AnonymousPrincipal, type PrincipalContext } from './principal-context.js';
import { verify } from './jwt-handler.js';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      principal?: PrincipalContext;
      authentication?: AuthenticationResult;
    }
  }
}

export type AuthMode = 'required' | 'optional';

export interface AuthorizationMiddlewareOptions {
  action: string;
  resource: string;
  requiredScopes?: string[];
  requiredRoles?: string[];
  controlId?: string;
}

function headerValue(request: CredentialRequest, name: string): string | undefined {
  const occurrences = request.rawHeaders?.filter((value, index) => index % 2 === 0 && value.toLowerCase() === name).length ?? 0;
  if (occurrences > 1) throw new Error('duplicate_credential_header');
  const value = request.headers[name] ?? request.headers[name.toLowerCase()];
  if (Array.isArray(value)) throw new Error('duplicate_credential_header');
  return typeof value === 'string' ? value : undefined;
}

function extractCredential(request: CredentialRequest): { kind: 'bearer' | 'api_key'; token: string } | null {
  const authorization = headerValue(request, 'authorization');
  const apiKeys = [headerValue(request, 'x-api-key'), headerValue(request, 'api-key')].filter((value) => value !== undefined);
  if (apiKeys.length > 1 || (authorization !== undefined && apiKeys.length > 0)) throw new Error('multiple_credentials');
  if (apiKeys.length === 1) {
    if (!apiKeys[0]?.trim()) throw new Error('empty_credential');
    return { kind: 'api_key', token: apiKeys[0].trim() };
  }
  if (authorization === undefined) return null;

  const match = /^(Bearer|Api-Key)\s+([^\s]+)$/i.exec(authorization.trim());
  if (!match) throw new Error('malformed_authorization');
  return { kind: match[1].toLowerCase() === 'api-key' ? 'api_key' : 'bearer', token: match[2] };
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value) && value.every((item) => typeof item === 'string' && item.length > 0)) return value;
  if (typeof value === 'string') return value.split(/[\s,]+/).filter(Boolean);
  if (value === undefined) return [];
  throw new Error('Malformed permission claims');
}

function jwtPrincipal(token: string): PrincipalContext | null {
  const claims = verify(token);
  const principalId = typeof claims.sub === 'string' ? claims.sub : undefined;
  if (!principalId) return null;

  const principalType = claims.principal_type;
  const acceptedPrincipalType = principalType ?? 'user';
  const tenantId = typeof claims.tenant_id === 'string'
    ? claims.tenant_id
    : typeof claims.tid === 'string'
      ? claims.tid
      : undefined;

  return parsePrincipalContext({
    principalId,
    principalType: acceptedPrincipalType,
    ...(tenantId ? { tenantId } : {}),
    authMethod: 'jwt',
    ...(typeof claims.jti === 'string' ? { credentialId: claims.jti } : {}),
    roles: stringArray(claims.roles ?? claims.role),
    scopes: stringArray(claims.scopes ?? claims.scope ?? claims.scp),
    attributes: {
      ...(typeof claims.iss === 'string' ? { issuer: claims.iss } : {}),
      ...(typeof claims.azp === 'string' ? { authorizedParty: claims.azp } : {}),
    },
    ...(typeof claims.iat === 'number' ? { issuedAt: claims.iat } : {}),
    ...(typeof claims.exp === 'number' ? { expiresAt: claims.exp } : {}),
  });
}

async function validateCredential(credential: { kind: 'bearer' | 'api_key'; token: string }): Promise<PrincipalContext | null> {
  if (credential.kind === 'api_key' || credential.token.startsWith('usk_')) {
    return getDefaultApiKeyRegistry().authenticate(credential.token);
  }
  return jwtPrincipal(credential.token);
}

function requestForAuthentication(req: Request): CredentialRequest {
  return { headers: req.headers, rawHeaders: req.rawHeaders, method: req.method, path: req.path };
}

function unauthorized(res: Response, reason: string): void {
  res.setHeader('WWW-Authenticate', 'Bearer realm="universal-mcp"');
  res.status(401).json({ error: 'unauthorized', reason });
}

export function createAuthenticationMiddleware(mode: AuthMode = 'required'): RequestHandler {
  return async (req, res, next) => {
    delete req.principal;
    let result: AuthenticationResult;
    try {
      result = await authenticate(
        requestForAuthentication(req),
        { extract: extractCredential },
        { validate: validateCredential },
      );
    } catch {
      result = { authenticated: false, reason: 'invalid_credential' };
    }

    req.authentication = result;
    if (result.authenticated) {
      req.principal = result.principal;
      next();
      return;
    }
    if (mode === 'optional' && result.reason === 'missing_credential') {
      req.principal = AnonymousPrincipal;
      next();
      return;
    }
    unauthorized(res, result.reason);
  };
}

export function createRequestSafetyMiddleware(): RequestHandler {
  const configuredHosts = configuredList('MCP_ALLOWED_HOSTS').map((value) => {
    const host = normalizeHost(value);
    if (!host) throw new Error('MCP_ALLOWED_HOSTS contains an invalid authority');
    return host;
  });
  const configuredOrigins = configuredList('MCP_ALLOWED_ORIGINS').map((value) => {
    const origin = normalizeOrigin(value);
    if (!origin) throw new Error('MCP_ALLOWED_ORIGINS contains an invalid origin');
    return origin;
  });

  return (req, res, next) => {
    const hostHeaders = req.rawHeaders
      ? req.rawHeaders.filter((_value, index) => index % 2 === 0 && _value.toLowerCase() === 'host')
      : [];
    const rawHost = hostHeaders.length > 1 ? undefined : req.get('host');
    const host = rawHost ? normalizeHost(rawHost) : null;
    const loopbackHost = host ? new URL(`http://${host}`).hostname : null;
    const allowed = configuredHosts.length > 0
      ? host !== null && configuredHosts.includes(host)
      : loopbackHost !== null && ['localhost', '127.0.0.1', '[::1]'].includes(loopbackHost);
    if (!host || !allowed) {
      res.status(400).json({ error: 'invalid_host' });
      return;
    }
    const origin = req.get('origin');
    if (origin !== undefined) {
      const originCount = req.rawHeaders?.filter((value, index) => index % 2 === 0 && value.toLowerCase() === 'origin').length ?? 0;
      const normalizedOrigin = normalizeOrigin(origin);
      if (originCount > 1 || !normalizedOrigin || !configuredOrigins.includes(normalizedOrigin)) {
        res.status(403).json({ error: 'origin_not_allowed' });
        return;
      }
    }
    next();
  };
}

function configuredList(name: string): string[] {
  return (process.env[name] ?? '').split(',').map((value) => value.trim()).filter(Boolean);
}

function normalizeHost(value: string): string | null {
  if (!value || /[\s/@\\%?#*]/.test(value) || value.endsWith(':')) return null;
  try {
    const parsed = new URL(`http://${value}`);
    if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash || !parsed.hostname ||
        ![parsed.host, `${parsed.hostname}:80`].includes(value.toLowerCase())) return null;
    return parsed.host.toLowerCase();
  } catch {
    return null;
  }
}

function normalizeOrigin(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) return null;
    return parsed.origin.toLowerCase();
  } catch {
    return null;
  }
}

export function createMcpAuthorizationMiddleware(options: AuthorizationMiddlewareOptions): RequestHandler {
  const requiredScopes = options.requiredScopes ?? configuredList('MCP_REQUIRED_SCOPES');
  const effectiveScopes = requiredScopes.length > 0 ? requiredScopes : ['mcp:invoke'];
  const controlId = options.controlId ?? 'IAM-AUTHZ-001';

  return async (req, res, next) => {
    const principal = req.principal ?? null;
    const policy: AuthorizationPolicy = {
      evaluate: () => {
        if (!principal || principal.principalType === 'anonymous') return deny(controlId, 'principal_required');
        const missingScopes = effectiveScopes.filter((scope) => !hasScope(principal, scope));
        if (missingScopes.length > 0) return deny(controlId, 'required_scope_missing', missingScopes);
        const missingRoles = (options.requiredRoles ?? []).filter((role) => !principal.roles.includes(role));
        if (missingRoles.length > 0) return deny(controlId, 'policy_denied');
        return { decision: 'ALLOW', controlId, reason: 'allowed' };
      },
    };

    const decision = await authorize({ principal, action: options.action, resource: options.resource }, policy);
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
