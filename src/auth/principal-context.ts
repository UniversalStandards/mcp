import { z } from 'zod';

export const PrincipalTypeSchema = z.enum([
  'anonymous',
  'user',
  'service_account',
  'agent',
  'application',
  'workload',
]);

export const AuthMethodSchema = z.enum([
  'none',
  'oauth',
  'api_key',
  'workload_identity',
]);

export const PrincipalContextSchema = z
  .object({
    principalId: z.string().min(1).max(256),
    principalType: PrincipalTypeSchema,
    tenantId: z.string().min(1).max(256).optional(),
    authMethod: AuthMethodSchema,
    roles: z.array(z.string().min(1)).default([]),
    scopes: z.array(z.string().min(1)).default([]),
    attributes: z.record(z.string(), z.unknown()).default({}),
    credentialId: z.string().min(1).max(256).optional(),
    sessionId: z.string().min(1).max(256).optional(),
    issuedAt: z.number().int().nonnegative().optional(),
    expiresAt: z.number().int().nonnegative().optional(),
    delegatedBy: z.string().min(1).max(256).optional(),
    delegationId: z.string().min(1).max(256).optional(),
  })
  .strict()
  .superRefine((context, issue) => {
    if (context.principalType === 'anonymous' && context.authMethod !== 'none') {
      issue.addIssue({
        code: 'custom',
        path: ['authMethod'],
        message: 'anonymous principals must use authMethod=none',
      });
    }

    if (context.issuedAt !== undefined && context.expiresAt !== undefined && context.expiresAt < context.issuedAt) {
      issue.addIssue({
        code: 'custom',
        path: ['expiresAt'],
        message: 'expiresAt must be greater than or equal to issuedAt',
      });
    }
  });

export type PrincipalContext = z.infer<typeof PrincipalContextSchema>;

export const AnonymousPrincipal: PrincipalContext = {
  principalId: 'anonymous',
  principalType: 'anonymous',
  authMethod: 'none',
  roles: [],
  scopes: [],
  attributes: {},
};

export function parsePrincipalContext(input: unknown): PrincipalContext {
  return PrincipalContextSchema.parse(input);
}
