import type { PrincipalContext } from './principal-context.js';

export interface CredentialRequest {
  headers: Record<string, string | string[] | undefined>;
  method?: string;
  path?: string;
}

export interface CredentialExtractor<TCredential = unknown> {
  extract(_request: CredentialRequest): TCredential | null | Promise<TCredential | null>;
}

export interface CredentialValidator<TCredential = unknown> {
  validate(_credential: TCredential): PrincipalContext | null | Promise<PrincipalContext | null>;
}

export type AuthenticationFailureReason =
  | 'missing_credential'
  | 'invalid_credential'
  | 'expired_credential'
  | 'malformed_principal';

export type AuthenticationResult =
  | {
      authenticated: true;
      principal: PrincipalContext;
      reason?: never;
    }
  | {
      authenticated: false;
      principal?: never;
      reason: AuthenticationFailureReason;
    };

export async function authenticate<TCredential>(
  request: CredentialRequest,
  extractor: CredentialExtractor<TCredential>,
  validator: CredentialValidator<TCredential>,
): Promise<AuthenticationResult> {
  const credential = await extractor.extract(request);
  if (credential === null) return { authenticated: false, reason: 'missing_credential' };

  try {
    const principal = await validator.validate(credential);
    return principal
      ? { authenticated: true, principal }
      : { authenticated: false, reason: 'invalid_credential' };
  } catch {
    return { authenticated: false, reason: 'malformed_principal' };
  }
}
