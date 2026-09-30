import crypto from 'node:crypto';

const API_KEY_PREFIX = 'usk';
const API_KEY_SECRET_BYTES = 32;

export interface GeneratedApiKey {
  keyId: string;
  token: string;
  displayPrefix: string;
}

export function generateApiKey(environment: 'live' | 'test' = 'live'): GeneratedApiKey {
  const keyId = crypto.randomBytes(8).toString('hex');
  const secret = crypto.randomBytes(API_KEY_SECRET_BYTES).toString('base64url');
  const token = `${API_KEY_PREFIX}_${environment}_${keyId}_${secret}`;

  return {
    keyId,
    token,
    displayPrefix: `${API_KEY_PREFIX}_${environment}_${keyId}`,
  };
}

export function digestApiKey(token: string, pepper: string): string {
  if (!token || !pepper) throw new Error('token and pepper are required');
  return crypto.createHmac('sha256', pepper).update(token, 'utf8').digest('hex');
}

export function parseApiKey(token: string): { environment: 'live' | 'test'; keyId: string } | null {
  const match = /^(usk)_(live|test)_([a-f0-9]{16})_([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match) return null;
  return { environment: match[2] as 'live' | 'test', keyId: match[3] };
}

export function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}
