import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';

function signingSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters');
  }
  return secret;
}

export function sign(payload: Record<string, unknown>, options: SignOptions = { expiresIn: '1h' }): string {
  return jwt.sign(payload, signingSecret(), options);
}

export function verify(token: string): string | JwtPayload {
  return jwt.verify(token, signingSecret());
}
