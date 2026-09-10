
import { getPool, sql } from './db.js';
import { parseIsoDate, toIsoDate } from './dates.js';
import { chipLabel, moveStatus, pick, relativeTime } from './lang.js';

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
        `SELECT TOP 1 up.*, p.name AS package_name, p.name_en AS package_name_en, p.hours AS catalog_hours
         FROM dbo.user_packages up
         JOIN dbo.packages p ON p.id = up.package_id
         WHERE up.user_id = @userId AND up.status = 'active' AND up.expires_at > SYSUTCDATETIME()
         ORDER BY up.created_at DESC`,
        { userId },
    );
    return result.recordset[0] ?? null;
}

export function packageStatusFromRow(row, lang = 'th') {
    if (!row) {
        return { name: '—', hours: 0, used: 0, left: 0, expiresAt: '—' };
    }
    const expires = new Date(row.expires_at);
    const monthsTh = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const months = lang === 'en' ? monthsEn : monthsTh;
    return {
        name: pick(row, 'package_name', lang),
        hours: row.hours_total,
        used: row.hours_used,
        left: Math.max(0, row.hours_total - row.hours_used),
        expiresAt: `${expires.getDate()} ${months[expires.getMonth()]} ${expires.getFullYear()}`,
    };
}

export async function addNotification(userId, title, body, tone = 'blue', titleEn = null, bodyEn = null) {
    await query(
        `INSERT INTO dbo.notifications (public_id, user_id, title, body, title_en, body_en, tone)
         VALUES (CONCAT('N', REPLACE(CONVERT(varchar(36), NEWID()), '-', '')), @userId, @title, @body, @titleEn, @bodyEn, @tone)`,
        { userId, title, body, titleEn, bodyEn, tone },
    );
}

export function mapNotification(row, lang = 'th') {
    return {
        id: row.public_id,
        title: pick(row, 'title', lang),
        body: pick(row, 'body', lang),
        time: relativeTime(new Date(row.created_at), lang),
        read: Boolean(row.is_read),
        tone: row.tone,
    };
}

export function mapMoveRequest(row, lang = 'th') {
    return {
        id: row.public_id,
        student: lang === 'en' ? row.nickname : `น้อง${row.nickname}`,
        from: pick(row, 'from_text', lang),
        to: pick(row, 'to_text', lang),
        at: relativeTime(new Date(row.created_at), lang),
        status: moveStatus(row.status, lang),
        statusKey: row.status,
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
    const result = await query(`SELECT TOP 1 id FROM dbo.users WHERE role = 'teacher' AND status = 'active' ORDER BY id`);
    return result.recordset[0]?.id ?? null;
}

export async function copyTeacherAvailability(fromTeacherId, toTeacherId) {
    if (!fromTeacherId || !toTeacherId || fromTeacherId === toTeacherId) {
        return;
    }
    await query(
        `INSERT INTO dbo.teacher_availability (teacher_id, slot_date, slot_time, duration_min, status)
         SELECT @toId, slot_date, slot_time, duration_min, N'open'
         FROM dbo.teacher_availability src
         WHERE src.teacher_id = @fromId
           AND src.slot_date >= CONVERT(date, GETDATE())
           AND NOT EXISTS (
             SELECT 1 FROM dbo.teacher_availability x
             WHERE x.teacher_id = @toId
               AND x.slot_date = src.slot_date
               AND x.slot_time = src.slot_time
           )`,
        { fromId: fromTeacherId, toId: toTeacherId },
    );
}

export async function seedOpenAvailability(teacherId, days = 21) {
    const times = ['10:00', '11:00', '13:00', '15:00', '17:00', '19:00'];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let offset = 0; offset < days; offset += 1) {
        const date = new Date(today);
        date.setDate(today.getDate() + offset);
        if (date.getDay() === 0) {
            continue;
        }
        for (const time of times) {
            await query(
                `IF NOT EXISTS (
                    SELECT 1 FROM dbo.teacher_availability
                    WHERE teacher_id = @teacherId
                      AND slot_date = @slotDate
                      AND CONVERT(varchar(5), slot_time, 108) = @time
                 )
                 INSERT INTO dbo.teacher_availability (teacher_id, slot_date, slot_time, status)
                 VALUES (@teacherId, @slotDate, @time, N'open')`,
                { teacherId, slotDate: toIsoDate(date), time },
            );
        }
    }
}

export async function ensureTeacherAvailability(teacherId) {
    const sourceTeacherId = await defaultTeacherId();
    if (sourceTeacherId && sourceTeacherId !== teacherId) {
        await copyTeacherAvailability(sourceTeacherId, teacherId);
    }
    const count = await scalar(
        `SELECT COUNT(*) AS n FROM dbo.teacher_availability WHERE teacher_id = @teacherId`,
        { teacherId },
    );
    if (!count) {
        await seedOpenAvailability(teacherId);
    }
}

export async function grantEnrollmentHours(userId) {
    const existing = await query(`SELECT id FROM dbo.packages WHERE id = N'trial'`);
    if (!existing.recordset[0]) {
        await query(
            `INSERT INTO dbo.packages (id, name, hours, price, note, tag, tone, name_en, note_en, tag_en, is_active)
             VALUES (N'trial', N'ทดลองเรียน 1 ชั่วโมง', 1, 0, N'ชั่วโมงทดลองหลังสมัครเรียน — จองคลาสแรกได้เลย', N'ทดลอง', N'pink',
                     N'Trial 1 hour', N'Complimentary trial hour after enrollment', N'Trial', 0)`,
        );
    }
    await query(
        `INSERT INTO dbo.user_packages (user_id, package_id, hours_total, hours_used, expires_at, status)
         VALUES (@userId, N'trial', 1, 0, DATEADD(month, 2, SYSUTCDATETIME()), N'active')`,
        { userId },
    );
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
