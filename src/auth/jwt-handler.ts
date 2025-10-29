import jwt from 'jsonwebtoken';
export function sign(payload: any) { return jwt.sign(payload, process.env.JWT_SECRET || 'dev', { expiresIn: '1h' }); }
export function verify(token: string) { return jwt.verify(token, process.env.JWT_SECRET || 'dev'); }
