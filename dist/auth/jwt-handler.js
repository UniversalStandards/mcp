import jwt from 'jsonwebtoken';
export function sign(payload) { return jwt.sign(payload, process.env.JWT_SECRET || 'dev', { expiresIn: '1h' }); }
export function verify(token) { return jwt.verify(token, process.env.JWT_SECRET || 'dev'); }
//# sourceMappingURL=jwt-handler.js.map