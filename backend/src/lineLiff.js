import { decideLineCallback, lineProfileFromIdToken } from './lineIdentity.js';
import { verifyLineIdToken } from './lineLogin.js';

export function getLiffConfig(env = process.env) {
    const liffId = String(env.LIFF_ID || '').trim();
    const frontendOrigin = String(env.FRONTEND_ORIGIN || 'http://localhost:5173').replace(/\/$/, '');
    return {
        configured: Boolean(liffId),
        liffId,
        frontendOrigin,
    };
}

export function isLiffConfigured(env = process.env) {
    return getLiffConfig(env).configured;
}

export function liffUrl(path = '/', env = process.env) {
    const { liffId } = getLiffConfig(env);
    if (!liffId) {
        return null;
    }
    const clean = String(path || '/').replace(/^\//, '');
    return `https://liff.line.me/${liffId}/${clean}`;
}

export async function authenticateLiffIdToken(idToken, env = process.env) {
    const token = String(idToken || '').trim();
    if (!token) {
        throw new Error('ไม่พบ LINE ID token');
    }
    const payload = await verifyLineIdToken(token, null, env);
    const profile = lineProfileFromIdToken(payload);
    if (!profile.lineUserId) {
        throw new Error('LINE ไม่ส่งรหัสผู้ใช้มา');
    }
    return { profile, payload };
}

export function resolveLiffAuthDecision({ profile, existingByLine, existingByEmail }) {
    return decideLineCallback({
        intent: 'login',
        currentUserId: null,
        existingByLine,
        existingByEmail,
        email: profile.email,
    });
}
