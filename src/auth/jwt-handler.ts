import jwt, { type JwtPayload } from 'jsonwebtoken';

const MIN_SECRET_LENGTH = 32;

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length < MIN_SECRET_LENGTH) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters');
  }
  return secret;
}

export function sign(payload: Record<string, unknown>): string {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: '1h', algorithm: 'HS256',
    ...(process.env.JWT_ISSUER ? { issuer: process.env.JWT_ISSUER } : {}),
    ...(process.env.JWT_AUDIENCE ? { audience: process.env.JWT_AUDIENCE } : {}),
  });
}

export function verify(token: string): JwtPayload {
  const verified = jwt.verify(token, getJwtSecret(), {
    algorithms: ['HS256'],
    ...(process.env.JWT_ISSUER ? { issuer: process.env.JWT_ISSUER } : {}),
    ...(process.env.JWT_AUDIENCE ? { audience: process.env.JWT_AUDIENCE } : {}),
  });
  if (typeof verified !== 'object' || verified === null) throw new Error('JWT payload must be an object');
  if (typeof verified.exp !== 'number' || !Number.isSafeInteger(verified.exp)) {
    throw new Error('JWT must have a finite expiration');
  }
  return verified;
}
