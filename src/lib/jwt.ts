import jwt, { JwtPayload, SignOptions, Secret } from 'jsonwebtoken';

const JWT_SECRET = (process.env.JWT_SECRET || 'change_me') as Secret;
const ACCESS_TTL: SignOptions['expiresIn'] = (process.env.JWT_ACCESS_TTL || '15m') as any;
const REFRESH_TTL: SignOptions['expiresIn'] = (process.env.JWT_REFRESH_TTL || '7d') as any;

export type AccessPayload = { sub: string; email: string };
export type RefreshPayload = AccessPayload & { type: 'refresh' };

export function signAccess(p: AccessPayload) {
    return jwt.sign(p, JWT_SECRET, { expiresIn: ACCESS_TTL });
}

export function signRefresh(p: AccessPayload) {
    const payload: RefreshPayload = { ...p, type: 'refresh' };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TTL });
}

export function verify(token: string) {
    return jwt.verify(token, JWT_SECRET) as JwtPayload | RefreshPayload;
}