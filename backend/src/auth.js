import 'dotenv/config';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

export function signUser(user) {
    return jwt.sign(
        { id: user.id, publicId: user.public_id, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' },
    );
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
    let genres = [];
    try {
        genres = row.genres ? JSON.parse(row.genres) : [];
    }
    catch {
        genres = [];
    }
    return {
        id: row.public_id,
        name: row.name,
        nickname: row.nickname,
        age: row.age,
        education: row.education,
        genres,
        reason: row.reason,
        email: row.email,
        lineLinked: Boolean(row.line_linked),
        role: row.role,
        language: row.language === 'en' ? 'en' : 'th',
        avatar: row.avatar || null,
    };
}

export function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
