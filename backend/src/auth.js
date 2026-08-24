import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { pick } from './lang.js';
import { isYes } from './store.js';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

export function signUser(user) {
    return jwt.sign(
        { id: user.id, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' },
    );
}

export function optionalAuth(req, _res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
        next();
        return;
    }
    try {
        req.user = jwt.verify(token, JWT_SECRET);
    }
    catch {
        req.user = null;
    }
    next();
}

export function requireAuth(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
        res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
        return;
    }
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    }
    catch {
        res.status(401).json({ error: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' });
    }
}

export function requireRole(roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึง' });
            return;
        }
        next();
    };
}

export function toProfile(row) {
    const lang = row.language === 'en' ? 'en' : 'th';
    let genres = [];
    try {
        const raw = lang === 'en' && row.genres_en ? row.genres_en : row.genres;
        genres = raw ? JSON.parse(raw) : [];
    }
    catch {
        genres = [];
    }
    return {
        id: Number(row.id),
        name: row.name,
        nickname: row.nickname,
        age: row.age,
        education: pick(row, 'education', lang),
        genres,
        reason: pick(row, 'reason', lang),
        email: row.email,
        phone: row.phone || null,
        emergencyContact: row.emergency_contact || null,
        lineLinked: isYes(row.line_linked),
        role: row.role,
        language: lang,
        avatar: row.avatar || null,
    };
}

export function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
