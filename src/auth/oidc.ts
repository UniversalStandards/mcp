import type { JWTPayload } from 'jose';
import { parsePrincipalContext, type PrincipalContext } from './principal-context.js';

export interface OidcVerifierConfig {
  issuer: string;
  audience: string;
  jwksUrl: string;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
  if (typeof value === 'string') return value.split(' ').filter(Boolean);
  return [];
}

export class OidcVerifier {
  private jwks?: ReturnType<(typeof import('jose'))['createRemoteJWKSet']>;
  private readonly config: OidcVerifierConfig;

  constructor(config: OidcVerifierConfig) {
    this.config = config;
  }

  async verify(token: string): Promise<PrincipalContext | null> {
    try {
      const { createRemoteJWKSet, jwtVerify } = await import('jose');
      this.jwks ??= createRemoteJWKSet(new URL(this.config.jwksUrl));
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.config.issuer,
        audience: this.config.audience,
      });
      return claimsToPrincipal(payload);
    } catch {
      return null;
    }
  }
}

export function createOidcVerifierFromEnv(): OidcVerifier | null {
  const issuer = process.env.OIDC_ISSUER?.trim();
  const audience = process.env.OIDC_AUDIENCE?.trim();
  const jwksUrl = process.env.OIDC_JWKS_URL?.trim() || (issuer ? `${issuer.replace(/\/+$/, '')}/.well-known/jwks.json` : undefined);
  if (!issuer && !audience && !jwksUrl) return null;
  if (!issuer || !audience || !jwksUrl) {
    throw new Error('OIDC_ISSUER, OIDC_AUDIENCE, and OIDC_JWKS_URL must be configured together');
  }
  return new OidcVerifier({ issuer, audience, jwksUrl });
}

export function getOidcProtectedResourceMetadata(resourceUrl: string): Record<string, unknown> {
  const authorizationServer = process.env.OIDC_ISSUER?.trim();
  const scopesSupported = (process.env.MCP_REQUIRED_SCOPES ?? 'mcp:invoke')
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);

  return {
    resource: resourceUrl,
    ...(authorizationServer ? { authorization_servers: [authorizationServer] } : {}),
    scopes_supported: scopesSupported,
    bearer_methods_supported: ['header'],
  };
}

function claimsToPrincipal(claims: JWTPayload): PrincipalContext {
  const subject = asString(claims.sub);
  const issuer = asString(claims.iss);
  if (!subject || !issuer) throw new Error('OIDC token is missing required claims');

  const roles = asStringArray(claims.roles ?? claims['role']);
  const scopes = asStringArray(claims.scope ?? claims.scp);
  const principalTypeClaim = asString(claims['principal_type']);
  const principalType = principalTypeClaim === 'service_account' || principalTypeClaim === 'agent' || principalTypeClaim === 'application' || principalTypeClaim === 'workload'
    ? principalTypeClaim
    : 'user';
  const tenantId = asString(claims['tenant_id'] ?? claims['tid']);

  return parsePrincipalContext({
    principalId: subject,
    principalType,
    ...(tenantId ? { tenantId } : {}),
    authMethod: 'oauth',
    roles,
    scopes,
    attributes: {
      issuer,
      ...(asString(claims.azp) ? { authorizedParty: claims.azp } : {}),
    },
    ...(asString(claims.jti) ? { credentialId: claims.jti } : {}),
    ...(typeof claims.iat === 'number' ? { issuedAt: claims.iat } : {}),
    ...(typeof claims.exp === 'number' ? { expiresAt: claims.exp } : {}),
  });
}
