import { parsePrincipalContext, type PrincipalContext } from './principal-context.js';

export interface CredentialRequest {
  headers: Record<string, string | string[] | undefined>;
  rawHeaders?: string[];
  method?: string;
  path?: string;
}

export interface CredentialExtractor<TCredential = unknown> {
  extract(request: CredentialRequest): TCredential | null | Promise<TCredential | null>;
}

export interface CredentialValidator<TCredential = unknown> {
  validate(credential: TCredential): PrincipalContext | null | Promise<PrincipalContext | null>;
}

export type AuthenticationFailureReason =
  | 'missing_credential'
  | 'invalid_credential'
  | 'malformed_principal';

export type AuthenticationResult =
  | { authenticated: true; principal: PrincipalContext }
  | { authenticated: false; reason: AuthenticationFailureReason };

export async function authenticate<TCredential>(
  request: CredentialRequest,
  extractor: CredentialExtractor<TCredential>,
  validator: CredentialValidator<TCredential>,
): Promise<AuthenticationResult> {
  let credential: TCredential | null;
  try {
    credential = await extractor.extract(request);
  } catch {
    return { authenticated: false, reason: 'invalid_credential' };
  }
  if (credential === null) return { authenticated: false, reason: 'missing_credential' };

  try {
    const candidate = await validator.validate(credential);
    if (!candidate) return { authenticated: false, reason: 'invalid_credential' };
    const principal = parsePrincipalContext(candidate);
    if (principal.principalType === 'anonymous' || principal.authMethod === 'none' ||
        (principal.expiresAt !== undefined && principal.expiresAt <= Date.now() / 1000) ||
        (principal.issuedAt !== undefined && principal.issuedAt > Date.now() / 1000)) {
      return { authenticated: false, reason: 'invalid_credential' };
    }
    return { authenticated: true, principal };
  } catch {
    return { authenticated: false, reason: 'malformed_principal' };
  }
}
