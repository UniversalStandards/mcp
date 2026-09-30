import type { PrincipalContext } from './principal-context.js';

export interface CredentialRequest {
  headers: Record<string, string | string[] | undefined>;
  method?: string;
  path?: string;
}

export interface CredentialExtractor<TCredential = unknown> {
  extract(request: CredentialRequest): TCredential | null | Promise<TCredential | null>;
}

export interface CredentialValidator<TCredential = unknown> {
  validate(credential: TCredential): PrincipalContext | null | Promise<PrincipalContext | null>;
}

export interface AuthenticationResult {
  principal: PrincipalContext | null;
  reason?: 'missing_credential' | 'invalid_credential' | 'expired_credential' | 'malformed_principal';
}

export async function authenticate<TCredential>(
  request: CredentialRequest,
  extractor: CredentialExtractor<TCredential>,
  validator: CredentialValidator<TCredential>,
): Promise<AuthenticationResult> {
  const credential = await extractor.extract(request);
  if (credential === null) return { principal: null, reason: 'missing_credential' };

  try {
    const principal = await validator.validate(credential);
    return principal ? { principal } : { principal: null, reason: 'invalid_credential' };
  } catch {
    return { principal: null, reason: 'malformed_principal' };
  }
}
