import { getPool, sql } from './db.js';
import { chipLabel, parseIsoDate, relativeTime } from './dates.js';

export async function query(text, params = {}) {
    const pool = await getPool();
    const request = pool.request();
    for (const [key, value] of Object.entries(params)) {
        request.input(key, value);
    }
    return request.query(text);
}

export async function scalar(text, params = {}) {
    const result = await query(text, params);
    const first = result.recordset[0];
    return first ? Object.values(first)[0] : null;
}

export async function findUserByLogin(id) {
    const result = await query(
        `SELECT * FROM dbo.users
         WHERE LOWER(email) = LOWER(@id) OR phone = @id`,
        { id: String(id).trim() },
    );
    return result.recordset[0] ?? null;
}

export async function findUserById(id) {
    const result = await query(`SELECT * FROM dbo.users WHERE id = @id`, { id });
    return result.recordset[0] ?? null;
}

export async function findUserByPublicId(publicId) {
    const result = await query(`SELECT * FROM dbo.users WHERE public_id = @publicId`, { publicId });
    return result.recordset[0] ?? null;
}

export async function activePackage(userId) {
    const result = await query(
        `SELECT TOP 1 up.*, p.name AS package_name, p.hours AS catalog_hours
         FROM dbo.user_packages up
         JOIN dbo.packages p ON p.id = up.package_id
         WHERE up.user_id = @userId AND up.status = 'active' AND up.expires_at > SYSUTCDATETIME()
         ORDER BY up.created_at DESC`,
        { userId },
    );
    return result.recordset[0] ?? null;
}

export function packageStatusFromRow(row) {
    if (!row) {
        return { name: '—', hours: 0, used: 0, left: 0, expiresAt: '—' };
    }
    const expires = new Date(row.expires_at);
    return {
        name: row.package_name,
        hours: row.hours_total,
        used: row.hours_used,
        left: Math.max(0, row.hours_total - row.hours_used),
        expiresAt: `${expires.getDate()} ${['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'][expires.getMonth()]} ${expires.getFullYear()}`,
    };
}

export async function addNotification(userId, title, body, tone = 'blue') {
    await query(
        `INSERT INTO dbo.notifications (public_id, user_id, title, body, tone)
         VALUES (CONCAT('N', REPLACE(CONVERT(varchar(36), NEWID()), '-', '')), @userId, @title, @body, @tone)`,
        { userId, title, body, tone },
    );
}

export function mapNotification(row) {
    return {
        id: row.public_id,
        title: row.title,
        body: row.body,
        time: relativeTime(new Date(row.created_at)),
        read: Boolean(row.is_read),
        tone: row.tone,
    };
}

export function mapMoveRequest(row) {
    const statusMap = {
        pending: 'รออนุมัติ',
        approved: 'อนุมัติแล้ว',
        rejected: 'ปฏิเสธ',
    };
    return {
        id: row.public_id,
        student: `น้อง${row.nickname}`,
        from: row.from_text,
        to: row.to_text,
        at: relativeTime(new Date(row.created_at)),
        status: statusMap[row.status] ?? row.status,
        lessonId: row.booking_public_id,
        newDay: row.requested_iso,
        newTime: row.requested_time,
    };
}

export async function findSlot(dayIso, time, teacherId) {
    const result = await query(
        `SELECT id, teacher_id,
                CONVERT(varchar(10), slot_date, 23) AS slot_iso,
                CONVERT(varchar(5), slot_time, 108) AS slot_hhmm,
                status
         FROM dbo.teacher_availability
         WHERE teacher_id = @teacherId
           AND CONVERT(varchar(10), slot_date, 23) = @dayIso
           AND CONVERT(varchar(5), slot_time, 108) = @time`,
        { teacherId, dayIso, time },
    );
    return result.recordset[0] ?? null;
}

export async function defaultTeacherId() {
    const result = await query(`SELECT TOP 1 id FROM dbo.users WHERE role = 'teacher' ORDER BY id`);
    return result.recordset[0]?.id ?? null;
}

export function discountForVoucher(voucher, price) {
    if (voucher.type === 'percent') {
        const raw = Math.round(Number(price) * Number(voucher.value) / 100);
        const cap = voucher.max_discount == null ? raw : Number(voucher.max_discount);
        return Math.min(raw, cap);
    }
    return Number(voucher.value);
}

export function assertDayIso(day) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day))) {
        throw new Error('รูปแบบวันไม่ถูกต้อง');
    }
    return parseIsoDate(day);
}

export { sql, chipLabel };
