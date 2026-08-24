import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { decideLineCallback, lineProfileFromIdToken } from './lineIdentity.js';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const AUTHORIZE_URL = 'https://access.line.me/oauth2/v2.1/authorize';
const TOKEN_URL = 'https://api.line.me/oauth2/v2.1/token';
const VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify';
const PROFILE_URL = 'https://api.line.me/v2/profile';

export function getLineConfig(env = process.env) {
    const channelId = String(env.LINE_CHANNEL_ID || '').trim();
    const channelSecret = String(env.LINE_CHANNEL_SECRET || '').trim();
    const callbackUrl = String(env.LINE_CALLBACK_URL || '').trim()
        || 'https://kruair.thanvasupos.com/api/auth/line/callback';
    const frontendOrigin = String(env.FRONTEND_ORIGIN || 'https://kruair.thanvasupos.com').replace(/\/$/, '');
    const scopes = String(env.LINE_LOGIN_SCOPES || 'profile openid').trim();
    return {
        configured: Boolean(channelId && channelSecret),
        channelId,
        channelSecret,
        callbackUrl,
        frontendOrigin,
        scopes,
    };
}

export function isLineConfigured(env = process.env) {
    return getLineConfig(env).configured;
}

export function signLineState(payload) {
    return jwt.sign({ typ: 'line_oauth', ...payload }, JWT_SECRET, { expiresIn: '10m' });
}

export function verifyLineState(state) {
    try {
        const decoded = jwt.verify(String(state || ''), JWT_SECRET);
        if (decoded.typ !== 'line_oauth') {
            throw new Error('invalid line state');
        }
        return decoded;
    }
    catch {
        throw new Error('invalid line state');
    }
}

export function signLinePending(profile) {
    return jwt.sign(
        {
            typ: 'line_pending',
            sub: profile.lineUserId,
            name: profile.name,
            picture: profile.picture,
            email: profile.email,
        },
        JWT_SECRET,
        { expiresIn: '20m' },
    );
}

export function verifyLinePending(ticket) {
    try {
        const decoded = jwt.verify(String(ticket || ''), JWT_SECRET);
        if (decoded.typ !== 'line_pending' || !decoded.sub) {
            throw new Error('ลิงก์ LINE หมดอายุ กรุณาเชื่อมใหม่');
        }
        return decoded;
    }
    catch (err) {
        if (err instanceof Error && err.message.includes('ลิงก์ LINE')) {
            throw err;
        }
        throw new Error('ลิงก์ LINE หมดอายุ กรุณาเชื่อมใหม่');
    }
}

export function buildAuthorizeUrl(config, { state, nonce }) {
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: config.channelId,
        redirect_uri: config.callbackUrl,
        state,
        nonce,
    });
    return `${AUTHORIZE_URL}?${params.toString()}&scope=${encodeURIComponent(config.scopes)}`;
}

export function safeNextPath(raw, fallback = '/app') {
    const value = String(raw || '');
    if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) {
        return value;
    }
    return fallback;
}

export function frontendRedirectUrl(path, params = {}, env = process.env) {
    const config = getLineConfig(env);
    const url = new URL(path, `${config.frontendOrigin}/`);
    for (const [key, value] of Object.entries(params)) {
        if (value != null && value !== '') {
            url.searchParams.set(key, String(value));
        }
    }
    return url.toString();
}

export function createLineAuthorizeUrl({ intent, userId, role }) {
    const config = getLineConfig();
    if (!config.configured) {
        throw new Error('ยังไม่ได้ตั้งค่า LINE Login — ใส่ LINE_CHANNEL_ID และ LINE_CHANNEL_SECRET ใน backend/.env');
    }
    const nonce = randomBytes(16).toString('hex');
    const state = signLineState({
        intent: intent === 'link' ? 'link' : (intent === 'register' ? 'register' : 'login'),
        nonce,
        uid: userId ? Number(userId) : null,
        role: role || null,
    });
    return buildAuthorizeUrl(config, { state, nonce });
}

async function readJson(response) {
    const text = await response.text();
    try {
        return JSON.parse(text);
    }
    catch {
        return { error: text || `HTTP ${response.status}` };
    }
}

async function postForm(url, fields) {
    const body = new URLSearchParams(fields);
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });
    const data = await readJson(response);
    if (!response.ok) {
        throw new Error(data.error_description || data.error || `LINE HTTP ${response.status}`);
    }
    return data;
}

export async function exchangeLineCode(code, env = process.env) {
    const config = getLineConfig(env);
    return postForm(TOKEN_URL, {
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.callbackUrl,
        client_id: config.channelId,
        client_secret: config.channelSecret,
    });
}

export async function verifyLineIdToken(idToken, nonce, env = process.env) {
    const config = getLineConfig(env);
    const fields = {
        id_token: idToken,
        client_id: config.channelId,
    };
    if (nonce) {
        fields.nonce = nonce;
    }
    return postForm(VERIFY_URL, fields);
}

export async function fetchLineProfile(accessToken) {
    const response = await fetch(PROFILE_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await readJson(response);
    if (!response.ok) {
        throw new Error(data.error_description || data.message || `LINE HTTP ${response.status}`);
    }
    return data;
}

export async function loadLineProfile({ code, state }) {
    const session = verifyLineState(state);
    const token = await exchangeLineCode(code);
    let idPayload = {};
    if (token.id_token) {
        idPayload = await verifyLineIdToken(token.id_token, session.nonce);
    }
    let profile = lineProfileFromIdToken(idPayload);
    if (!profile.lineUserId || !profile.name) {
        const fallback = await fetchLineProfile(token.access_token);
        profile = {
            lineUserId: profile.lineUserId || String(fallback.userId || '').trim(),
            email: profile.email,
            name: profile.name || String(fallback.displayName || '').trim() || null,
            picture: profile.picture || String(fallback.pictureUrl || '').trim() || null,
        };
    }
    if (!profile.lineUserId) {
        throw new Error('LINE ไม่ส่งรหัสผู้ใช้มา');
    }
    return { session, profile };
}

export function resolveLineCallbackDecision({ session, profile, existingByLine, existingByEmail }) {
    return decideLineCallback({
        intent: session.intent,
        currentUserId: session.uid,
        existingByLine,
        existingByEmail,
        email: profile.email,
    });
}
