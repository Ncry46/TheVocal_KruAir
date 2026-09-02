import { getPool, sql } from './db.js';
import { confirmDeadlineAt, isAllowedSlotTime, nextSlotStatus, SLOT_TIMES, slotStartAt } from './bookingPolicy.js';
import { parseIsoDate, toIsoDate } from './dates.js';
import { chipLabel, educationEn, formatDate, genresEn, methodEn, moveStatus, pick, relativeTime } from './lang.js';
import { isYes, toYn } from './yn.js';
import { formatLineNotifyMessage, findLineUserIdForAppUser, pushLineText } from './lineMessaging.js';
import { isHomeworkNote, packageHoursLeft, shouldNotifyLowHours } from './packagePolicy.js';

export async function query(text, params = {}) {
    const pool = await getPool();
    const request = pool.request();
    for (const [key, value] of Object.entries(params)) {
        request.input(key, value);
    }
    return request.query(text);
}

export async function withTransaction(work) {
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    const run = async (text, params = {}) => {
        const request = new sql.Request(tx);
        for (const [key, value] of Object.entries(params)) {
            request.input(key, value);
        }
        return request.query(text);
    };
    try {
        const result = await work(run);
        await tx.commit();
        return result;
    }
    catch (err) {
        try {
            await tx.rollback();
        }
        catch {
            /* already rolled back */
        }
        throw err;
    }
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

export async function findUserByLineUserId(lineUserId) {
    const result = await query(
        `SELECT u.*
         FROM dbo.users u
         JOIN dbo.line_links l ON l.user_id = u.id
         WHERE l.line_user_id = @lineUserId`,
        { lineUserId: String(lineUserId || '').trim() },
    );
    return result.recordset[0] ?? null;
}

export async function findLineLinkByUserId(userId) {
    const result = await query(
        `SELECT * FROM dbo.line_links WHERE user_id = @userId`,
        { userId },
    );
    return result.recordset[0] ?? null;
}

export async function linkLineAccount(userId, profile) {
    const lineUserId = String(profile?.lineUserId || '').trim();
    if (!lineUserId) {
        throw new Error('ไม่พบรหัสผู้ใช้ LINE');
    }
    const existingLine = await findUserByLineUserId(lineUserId);
    if (existingLine && Number(existingLine.id) !== Number(userId)) {
        throw new Error('บัญชี LINE นี้ถูกผูกกับผู้ใช้อื่นแล้ว');
    }
    const existingUserLink = await findLineLinkByUserId(userId);
    if (existingUserLink && existingUserLink.line_user_id !== lineUserId) {
        throw new Error('บัญชีนี้ผูก LINE ไว้แล้ว');
    }
    const displayName = String(profile.name || '').slice(0, 100) || null;
    const pictureUrl = String(profile.picture || '').slice(0, 500) || null;
    if (!existingUserLink) {
        await query(
            `INSERT INTO dbo.line_links (user_id, line_user_id, display_name, picture_url)
             VALUES (@userId, @lineUserId, @displayName, @pictureUrl)`,
            {
                userId,
                lineUserId,
                displayName,
                pictureUrl,
            },
        );
    }
    else {
        await query(
            `UPDATE dbo.line_links
             SET display_name = @displayName, picture_url = @pictureUrl
             WHERE user_id = @userId`,
            {
                userId,
                displayName,
                pictureUrl,
            },
        );
    }
    const user = await findUserById(userId);
    const currentAvatar = String(user?.avatar || '');
    const nextAvatar = profile.picture && (!currentAvatar || currentAvatar.startsWith('/img/'))
        ? String(profile.picture).slice(0, 500)
        : (user?.avatar ?? null);
    await query(
        `UPDATE dbo.users
         SET line_linked = N'Y', avatar = @avatar, updated_at = SYSUTCDATETIME()
         WHERE id = @userId`,
        { userId, avatar: nextAvatar },
    );
    return findUserById(userId);
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

export async function addNotification(userId, title, body, tone = 'blue', titleEn = null, bodyEn = null, linkPath = null, options = {}) {
    const { skipLinePush = false } = options;
    await query(
        `INSERT INTO dbo.notifications (public_id, user_id, title, body, title_en, body_en, tone, link_path)
         VALUES (CONCAT('N', REPLACE(CONVERT(varchar(36), NEWID()), '-', '')), @userId, @title, @body, @titleEn, @bodyEn, @tone, @linkPath)`,
        { userId, title, body, titleEn, bodyEn, tone, linkPath },
    );
    if (skipLinePush) {
        return;
    }
    try {
        const lineUserId = await findLineUserIdForAppUser(userId, query);
        if (lineUserId) {
            await pushLineText(lineUserId, formatLineNotifyMessage(title, body));
        }
    }
    catch (err) {
        console.error('LINE OA push failed:', err instanceof Error ? err.message : err);
    }
}

export async function maybeNotifyPackageHours(userId, userPackageId, previousLeft, newLeft) {
    if (!userPackageId || !shouldNotifyLowHours(previousLeft, newLeft)) {
        return false;
    }
    const left = Math.max(0, Number(newLeft));
    if (left === 0) {
        await addNotification(
            userId,
            'ชั่วโมงเรียนหมดแล้ว',
            'ชั่วโมงในคอร์สหมดแล้ว — ติดต่อครูแอร์หรือซื้อแพ็กเกจเพื่อเรียนต่อ',
            'pink',
            'Course hours used up',
            'Your course hours are used up — contact Kru Air or buy a package to continue.',
        );
    }
    else {
        await addNotification(
            userId,
            'ชั่วโมงเรียนใกล้หมด',
            `เหลืออีก ${left} ชม. — ติดต่อครูแอร์เพื่อต่อคอร์สหรือซื้อแพ็กเกจ`,
            'pink',
            'Course hours running low',
            `${left} hour(s) left — contact Kru Air to renew or buy a package.`,
        );
    }
    await query(
        `UPDATE dbo.user_packages SET low_hours_notified_at = SYSUTCDATETIME() WHERE id = @pkgId`,
        { pkgId: userPackageId },
    );
    return true;
}

export async function notifyHomeworkAssigned(userId, note, hasAudio = false) {
    if (!isHomeworkNote(note)) {
        return false;
    }
    const trimmed = String(note).trim();
    const bodyTh = hasAudio
        ? `${trimmed.slice(0, 400)}\nมีเสียงตอบกลับจากครูในแอป`
        : trimmed.slice(0, 500);
    const bodyEn = hasAudio
        ? `${trimmed.slice(0, 400)}\nVoice feedback is available in the app.`
        : trimmed.slice(0, 500);
    await addNotification(
        userId,
        'มีการบ้านใหม่',
        bodyTh,
        'blue',
        'New homework',
        bodyEn,
    );
    return true;
}

export async function notifySlotTeacher(slotId, title, body, tone = 'blue', titleEn = null, bodyEn = null) {
    if (!slotId) {
        return;
    }
    const result = await query(
        `SELECT s.teacher_id
         FROM dbo.teacher_availability s
         JOIN dbo.users u ON u.id = s.teacher_id
         WHERE s.id = @slotId AND u.role IN (N'teacher', N'admin') AND u.status = N'Y'`,
        { slotId },
    );
    const teacherId = result.recordset[0]?.teacher_id;
    if (!teacherId) {
        return;
    }
    await addNotification(teacherId, title, body, tone, titleEn, bodyEn);
}

export function studentLabel(user, lang = 'th') {
    const nickname = pick(user, 'nickname', lang) || pick(user, 'name', lang) || (lang === 'en' ? 'student' : 'นักเรียน');
    return lang === 'en' ? nickname : `น้อง${nickname}`;
}

export function mapNotification(row, lang = 'th') {
    return {
        id: row.public_id,
        title: pick(row, 'title', lang),
        body: pick(row, 'body', lang),
        time: relativeTime(new Date(row.created_at), lang),
        read: isYes(row.is_read),
        tone: row.tone,
        link: row.link_path || null,
    };
}

export function mapMoveRequest(row, lang = 'th') {
    const nickname = pick(row, 'nickname', lang);
    return {
        id: row.public_id,
        student: lang === 'en' ? nickname : `น้อง${nickname}`,
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
    const result = await query(`SELECT TOP 1 id FROM dbo.users WHERE role = 'teacher' AND status = N'Y' ORDER BY id`);
    return result.recordset[0]?.id ?? null;
}

export async function listActiveTeachers() {
    const result = await query(
        `SELECT id, name, name_en, nickname, nickname_en, avatar
         FROM dbo.users
         WHERE role = N'teacher' AND status = N'Y'
         ORDER BY id`,
    );
    return result.recordset;
}

export async function resolveStudentTeacherId(userId, teacherIdInput = null) {
    if (teacherIdInput) {
        const teacher = await query(
            `SELECT id FROM dbo.users WHERE id = @id AND role = N'teacher' AND status = N'Y'`,
            { id: Number(teacherIdInput) },
        );
        if (teacher.recordset[0]) {
            return teacher.recordset[0].id;
        }
    }
    const user = await query(`SELECT primary_teacher_id FROM dbo.users WHERE id = @id`, { id: userId });
    if (user.recordset[0]?.primary_teacher_id) {
        return user.recordset[0].primary_teacher_id;
    }
    return defaultTeacherId();
}

export async function teacherDisplayLabel(teacherId, lang = 'th') {
    const result = await query(
        `SELECT nickname, nickname_en, name, name_en FROM dbo.users WHERE id = @id`,
        { id: teacherId },
    );
    const row = result.recordset[0];
    if (!row) {
        return lang === 'en' ? 'Teacher (live 1:1)' : 'ครู (เรียนสด 1:1)';
    }
    const nickname = pick(row, 'nickname', lang);
    const name = pick(row, 'name', lang);
    return lang === 'en'
        ? `${nickname} (${name}) · live 1:1`
        : `${nickname} (${name}) · เรียนสด 1:1`;
}

export async function listTeacherDayLessons(teacherId, dayIso) {
    const result = await query(
        `SELECT b.public_id AS booking_id, b.status AS booking_status, b.topic, b.topic_en,
                COALESCE(b.duration_hours, 1) AS duration_hours,
                CONVERT(varchar(10), s.slot_date, 23) AS slot_iso,
                CONVERT(varchar(5), s.slot_time, 108) AS slot_hhmm,
                u.nickname, u.nickname_en, u.name, u.name_en, u.id AS student_id
         FROM dbo.bookings b
         JOIN dbo.teacher_availability s ON s.id = b.slot_id
         JOIN dbo.users u ON u.id = b.user_id
         WHERE s.teacher_id = @teacherId
           AND CONVERT(varchar(10), s.slot_date, 23) = @dayIso
           AND b.status IN (N'pending', N'confirmed', N'moved')
           AND b.slot_id = s.id
         ORDER BY s.slot_time`,
        { teacherId, dayIso },
    );
    return result.recordset;
}

export async function getStudentProfileForTeacher(studentId) {
    const userResult = await query(
        `SELECT u.*, pt.nickname AS teacher_nickname, pt.nickname_en AS teacher_nickname_en,
                pt.name AS teacher_name, pt.name_en AS teacher_name_en
         FROM dbo.users u
         LEFT JOIN dbo.users pt ON pt.id = u.primary_teacher_id
         WHERE u.id = @id AND u.role = N'student'`,
        { id: studentId },
    );
    const user = userResult.recordset[0];
    if (!user) {
        return null;
    }
    const pkg = await activePackage(studentId);
    const logs = await query(
        `SELECT TOP 12 cl.lesson_title, cl.lesson_title_en, cl.note, cl.note_en, cl.outcome, cl.hours_deducted,
                cl.created_at, cl.student_signature, cl.signed_at,
                b.public_id AS booking_id,
                CONVERT(varchar(10), s.slot_date, 23) AS slot_iso,
                CONVERT(varchar(5), s.slot_time, 108) AS slot_hhmm
         FROM dbo.class_logs cl
         JOIN dbo.bookings b ON b.id = cl.booking_id
         JOIN dbo.teacher_availability s ON s.id = b.slot_id
         WHERE cl.user_id = @userId
         ORDER BY cl.created_at DESC`,
        { userId: studentId },
    );
    const upcoming = await query(
        `SELECT TOP 5 b.public_id, b.status, b.topic, b.topic_en,
                CONVERT(varchar(10), s.slot_date, 23) AS slot_iso,
                CONVERT(varchar(5), s.slot_time, 108) AS slot_hhmm
         FROM dbo.bookings b
         JOIN dbo.teacher_availability s ON s.id = b.slot_id
         WHERE b.user_id = @userId AND b.status IN (N'pending', N'confirmed', N'moved')
         ORDER BY s.slot_date, s.slot_time`,
        { userId: studentId },
    );
    return { user, pkg, logs: logs.recordset, upcoming: upcoming.recordset };
}

export async function rescheduleTeacherBooking({ bookingPublicId, teacherId, newDayIso, newTime }) {
    assertDayIso(newDayIso);
    return withTransaction(async (run) => {
        const found = await run(
            `SELECT b.id, b.public_id, b.user_id, b.slot_id, b.status, b.duration_hours,
                    s.teacher_id,
                    CONVERT(varchar(10), s.slot_date, 23) AS slot_iso,
                    CONVERT(varchar(5), s.slot_time, 108) AS slot_hhmm
             FROM dbo.bookings b
             JOIN dbo.teacher_availability s ON s.id = b.slot_id
             WHERE b.public_id = @id AND b.status IN (N'pending', N'confirmed', N'moved')`,
            { id: bookingPublicId },
        );
        const booking = found.recordset[0];
        if (!booking) {
            throw new Error('ไม่พบนัดที่เลือก');
        }
        if (Number(booking.teacher_id) !== Number(teacherId)) {
            throw new Error('นัดนี้ไม่ใช่ของครูที่เลือก');
        }
        const slotResult = await run(
            `SELECT id, status FROM dbo.teacher_availability
             WHERE teacher_id = @teacherId
               AND CONVERT(varchar(10), slot_date, 23) = @dayIso
               AND CONVERT(varchar(5), slot_time, 108) = @time`,
            { teacherId, dayIso: newDayIso, time: newTime },
        );
        const newSlot = slotResult.recordset[0];
        if (!newSlot || newSlot.status !== 'open') {
            throw new Error('สล็อตใหม่ไม่ว่าง');
        }
        const linked = await run(`SELECT slot_id FROM dbo.booking_slots WHERE booking_id = @id`, { id: booking.id });
        const oldSlotIds = linked.recordset.length
            ? linked.recordset.map((row) => row.slot_id)
            : [booking.slot_id];
        for (const slotId of oldSlotIds) {
            await run(`UPDATE dbo.teacher_availability SET status = N'open' WHERE id = @slotId`, { slotId });
        }
        await run(`DELETE FROM dbo.booking_slots WHERE booking_id = @id`, { id: booking.id });
        await run(
            `UPDATE dbo.teacher_availability SET status = N'booked' WHERE id = @slotId;
             UPDATE dbo.bookings SET slot_id = @slotId, status = N'confirmed', confirmed_at = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME() WHERE id = @bookingId;
             INSERT INTO dbo.booking_slots (booking_id, slot_id) VALUES (@bookingId, @slotId);`,
            { slotId: newSlot.id, bookingId: booking.id },
        );
        return {
            bookingId: booking.public_id,
            userId: booking.user_id,
            fromIso: booking.slot_iso,
            fromTime: booking.slot_hhmm,
            toIso: newDayIso,
            toTime: newTime,
        };
    });
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

async function dropUsersPublicId() {
    await query(`
        IF COL_LENGTH(N'dbo.users', N'public_id') IS NOT NULL
        BEGIN
            DECLARE @uq SYSNAME;
            SELECT TOP 1 @uq = i.name
            FROM sys.indexes i
            INNER JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
            INNER JOIN sys.columns c ON c.object_id = i.object_id AND c.column_id = ic.column_id
            WHERE i.object_id = OBJECT_ID(N'dbo.users')
              AND c.name = N'public_id'
              AND i.is_unique = 1
              AND i.is_primary_key = 0;
            IF @uq IS NOT NULL
            BEGIN
                IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = @uq)
                    EXEC(N'ALTER TABLE dbo.users DROP CONSTRAINT [' + @uq + N']');
                ELSE
                    EXEC(N'DROP INDEX [' + @uq + N'] ON dbo.users');
            END
            ALTER TABLE dbo.users DROP COLUMN public_id;
        END`);
}

async function convertBitFlagToYn(table, column, defaultYn) {
    const typeResult = await query(`
        SELECT t.name AS type_name
        FROM sys.columns c
        INNER JOIN sys.types t ON t.user_type_id = c.user_type_id
        WHERE c.object_id = OBJECT_ID(N'dbo.${table}')
          AND c.name = N'${column}'`);
    if (typeResult.recordset[0]?.type_name !== 'bit') {
        return;
    }
    await query(`
        DECLARE @df SYSNAME;
        SELECT @df = dc.name
        FROM sys.default_constraints dc
        INNER JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID(N'dbo.${table}') AND c.name = N'${column}';
        IF @df IS NOT NULL EXEC(N'ALTER TABLE dbo.${table} DROP CONSTRAINT [' + @df + N']')`);
    await query(`ALTER TABLE dbo.${table} ADD ${column}_yn CHAR(1) NULL`);
    await query(`UPDATE dbo.${table} SET ${column}_yn = CASE WHEN ${column} = 1 THEN 'Y' ELSE 'N' END`);
    await query(`ALTER TABLE dbo.${table} ALTER COLUMN ${column}_yn CHAR(1) NOT NULL`);
    await query(`
        IF NOT EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = N'DF_${table}_${column}_yn')
            ALTER TABLE dbo.${table} ADD CONSTRAINT DF_${table}_${column}_yn DEFAULT '${defaultYn}' FOR ${column}_yn`);
    await query(`ALTER TABLE dbo.${table} DROP COLUMN ${column}`);
    await query(`EXEC sp_rename N'dbo.${table}.${column}_yn', N'${column}', N'COLUMN'`);
}

async function convertUsersStatusToYn() {
    const typeResult = await query(`
        SELECT t.name AS type_name, c.max_length
        FROM sys.columns c
        INNER JOIN sys.types t ON t.user_type_id = c.user_type_id
        WHERE c.object_id = OBJECT_ID(N'dbo.users') AND c.name = N'status'`);
    const columnType = typeResult.recordset[0];
    if (!columnType || (columnType.type_name === 'char' && Number(columnType.max_length) === 1)) {
        return;
    }
    await query(`
        DECLARE @df SYSNAME;
        SELECT @df = dc.name
        FROM sys.default_constraints dc
        INNER JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID(N'dbo.users') AND c.name = N'status';
        IF @df IS NOT NULL EXEC(N'ALTER TABLE dbo.users DROP CONSTRAINT [' + @df + N']')`);
    await query(`ALTER TABLE dbo.users ADD status_yn CHAR(1) NULL`);
    await query(`
        UPDATE dbo.users SET status_yn = CASE
            WHEN status IN (N'Y', N'y', N'active', N'1') THEN N'Y'
            ELSE N'N'
        END`);
    await query(`ALTER TABLE dbo.users ALTER COLUMN status_yn CHAR(1) NOT NULL`);
    await query(`
        IF NOT EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = N'DF_users_status_yn')
            ALTER TABLE dbo.users ADD CONSTRAINT DF_users_status_yn DEFAULT N'Y' FOR status_yn`);
    await query(`ALTER TABLE dbo.users DROP COLUMN status`);
    await query(`EXEC sp_rename N'dbo.users.status_yn', N'status', N'COLUMN'`);
}

export { isYes, toYn };

async function ensureColumn(table, column, ddl) {
    await query(`
        IF COL_LENGTH(N'dbo.${table}', N'${column}') IS NULL
            ALTER TABLE dbo.${table} ADD ${ddl}`);
}

export function normalizePhone(raw) {
    let value = String(raw ?? '').trim().replace(/[^\d+]/g, '');
    if (value.startsWith('+66')) {
        value = `0${value.slice(3)}`;
    }
    else if (value.startsWith('66') && value.length >= 11) {
        value = `0${value.slice(2)}`;
    }
    return value;
}

export function assertStudentPhone(raw) {
    const phone = normalizePhone(raw);
    if (!/^0\d{8,9}$/.test(phone)) {
        throw new Error('กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง');
    }
    return phone;
}

export function gatewayFromMethod(method) {
    const value = String(method ?? '');
    const lower = value.toLowerCase();
    if (lower.includes('kbank')) {
        return 'kbank';
    }
    if (value.includes('พร้อม') || lower.includes('prompt')) {
        return 'promptpay';
    }
    if (value.includes('บัตร') || lower.includes('card')) {
        return 'card';
    }
    return 'mock';
}

export async function ensureEnrollmentSchema() {
    await query(`
        IF OBJECT_ID(N'dbo.enrollments', N'U') IS NULL
        CREATE TABLE dbo.enrollments (
            id INT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
            public_id NVARCHAR(40) NOT NULL UNIQUE,
            user_id INT NOT NULL,
            package_id NVARCHAR(20) NOT NULL,
            hours_granted INT NOT NULL,
            status NVARCHAR(20) NOT NULL CONSTRAINT DF_enrollments_status DEFAULT N'active',
            source NVARCHAR(20) NOT NULL CONSTRAINT DF_enrollments_source DEFAULT N'web',
            created_at DATETIME2 NOT NULL CONSTRAINT DF_enrollments_created DEFAULT SYSUTCDATETIME()
        )`);
    await query(`
        IF OBJECT_ID(N'dbo.payments', N'U') IS NULL
        CREATE TABLE dbo.payments (
            id INT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
            public_id NVARCHAR(40) NOT NULL UNIQUE,
            transaction_id INT NOT NULL,
            payment_ref NVARCHAR(80) NULL,
            gateway NVARCHAR(40) NOT NULL,
            method NVARCHAR(80) NOT NULL,
            gateway_status NVARCHAR(20) NOT NULL CONSTRAINT DF_payments_status DEFAULT N'pending',
            raw_webhook NVARCHAR(MAX) NULL,
            paid_at DATETIME2 NULL,
            created_at DATETIME2 NOT NULL CONSTRAINT DF_payments_created DEFAULT SYSUTCDATETIME()
        )`);
    await ensureColumn('users', 'emergency_contact', 'emergency_contact NVARCHAR(120) NULL');
    await ensureColumn('enrollments', 'source', "source NVARCHAR(20) NOT NULL CONSTRAINT DF_enrollments_source DEFAULT N'web'");
    await ensureColumn('bookings', 'source', "source NVARCHAR(20) NOT NULL CONSTRAINT DF_bookings_source DEFAULT N'web'");
    await ensureColumn('bookings', 'mode', "mode NVARCHAR(20) NOT NULL CONSTRAINT DF_bookings_mode DEFAULT N'studio'");
    await ensureColumn('bookings', 'confirm_deadline', 'confirm_deadline DATETIME2 NULL');
    await ensureColumn('bookings', 'cancelled_at', 'cancelled_at DATETIME2 NULL');
    await ensureColumn('bookings', 'cancel_reason', 'cancel_reason NVARCHAR(200) NULL');
    await ensureColumn('bookings', 'reminder_sent_at', 'reminder_sent_at DATETIME2 NULL');
    await ensureColumn('bookings', 'updated_at', 'updated_at DATETIME2 NOT NULL CONSTRAINT DF_bookings_updated DEFAULT SYSUTCDATETIME()');
    await ensureColumn('class_logs', 'feedback_audio_url', 'feedback_audio_url NVARCHAR(500) NULL');
    await ensureColumn('class_logs', 'student_audio_url', 'student_audio_url NVARCHAR(500) NULL');
    await ensureColumn('class_logs', 'student_signature', 'student_signature NVARCHAR(MAX) NULL');
    await ensureColumn('class_logs', 'signed_at', 'signed_at DATETIME2 NULL');
    await ensureColumn('class_logs', 'hours_charged_at', 'hours_charged_at DATETIME2 NULL');
    await ensureColumn('user_packages', 'low_hours_notified_at', 'low_hours_notified_at DATETIME2 NULL');
    await ensureColumn('user_packages', 'expiry_notified_at', 'expiry_notified_at DATETIME2 NULL');
    await ensureColumn('users', 'birth_date', 'birth_date DATE NULL');
    await ensureColumn('users', 'singing_experience', 'singing_experience NVARCHAR(200) NULL');
    await ensureColumn('users', 'instruments', 'instruments NVARCHAR(MAX) NULL');
    await ensureColumn('users', 'goals', 'goals NVARCHAR(MAX) NULL');
    await ensureColumn('users', 'address_street', 'address_street NVARCHAR(200) NULL');
    await ensureColumn('users', 'address_district', 'address_district NVARCHAR(100) NULL');
    await ensureColumn('users', 'address_province', 'address_province NVARCHAR(100) NULL');
    await ensureColumn('users', 'primary_teacher_id', 'primary_teacher_id INT NULL');
    await ensureColumn('bookings', 'google_event_id', 'google_event_id NVARCHAR(200) NULL');
    await ensureColumn('bookings', 'google_student_event_id', 'google_student_event_id NVARCHAR(200) NULL');
    await ensureColumn('users', 'name_en', 'name_en NVARCHAR(100) NULL');
    await ensureColumn('users', 'nickname_en', 'nickname_en NVARCHAR(50) NULL');
    await ensureColumn('users', 'education_en', 'education_en NVARCHAR(100) NULL');
    await ensureColumn('users', 'reason_en', 'reason_en NVARCHAR(MAX) NULL');
    await ensureColumn('users', 'genres_en', 'genres_en NVARCHAR(MAX) NULL');
    await ensureColumn('transactions', 'method_en', 'method_en NVARCHAR(80) NULL');
    await ensureColumn('payments', 'method_en', 'method_en NVARCHAR(80) NULL');
    await dropUsersPublicId();
    await ensureColumn('notifications', 'link_path', 'link_path NVARCHAR(300) NULL');
    await convertBitFlagToYn('notifications', 'is_read', 'N');
    await convertBitFlagToYn('vouchers', 'is_active', 'Y');
    await convertBitFlagToYn('packages', 'is_active', 'Y');
    await convertBitFlagToYn('users', 'line_linked', 'N');
    await convertUsersStatusToYn();
    await query(`
        IF COL_LENGTH(N'dbo.users', N'avatar') IS NOT NULL
            ALTER TABLE dbo.users ALTER COLUMN avatar NVARCHAR(500) NULL`);
    await query(`
        IF OBJECT_ID(N'dbo.line_links', N'U') IS NULL
        CREATE TABLE dbo.line_links (
            id INT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
            user_id INT NOT NULL,
            line_user_id NVARCHAR(64) NOT NULL,
            display_name NVARCHAR(100) NULL,
            picture_url NVARCHAR(500) NULL,
            linked_at DATETIME2 NOT NULL CONSTRAINT DF_line_links_at DEFAULT SYSUTCDATETIME(),
            CONSTRAINT UX_line_links_user UNIQUE (user_id),
            CONSTRAINT UX_line_links_line UNIQUE (line_user_id),
            CONSTRAINT FK_line_links_user FOREIGN KEY (user_id) REFERENCES dbo.users (id)
        )`);
    await query(`
        IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_payments_tx')
            ALTER TABLE dbo.payments ADD CONSTRAINT FK_payments_tx FOREIGN KEY (transaction_id) REFERENCES dbo.transactions (id)`);
    await query(`
        IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_user_packages_tx')
            ALTER TABLE dbo.user_packages ADD CONSTRAINT FK_user_packages_tx FOREIGN KEY (transaction_id) REFERENCES dbo.transactions (id)`);
    await query(`
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_payments_transaction' AND object_id = OBJECT_ID(N'dbo.payments'))
            CREATE UNIQUE INDEX UX_payments_transaction ON dbo.payments (transaction_id)`);
    await query(`UPDATE dbo.users SET phone = NULL WHERE phone = N''`);
    await query(`
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_users_phone' AND object_id = OBJECT_ID(N'dbo.users'))
            CREATE UNIQUE INDEX UX_users_phone ON dbo.users (phone) WHERE phone IS NOT NULL`);
    await query(`
        UPDATE dbo.enrollments SET source = N'trial' WHERE package_id = N'trial' AND (source IS NULL OR source = N'web')`);
    await ensureActiveBookingSlotIndex();
    await query(`
        IF OBJECT_ID(N'dbo.google_calendar_connections', N'U') IS NULL
        CREATE TABLE dbo.google_calendar_connections (
            user_id INT NOT NULL PRIMARY KEY,
            access_token NVARCHAR(MAX) NOT NULL,
            refresh_token NVARCHAR(MAX) NULL,
            expires_at DATETIME2 NULL,
            calendar_id NVARCHAR(200) NOT NULL CONSTRAINT DF_gcal_calendar DEFAULT N'primary',
            connected_at DATETIME2 NOT NULL CONSTRAINT DF_gcal_connected DEFAULT SYSUTCDATETIME()
        )`);
    await query(`
        UPDATE dbo.class_logs
        SET hours_charged_at = created_at
        WHERE hours_deducted > 0 AND hours_charged_at IS NULL`);
    await query(`
        UPDATE b
        SET confirm_deadline = CASE
            WHEN DATEADD(hour, -24, DATETIMEFROMPARTS(
                YEAR(s.slot_date), MONTH(s.slot_date), DAY(s.slot_date),
                DATEPART(hour, s.slot_time), DATEPART(minute, s.slot_time), 0, 0
            )) > b.created_at
            THEN DATEADD(hour, -24, DATETIMEFROMPARTS(
                YEAR(s.slot_date), MONTH(s.slot_date), DAY(s.slot_date),
                DATEPART(hour, s.slot_time), DATEPART(minute, s.slot_time), 0, 0
            ))
            ELSE DATEADD(hour, 2, b.created_at)
        END
        FROM dbo.bookings b
        JOIN dbo.teacher_availability s ON s.id = b.slot_id
        WHERE b.status = N'pending'`);
    await query(`
        UPDATE dbo.user_packages
        SET transaction_id = t.id
        FROM dbo.user_packages up
        CROSS APPLY (
            SELECT TOP 1 id
            FROM dbo.transactions tx
            WHERE tx.user_id = up.user_id
              AND tx.package_id = up.package_id
              AND tx.status IN (N'success', N'refunded')
            ORDER BY tx.paid_at DESC, tx.id DESC
        ) t
        WHERE up.transaction_id IS NULL AND up.package_id <> N'trial'`);
    await query(`
        INSERT INTO dbo.payments (public_id, transaction_id, payment_ref, gateway, method, gateway_status, raw_webhook, paid_at)
        SELECT CONCAT(N'pay-', t.ref_no), t.id, CONCAT(N'MOCK-', t.ref_no),
               CASE
                   WHEN LOWER(t.method) LIKE N'%kbank%' THEN N'kbank'
                   WHEN t.method LIKE N'%พร้อม%' OR LOWER(t.method) LIKE N'%prompt%' THEN N'promptpay'
                   WHEN t.method LIKE N'%บัตร%' OR LOWER(t.method) LIKE N'%card%' THEN N'card'
                   ELSE N'mock'
               END,
               t.method,
               CASE WHEN t.status IN (N'pending', N'success', N'failed', N'expired', N'refunded') THEN t.status ELSE N'success' END,
               N'{"mock":true,"backfill":true}',
               t.paid_at
        FROM dbo.transactions t
        WHERE NOT EXISTS (SELECT 1 FROM dbo.payments p WHERE p.transaction_id = t.id)`);
    await query(`
        UPDATE dbo.users SET education_en = CASE education
            WHEN N'ม.ต้น' THEN N'Lower secondary'
            WHEN N'ม.ปลาย' THEN N'Upper secondary'
            WHEN N'ปวช. / ปวส.' THEN N'Vocational certificate'
            WHEN N'ปริญญาตรี' THEN N'Bachelor''s degree'
            WHEN N'ป.ตรี' THEN N'Bachelor''s degree'
            WHEN N'ปริญญาโทขึ้นไป' THEN N'Master''s or higher'
            WHEN N'ป.โท' THEN N'Master''s degree'
            ELSE education_en
        END
        WHERE education IS NOT NULL AND education_en IS NULL`);
    await query(`
        UPDATE dbo.transactions SET method_en = CASE
            WHEN method LIKE N'%บัตร%' OR LOWER(method) LIKE N'%card%' THEN N'Credit card'
            WHEN LOWER(method) LIKE N'%kbank%' THEN N'KBank'
            WHEN method LIKE N'%พร้อม%' OR LOWER(method) LIKE N'%prompt%' THEN N'PromptPay'
            ELSE method
        END
        WHERE method_en IS NULL`);
    await query(`
        UPDATE dbo.payments SET method_en = CASE
            WHEN method LIKE N'%บัตร%' OR LOWER(method) LIKE N'%card%' THEN N'Credit card'
            WHEN LOWER(method) LIKE N'%kbank%' THEN N'KBank'
            WHEN method LIKE N'%พร้อม%' OR LOWER(method) LIKE N'%prompt%' THEN N'PromptPay'
            ELSE method
        END
        WHERE method_en IS NULL`);
    const pendingGenres = await query(`SELECT id, genres FROM dbo.users WHERE genres IS NOT NULL AND genres_en IS NULL`);
    for (const row of pendingGenres.recordset) {
        let parsed = [];
        try {
            parsed = JSON.parse(row.genres);
        }
        catch {
            parsed = [];
        }
        await query(`UPDATE dbo.users SET genres_en = @genresEn WHERE id = @id`, {
            id: row.id,
            genresEn: JSON.stringify(genresEn(parsed)),
        });
    }
    const trial = await query(`SELECT id FROM dbo.packages WHERE id = N'trial'`);
    if (!trial.recordset[0]) {
        try {
            await query(
                `INSERT INTO dbo.packages (id, name, hours, price, note, tag, tone, name_en, note_en, tag_en, is_active)
                 VALUES (N'trial', N'ทดลองเรียน 1 ชั่วโมง', 1, 0, N'ชั่วโมงทดลองหลังสมัครเรียน — จองคลาสแรกได้เลย', N'ทดลอง', N'pink',
                         N'Trial 1 hour', N'Complimentary trial hour after enrollment', N'Trial', N'N')`,
            );
        }
        catch {
            await query(
                `INSERT INTO dbo.packages (id, name, hours, price, note, tag, tone, is_active)
                 VALUES (N'trial', N'ทดลองเรียน 1 ชั่วโมง', 1, 0, N'ชั่วโมงทดลองหลังสมัครเรียน — จองคลาสแรกได้เลย', N'ทดลอง', N'pink', N'N')`,
            );
        }
    }
    await query(`
        IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_enrollments_user')
            ALTER TABLE dbo.enrollments ADD CONSTRAINT FK_enrollments_user FOREIGN KEY (user_id) REFERENCES dbo.users (id)`);
    await query(`
        IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_enrollments_package')
            ALTER TABLE dbo.enrollments ADD CONSTRAINT FK_enrollments_package FOREIGN KEY (package_id) REFERENCES dbo.packages (id)`);
    await query(
        `UPDATE dbo.users SET status = N'N', updated_at = SYSUTCDATETIME()
         WHERE email = N'admin@kruaer.com' AND status <> N'N'`,
    );
    await ensureStudentOffersSchema();
    await ensureCatalogMigration();
    await ensureBookingDurationSchema();
    await ensurePaymentTransactionSchema();
}

async function ensurePaymentTransactionSchema() {
    await ensureColumn('transactions', 'offer_id', 'offer_id INT NULL');
    await ensureColumn('transactions', 'student_note', 'student_note NVARCHAR(500) NULL');
    await ensureColumn('transactions', 'payment_slip_url', 'payment_slip_url NVARCHAR(500) NULL');
    await ensureColumn('transactions', 'payment_slip_data', 'payment_slip_data NVARCHAR(MAX) NULL');
    await ensureColumn('transactions', 'confirmed_by', 'confirmed_by INT NULL');
    await ensureColumn('transactions', 'confirmed_at', 'confirmed_at DATETIME2 NULL');
    await ensureColumn('transactions', 'payment_link_id', 'payment_link_id INT NULL');
    await ensureColumn('transactions', 'installment_no', 'installment_no INT NULL');
    await ensureColumn('transactions', 'installment_total', 'installment_total INT NULL');
}

async function ensureBookingDurationSchema() {
    await ensureColumn('bookings', 'duration_hours', 'duration_hours INT NOT NULL CONSTRAINT DF_bookings_duration_hours DEFAULT 1');
    await query(`
        IF OBJECT_ID(N'dbo.booking_slots', N'U') IS NULL
        CREATE TABLE dbo.booking_slots (
            booking_id INT NOT NULL,
            slot_id INT NOT NULL,
            CONSTRAINT PK_booking_slots PRIMARY KEY (slot_id),
            CONSTRAINT FK_booking_slots_booking FOREIGN KEY (booking_id) REFERENCES dbo.bookings (id),
            CONSTRAINT FK_booking_slots_slot FOREIGN KEY (slot_id) REFERENCES dbo.teacher_availability (id)
        )`);
    await query(`
        INSERT INTO dbo.booking_slots (booking_id, slot_id)
        SELECT b.id, b.slot_id
        FROM dbo.bookings b
        WHERE NOT EXISTS (SELECT 1 FROM dbo.booking_slots bs WHERE bs.slot_id = b.slot_id)`);
}

async function ensureStudentOffersSchema() {
    await query(`
        IF OBJECT_ID(N'dbo.student_offers', N'U') IS NULL
        CREATE TABLE dbo.student_offers (
            id INT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
            public_id NVARCHAR(40) NOT NULL UNIQUE,
            user_id INT NOT NULL,
            title NVARCHAR(120) NOT NULL,
            title_en NVARCHAR(120) NULL,
            hours INT NOT NULL,
            price INT NOT NULL,
            note NVARCHAR(500) NULL,
            note_en NVARCHAR(500) NULL,
            status NVARCHAR(20) NOT NULL CONSTRAINT DF_student_offers_status DEFAULT N'pending_payment',
            user_package_id INT NULL,
            created_by INT NOT NULL,
            created_at DATETIME2 NOT NULL CONSTRAINT DF_student_offers_created DEFAULT SYSUTCDATETIME(),
            updated_at DATETIME2 NOT NULL CONSTRAINT DF_student_offers_updated DEFAULT SYSUTCDATETIME(),
            CONSTRAINT FK_student_offers_user FOREIGN KEY (user_id) REFERENCES dbo.users (id),
            CONSTRAINT FK_student_offers_creator FOREIGN KEY (created_by) REFERENCES dbo.users (id)
        )`);
}

async function ensureCatalogMigration() {
    await query(
        `UPDATE dbo.packages SET is_active = N'N'
         WHERE id IN (N'beginner', N'pro', N'master')`,
    );
    await query(`
        IF NOT EXISTS (SELECT 1 FROM dbo.packages WHERE id = N'offer')
        INSERT INTO dbo.packages (id, name, hours, price, note, tag, tone, name_en, note_en, is_active)
        VALUES (N'offer', N'คอร์สพิเศษ', 0, 0, N'แพ็กเกจระบบสำหรับคอร์สที่ครูจัดให้', NULL, N'pink',
                N'Custom offer', N'System package for teacher-assigned courses', N'N')`);
    await query(`
        IF NOT EXISTS (SELECT 1 FROM dbo.packages WHERE id = N'single')
        INSERT INTO dbo.packages (id, name, hours, price, note, tag, tone, name_en, note_en, is_active)
        VALUES (N'single', N'เรียน 1 ชั่วโมง', 1, 2500, N'฿2,500/ชม. · จองเวลาเรียนได้ทันที', NULL, N'pink',
                N'1-hour lesson', N'฿2,500/hour · Book a lesson right away', N'Y')
        ELSE
        UPDATE dbo.packages SET
            name = N'เรียน 1 ชั่วโมง',
            name_en = N'1-hour lesson',
            hours = 1,
            price = 2500,
            note = N'฿2,500/ชม. · จองเวลาเรียนได้ทันที',
            note_en = N'฿2,500/hour · Book a lesson right away',
            is_active = N'Y'
        WHERE id = N'single'`);
}

export { ensurePaymentSettingsSchema, getPaymentSettings, updatePaymentSettings, paymentConfigured } from './paymentSettings.js';

export async function enrollStudent(input) {
    return withTransaction(async (run) => {
        const inserted = await run(
            `INSERT INTO dbo.users (role, email, phone, emergency_contact, password_hash, name, name_en, nickname, nickname_en, age, birth_date, education, education_en, genres, genres_en, singing_experience, instruments, goals, reason, reason_en, address_street, address_district, address_province, language, avatar, consent_pdpa_at)
             OUTPUT INSERTED.*
             VALUES ('student', @email, @phone, @emergency, @hash, @name, @nameEn, @nickname, @nicknameEn, @age, @birthDate, @education, @educationEn, @genres, @genresEn, @singingExperience, @instruments, @goals, @reason, @reasonEn, @addressStreet, @addressDistrict, @addressProvince, @language, @avatar, SYSUTCDATETIME())`,
            {
                email: input.email,
                phone: input.phone,
                emergency: input.emergencyContact || null,
                hash: input.hash,
                name: input.name,
                nameEn: input.nameEn,
                nickname: input.nickname,
                nicknameEn: input.nicknameEn,
                age: input.age,
                birthDate: input.birthDate || null,
                education: input.education,
                educationEn: input.educationEn || (input.education ? educationEn(input.education) : null),
                genres: input.genres,
                genresEn: input.genresEn || null,
                singingExperience: input.singingExperience || null,
                instruments: input.instruments || null,
                goals: input.goals || null,
                reason: input.reason,
                reasonEn: input.reasonEn || null,
                addressStreet: input.addressStreet || null,
                addressDistrict: input.addressDistrict || null,
                addressProvince: input.addressProvince || null,
                language: input.language,
                avatar: input.avatar,
            },
        );
        const user = inserted.recordset[0];
        if (!user) {
            throw new Error('บันทึกผู้เรียนลงฐานข้อมูลไม่สำเร็จ');
        }
        await run(
            `INSERT INTO dbo.enrollments (public_id, user_id, package_id, hours_granted, status, source)
             VALUES (@enrollmentId, @userId, N'single', 0, N'pending_payment', N'web')`,
            { enrollmentId: input.enrollmentId, userId: user.id },
        );
        const enrollment = await run(
            `SELECT public_id FROM dbo.enrollments WHERE public_id = @enrollmentId`,
            { enrollmentId: input.enrollmentId },
        );
        if (!enrollment.recordset[0]?.public_id) {
            throw new Error('บันทึกการสมัครเรียนลงฐานข้อมูลไม่สำเร็จ');
        }
        await run(
            `INSERT INTO dbo.notifications (public_id, user_id, title, body, title_en, body_en, tone)
             VALUES (CONCAT('N', REPLACE(CONVERT(varchar(36), NEWID()), '-', '')), @userId,
                     N'ยินดีต้อนรับ', N'สมัครเรียนสำเร็จ — ซื้อแพ็กเกจทดลองเรียน ฿2,500 แล้วจองเวลาได้เลย',
                     N'Welcome', N'You are enrolled — buy the ฿2,500 trial package to book your first lesson.', N'blue')`,
            { userId: user.id },
        );
        return {
            user,
            enrollmentId: enrollment.recordset[0].public_id,
            hoursGranted: 0,
        };
    });
}

export function ageFromBirthDate(birthDate) {
    const birth = new Date(birthDate);
    if (Number.isNaN(birth.getTime())) {
        return null;
    }
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDelta = today.getMonth() - birth.getMonth();
    if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) {
        age -= 1;
    }
    return age >= 0 && age <= 120 ? age : null;
}

export async function signLessonAndDeductHours({ bookingPublicId, userId, signature }) {
    return withTransaction(async (run) => {
        const found = await run(
            `SELECT cl.id, cl.hours_deducted, cl.hours_charged_at, cl.outcome,
                    b.user_package_id, b.user_id AS booking_user_id
             FROM dbo.class_logs cl
             JOIN dbo.bookings b ON b.id = cl.booking_id
             WHERE b.public_id = @bookingId AND cl.user_id = @userId AND cl.student_signature IS NULL`,
            { bookingId: bookingPublicId, userId },
        );
        const row = found.recordset[0];
        if (!row) {
            throw new Error('ไม่พบคลาสที่ต้องลงชื่อ');
        }
        await run(
            `UPDATE dbo.class_logs SET student_signature = @sig, signed_at = SYSUTCDATETIME() WHERE id = @id`,
            { id: row.id, sig: signature.slice(0, 200000) },
        );
        let hoursDeducted = 0;
        if (row.outcome === 'done' && !row.hours_charged_at && Number(row.hours_deducted) > 0) {
            const deductHours = Math.max(1, Number(row.hours_deducted) || 1);
            let pkg = null;
            if (row.user_package_id) {
                const pkgResult = await run(
                    `SELECT id, hours_total, hours_used FROM dbo.user_packages WHERE id = @id`,
                    { id: row.user_package_id },
                );
                pkg = pkgResult.recordset[0] ?? null;
            }
            else {
                const active = await run(
                    `SELECT TOP 1 id, hours_total, hours_used
                     FROM dbo.user_packages
                     WHERE user_id = @userId AND status = N'active' AND expires_at > SYSUTCDATETIME()
                     ORDER BY expires_at ASC`,
                    { userId: row.booking_user_id },
                );
                pkg = active.recordset[0] ?? null;
            }
            if (pkg?.id) {
                const hoursBefore = packageHoursLeft(pkg.hours_total, pkg.hours_used);
                await run(
                    `UPDATE dbo.user_packages SET hours_used = hours_used + @hours WHERE id = @pkgId`,
                    { pkgId: pkg.id, hours: deductHours },
                );
                await run(
                    `UPDATE dbo.class_logs SET hours_charged_at = SYSUTCDATETIME() WHERE id = @id`,
                    { id: row.id },
                );
                const hoursAfter = Math.max(0, hoursBefore - deductHours);
                await maybeNotifyPackageHours(row.booking_user_id, pkg.id, hoursBefore, hoursAfter);
                hoursDeducted = deductHours;
            }
        }
        return { ok: true, hoursDeducted };
    });
}

export function consecutiveSlotTimes(startTime, hours) {
    const start = String(startTime);
    const count = Number(hours);
    const idx = SLOT_TIMES.indexOf(start);
    if (idx < 0) {
        throw new Error('เวลาเริ่มใช้ได้ 10:00–19:00 น. เท่านั้น');
    }
    if (!Number.isInteger(count) || count < 1) {
        throw new Error('จำนวนชั่วโมงต้องเป็นจำนวนเต็มอย่างน้อย 1');
    }
    if (idx + count > SLOT_TIMES.length) {
        throw new Error('ช่วงเวลานี้ยาวเกินเวลาทำการ');
    }
    return SLOT_TIMES.slice(idx, idx + count);
}

export function lessonEndTime(startTime, hours) {
    const times = consecutiveSlotTimes(startTime, hours);
    const lastHour = Number(times[times.length - 1].split(':')[0]) + 1;
    return `${String(lastHour).padStart(2, '0')}:00`;
}

async function lockSlotsForBooking(run, { teacherId, dayIso, times }) {
    const slots = [];
    for (const time of times) {
        let slotResult = await run(
            `SELECT id, status,
                    CONVERT(varchar(10), slot_date, 23) AS slot_iso,
                    CONVERT(varchar(5), slot_time, 108) AS slot_hhmm
             FROM dbo.teacher_availability WITH (UPDLOCK, ROWLOCK)
             WHERE teacher_id = @teacherId
               AND CONVERT(varchar(10), slot_date, 23) = @dayIso
               AND CONVERT(varchar(5), slot_time, 108) = @time`,
            { teacherId, dayIso, time },
        );
        let slot = slotResult.recordset[0];
        if (!slot) {
            await run(
                `INSERT INTO dbo.teacher_availability (teacher_id, slot_date, slot_time, duration_min, status)
                 VALUES (@teacherId, @dayIso, @time, 60, N'open')`,
                { teacherId, dayIso, time },
            );
            slotResult = await run(
                `SELECT id, status,
                        CONVERT(varchar(10), slot_date, 23) AS slot_iso,
                        CONVERT(varchar(5), slot_time, 108) AS slot_hhmm
                 FROM dbo.teacher_availability WITH (UPDLOCK, ROWLOCK)
                 WHERE teacher_id = @teacherId
                   AND CONVERT(varchar(10), slot_date, 23) = @dayIso
                   AND CONVERT(varchar(5), slot_time, 108) = @time`,
                { teacherId, dayIso, time },
            );
            slot = slotResult.recordset[0];
        }
        if (!slot) {
            throw new Error('ไม่พบสล็อตที่เลือก');
        }
        if (slot.status === 'closed') {
            throw new Error(`สล็อต ${time} ถูกปิดแล้ว`);
        }
        if (slot.status !== 'open') {
            throw new Error(`สล็อต ${time} ถูกจองแล้ว`);
        }
        const booked = await run(
            `UPDATE dbo.teacher_availability
             SET status = N'booked'
             WHERE id = @slotId AND status = N'open'`,
            { slotId: slot.id },
        );
        if (!booked.rowsAffected?.[0]) {
            throw new Error(`สล็อต ${time} ถูกจองแล้ว`);
        }
        slots.push(slot);
    }
    return slots;
}

export async function createLessonBooking({
    publicId,
    userId,
    dayIso,
    time,
    topic,
    topicEn,
    source,
    mode,
    durationHours = 1,
    teacherId: teacherIdInput = null,
    createdByTeacher = false,
}) {
    const hours = Number(durationHours) || 1;
    const times = consecutiveSlotTimes(time, hours);
    const booking = await withTransaction(async (run) => {
        const pkgResult = await run(
            `SELECT TOP 1 up.id, up.hours_total, up.hours_used
             FROM dbo.user_packages up
             WHERE up.user_id = @userId AND up.status = N'active' AND up.expires_at > SYSUTCDATETIME()
             ORDER BY up.created_at DESC`,
            { userId },
        );
        const pkg = pkgResult.recordset[0];
        const left = pkg ? Math.max(0, Number(pkg.hours_total) - Number(pkg.hours_used)) : 0;
        if (!pkg || left < hours) {
            throw new Error(createdByTeacher
                ? 'ชั่วโมงคงเหลือของนักเรียนไม่พอสำหรับนัดนี้'
                : 'ชั่วโมงคงเหลือไม่พอ — กรุณาสมัครเรียนหรือซื้อแพ็กเกจก่อนจอง');
        }
        let teacherId = teacherIdInput;
        if (!teacherId) {
            const teacherResult = await run(
                `SELECT TOP 1 id FROM dbo.users WHERE role = N'teacher' AND status = N'Y' ORDER BY id`,
            );
            teacherId = teacherResult.recordset[0]?.id;
        }
        if (!teacherId) {
            throw new Error('ยังไม่มีครูในระบบ');
        }
        const slots = await lockSlotsForBooking(run, { teacherId, dayIso, times });
        const primary = slots[0];
        const bookingSource = source === 'line' ? 'line' : source === 'teacher' ? 'teacher' : 'web';
        const bookingMode = mode === 'online' ? 'online' : 'studio';
        const deadline = confirmDeadlineAt(slotStartAt(primary.slot_iso, primary.slot_hhmm), new Date());
        const inserted = await run(
            `INSERT INTO dbo.bookings (public_id, user_id, slot_id, user_package_id, status, topic, topic_en, source, mode, confirm_deadline, duration_hours, updated_at)
             OUTPUT INSERTED.*
             VALUES (@publicId, @userId, @slotId, @pkgId, N'pending', @topic, @topicEn, @source, @mode, @deadline, @hours, SYSUTCDATETIME())`,
            {
                publicId,
                userId,
                slotId: primary.id,
                pkgId: pkg.id,
                topic,
                topicEn,
                source: bookingSource,
                mode: bookingMode,
                deadline,
                hours,
            },
        );
        const booking = inserted.recordset[0];
        if (!booking) {
            throw new Error('บันทึกการจองเรียนลงฐานข้อมูลไม่สำเร็จ');
        }
        for (const slot of slots) {
            await run(
                `INSERT INTO dbo.booking_slots (booking_id, slot_id) VALUES (@bookingId, @slotId)`,
                { bookingId: booking.id, slotId: slot.id },
            );
        }
        return booking;
    });
    if (createdByTeacher) {
        await addNotification(
            userId,
            'ครูแอร์นัดเรียนให้แล้ว',
            `นัด ${dayIso} ${time} · ${hours} ชม. — กรุณายืนยันการมาเรียนในแอป`,
            'pink',
            'Kru Air scheduled a lesson',
            `Lesson on ${dayIso} ${time} · ${hours} hour(s) — please confirm attendance in the app.`,
        );
    }
    else {
        await addNotification(
            userId,
            'จองเวลาเรียนสำเร็จ',
            `ล็อกสล็อต ${dayIso} ${time} แล้ว — ระบบจะเตือนนัดก่อนเรียน 1 วัน`,
            'blue',
            'Booking saved',
            `Slot ${dayIso} ${time} is locked — you will get a reminder 1 day before class.`,
        );
    }
    return booking;
}

export function discountForVoucher(voucher, price) {
    if (voucher.type === 'percent') {
        const raw = Math.round(Number(price) * Number(voucher.value) / 100);
        const cap = voucher.max_discount == null ? raw : Number(voucher.max_discount);
        return Math.min(raw, cap);
    }
    return Number(voucher.value);
}

export async function createPackagePurchase({
    userId,
    pkgId,
    voucherCode,
    method,
    enrollmentPublicId,
    paymentPublicId,
}) {
    return withTransaction(async (run) => {
        const pkgResult = await run(`SELECT * FROM dbo.packages WHERE id = @id AND is_active = N'Y'`, { id: pkgId });
        const pkg = pkgResult.recordset[0];
        if (!pkg) {
            throw new Error('ไม่พบแพ็กเกจที่เลือก');
        }
        let discount = 0;
        let voucher = null;
        const code = String(voucherCode ?? '').trim().toUpperCase();
        if (code) {
            const voucherResult = await run(
                `SELECT * FROM dbo.vouchers WHERE code = @code AND is_active = N'Y' AND (valid_to IS NULL OR valid_to >= SYSUTCDATETIME())`,
                { code },
            );
            voucher = voucherResult.recordset[0];
            if (!voucher) {
                throw new Error(`โค้ด "${code}" ไม่ถูกต้องหรือหมดอายุ`);
            }
            if (voucher.max_uses != null && voucher.used_count >= voucher.max_uses) {
                throw new Error(`โค้ด "${code}" ถูกใช้ครบแล้ว`);
            }
            discount = Math.min(discountForVoucher(voucher, pkg.price), Number(pkg.price));
        }
        const net = Number(pkg.price) - discount;
        const count = await run(`SELECT COUNT(*) AS n FROM dbo.transactions`);
        const refNo = `INV-${new Date().getFullYear()}-${8800 + Number(count.recordset[0].n) + 1}`;
        const payMethod = String(method ?? 'บัตรเครดิต').split(' (')[0];
        const gateway = gatewayFromMethod(payMethod);
        const tx = await run(
            `INSERT INTO dbo.transactions (ref_no, user_id, package_id, gross_amount, discount_amount, net_amount, voucher_code, method, method_en, status, paid_at)
             OUTPUT INSERTED.*
             VALUES (@refNo, @userId, @pkgId, @gross, @discount, @net, @voucher, @method, @methodEn, N'success', SYSUTCDATETIME())`,
            {
                refNo,
                userId,
                pkgId,
                gross: Number(pkg.price),
                discount,
                net,
                voucher: code || null,
                method: payMethod,
                methodEn: methodEn(payMethod),
            },
        );
        const transaction = tx.recordset[0];
        const webhook = JSON.stringify({
            mock: true,
            gateway,
            method: payMethod,
            status: 'success',
            note: 'Hours granted without bank confirmation',
        });
        await run(
            `INSERT INTO dbo.payments (public_id, transaction_id, payment_ref, gateway, method, method_en, gateway_status, raw_webhook, paid_at)
             VALUES (@publicId, @txId, @paymentRef, @gateway, @method, @methodEn, N'success', @webhook, SYSUTCDATETIME())`,
            {
                publicId: paymentPublicId,
                txId: transaction.id,
                paymentRef: `MOCK-${refNo}`,
                gateway,
                method: payMethod,
                methodEn: methodEn(payMethod),
                webhook,
            },
        );
        await run(
            `UPDATE dbo.user_packages SET status = N'expired' WHERE user_id = @userId AND status = N'active'`,
            { userId },
        );
        await run(
            `INSERT INTO dbo.user_packages (user_id, package_id, hours_total, hours_used, expires_at, status, transaction_id)
             VALUES (@userId, @pkgId, @hours, 0, DATEADD(month, 6, SYSUTCDATETIME()), N'active', @txId)`,
            { userId, pkgId, hours: pkg.hours, txId: transaction.id },
        );
        await run(
            `INSERT INTO dbo.enrollments (public_id, user_id, package_id, hours_granted, status, source)
             VALUES (@enrollmentId, @userId, @pkgId, @hours, N'active', N'web')`,
            { enrollmentId: enrollmentPublicId, userId, pkgId, hours: pkg.hours },
        );
        if (voucher) {
            await run(
                `UPDATE dbo.vouchers SET used_count = used_count + 1 WHERE id = @id;
                 INSERT INTO dbo.voucher_usages (voucher_id, transaction_id) VALUES (@id, @txId);`,
                { id: voucher.id, txId: transaction.id },
            );
        }
        const pkgName = pick(pkg, 'name', 'th');
        const pkgNameEn = pick(pkg, 'name', 'en');
        await run(
            `INSERT INTO dbo.notifications (public_id, user_id, title, body, title_en, body_en, tone)
             VALUES (CONCAT('N', REPLACE(CONVERT(varchar(36), NEWID()), '-', '')), @userId,
                     N'ชำระเงินสำเร็จ', @bodyTh, N'Payment successful', @bodyEn, N'green')`,
            {
                userId,
                bodyTh: `ซื้อแพ็กเกจ ${pkgName} — เพิ่มชั่วโมงเข้าบัญชีแล้ว`,
                bodyEn: `${pkgNameEn} purchased — hours were added to your account.`,
            },
        );
        return { refNo, transactionId: transaction.id };
    });
}

const SYSTEM_PACKAGE_IDS = new Set(['trial', 'offer']);

export function mapStudentOffer(row, lang) {
    return {
        id: row.public_id,
        title: pick(row, 'title', lang),
        hours: Number(row.hours),
        price: Number(row.price),
        note: pick(row, 'note', lang) || null,
        status: row.status,
        createdAt: formatDate(new Date(row.created_at), lang),
    };
}

export async function listStudentOffers(userId, { includeCancelled = false } = {}) {
    const result = await query(
        `SELECT * FROM dbo.student_offers
         WHERE user_id = @userId
           ${includeCancelled ? '' : "AND status <> N'cancelled'"}
         ORDER BY created_at DESC`,
        { userId },
    );
    return result.recordset;
}

export async function createStudentOffer({
    publicId,
    userId,
    createdBy,
    title,
    titleEn,
    hours,
    price,
    note,
    noteEn,
    grantNow,
}) {
    const created = await withTransaction(async (run) => {
        const userResult = await run(`SELECT id, role, status FROM dbo.users WHERE id = @id`, { id: userId });
        const student = userResult.recordset[0];
        if (!student || student.role !== 'student') {
            throw new Error('ไม่พบนักเรียนที่เลือก');
        }
        if (!isYes(student.status)) {
            throw new Error('บัญชีนักเรียนนี้ถูกระงับ');
        }
        const status = grantNow ? 'granted' : 'pending_payment';
        let userPackageId = null;
        if (grantNow) {
            const pkgInsert = await run(
                `INSERT INTO dbo.user_packages (user_id, package_id, hours_total, hours_used, expires_at, status)
                 OUTPUT INSERTED.id
                 VALUES (@userId, N'offer', @hours, 0, DATEADD(month, 6, SYSUTCDATETIME()), N'active')`,
                { userId, hours },
            );
            userPackageId = pkgInsert.recordset[0]?.id ?? null;
            if (!userPackageId) {
                throw new Error('เพิ่มชั่วโมงไม่สำเร็จ');
            }
        }
        const inserted = await run(
            `INSERT INTO dbo.student_offers (public_id, user_id, title, title_en, hours, price, note, note_en, status, user_package_id, created_by)
             OUTPUT INSERTED.*
             VALUES (@publicId, @userId, @title, @titleEn, @hours, @price, @note, @noteEn, @status, @userPackageId, @createdBy)`,
            {
                publicId,
                userId,
                title,
                titleEn: titleEn || null,
                hours,
                price,
                note: note || null,
                noteEn: noteEn || null,
                status,
                userPackageId,
                createdBy,
            },
        );
        return inserted.recordset[0];
    });
    if (grantNow) {
        await addNotification(
            userId,
            'ได้รับชั่วโมงเรียนแล้ว',
            `ครูแอร์เพิ่มคอร์ส "${title}" — ${hours} ชม. เข้าบัญชีแล้ว`,
            'green',
            'Hours added',
            `Kru Air added "${titleEn || title}" — ${hours} hour(s) added to your account.`,
        );
    }
    else {
        await addNotification(
            userId,
            'มีคอร์สรอชำระ',
            `ครูแอร์จัดคอร์ส "${title}" ให้ · ${hours} ชม. · ฿${Number(price).toLocaleString()} — ดูที่หน้าแพ็กเกจ`,
            'amber',
            'Course awaiting payment',
            `Kru Air assigned "${titleEn || title}" · ${hours} hour(s) · ฿${Number(price).toLocaleString()} — see Packages.`,
        );
    }
    return created;
}

export async function cancelStudentOffer(publicId) {
    const found = await query(`SELECT * FROM dbo.student_offers WHERE public_id = @id`, { id: publicId });
    const offer = found.recordset[0];
    if (!offer) {
        throw new Error('ไม่พบคอร์สที่เลือก');
    }
    if (offer.status !== 'pending_payment') {
        throw new Error('ยกเลิกได้เฉพาะคอร์สที่รอชำระเท่านั้น');
    }
    await query(
        `UPDATE dbo.student_offers SET status = N'cancelled', updated_at = SYSUTCDATETIME() WHERE public_id = @id`,
        { id: publicId },
    );
}

export async function listAdminPackages() {
    return query(
        `SELECT id, name, name_en, hours, price, note, note_en, tag, tag_en, tone, is_active
         FROM dbo.packages
         WHERE id NOT IN (N'trial', N'offer')
         ORDER BY hours, id`,
    );
}

export async function createStandardPackage(input) {
    const id = String(input.id ?? `pkg-${Date.now().toString(36)}`);
    if (SYSTEM_PACKAGE_IDS.has(id)) {
        throw new Error('ไม่สามารถใช้รหัสแพ็กเกจนี้ได้');
    }
    const hours = Number(input.hours);
    const price = Number(input.price);
    if (!Number.isInteger(hours) || hours <= 0) {
        throw new Error('กรุณากรอกจำนวนชั่วโมงให้ถูกต้อง');
    }
    if (!Number.isInteger(price) || price < 0) {
        throw new Error('กรุณากรอกราคาให้ถูกต้อง');
    }
    const name = String(input.name ?? '').trim();
    if (!name) {
        throw new Error('กรุณากรอกชื่อแพ็กเกจ');
    }
    await query(
        `INSERT INTO dbo.packages (id, name, name_en, hours, price, note, note_en, tag, tag_en, tone, is_active)
         VALUES (@id, @name, @nameEn, @hours, @price, @note, @noteEn, @tag, @tagEn, @tone, @active)`,
        {
            id,
            name,
            nameEn: String(input.nameEn ?? name).trim(),
            hours,
            price,
            note: String(input.note ?? '').trim() || null,
            noteEn: String(input.noteEn ?? '').trim() || null,
            tag: String(input.tag ?? '').trim() || null,
            tagEn: String(input.tagEn ?? '').trim() || null,
            tone: String(input.tone ?? 'pink').trim() || 'pink',
            active: toYn(input.active !== false),
        },
    );
    const created = await query(`SELECT * FROM dbo.packages WHERE id = @id`, { id });
    return created.recordset[0];
}

export async function updateStandardPackage(id, input) {
    if (SYSTEM_PACKAGE_IDS.has(id)) {
        throw new Error('ไม่สามารถแก้ไขแพ็กเกจระบบนี้ได้');
    }
    const found = await query(`SELECT * FROM dbo.packages WHERE id = @id`, { id });
    if (!found.recordset[0]) {
        throw new Error('ไม่พบแพ็กเกจที่เลือก');
    }
    const row = found.recordset[0];
    const hours = input.hours == null ? Number(row.hours) : Number(input.hours);
    const price = input.price == null ? Number(row.price) : Number(input.price);
    if (!Number.isInteger(hours) || hours <= 0) {
        throw new Error('กรุณากรอกจำนวนชั่วโมงให้ถูกต้อง');
    }
    if (!Number.isInteger(price) || price < 0) {
        throw new Error('กรุณากรอกราคาให้ถูกต้อง');
    }
    const name = input.name == null ? row.name : String(input.name).trim();
    if (!name) {
        throw new Error('กรุณากรอกชื่อแพ็กเกจ');
    }
    await query(
        `UPDATE dbo.packages SET
            name = @name,
            name_en = @nameEn,
            hours = @hours,
            price = @price,
            note = @note,
            note_en = @noteEn,
            tag = @tag,
            tag_en = @tagEn,
            tone = @tone,
            is_active = @active
         WHERE id = @id`,
        {
            id,
            name,
            nameEn: input.nameEn == null ? row.name_en : String(input.nameEn).trim(),
            hours,
            price,
            note: input.note == null ? row.note : (String(input.note).trim() || null),
            noteEn: input.noteEn == null ? row.note_en : (String(input.noteEn).trim() || null),
            tag: input.tag == null ? row.tag : (String(input.tag).trim() || null),
            tagEn: input.tagEn == null ? row.tag_en : (String(input.tagEn).trim() || null),
            tone: input.tone == null ? row.tone : (String(input.tone).trim() || 'pink'),
            active: input.active == null ? row.is_active : toYn(input.active),
        },
    );
    const updated = await query(`SELECT * FROM dbo.packages WHERE id = @id`, { id });
    return updated.recordset[0];
}

export async function ensureActiveBookingSlotIndex() {
    await query(`
        DECLARE @sql NVARCHAR(MAX) = N'';
        SELECT @sql = @sql + N'ALTER TABLE dbo.bookings DROP CONSTRAINT [' + kc.name + N'];'
        FROM sys.key_constraints kc
        INNER JOIN sys.index_columns ic ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
        INNER JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
        WHERE kc.parent_object_id = OBJECT_ID(N'dbo.bookings')
          AND kc.[type] = 'UQ'
          AND c.name = N'slot_id'
          AND NOT EXISTS (
            SELECT 1 FROM sys.index_columns ic2
            WHERE ic2.object_id = ic.object_id AND ic2.index_id = ic.index_id AND ic2.index_column_id > 1
          );
        IF @sql <> N'' EXEC(@sql)`);
    await query(`
        DECLARE @sql NVARCHAR(MAX) = N'';
        SELECT @sql = @sql + N'DROP INDEX [' + i.name + N'] ON dbo.bookings;'
        FROM sys.indexes i
        INNER JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
        INNER JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
        WHERE i.object_id = OBJECT_ID(N'dbo.bookings')
          AND i.is_unique = 1
          AND i.is_primary_key = 0
          AND i.has_filter = 0
          AND i.is_unique_constraint = 0
          AND c.name = N'slot_id'
          AND NOT EXISTS (
            SELECT 1 FROM sys.index_columns ic2
            WHERE ic2.object_id = ic.object_id AND ic2.index_id = ic.index_id AND ic2.index_column_id > 1
          );
        IF @sql <> N'' EXEC(@sql)`);
    await query(`
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_bookings_active_slot' AND object_id = OBJECT_ID(N'dbo.bookings'))
            CREATE UNIQUE INDEX UX_bookings_active_slot ON dbo.bookings (slot_id)
            WHERE status IN (N'pending', N'confirmed', N'moved')`);
}

export async function cancelLessonBooking({ bookingRowId, reason, slotAfter = 'open' }) {
    return withTransaction(async (run) => {
        const found = await run(
            `SELECT b.*, CONVERT(varchar(10), s.slot_date, 23) AS slot_iso,
                    CONVERT(varchar(5), s.slot_time, 108) AS slot_hhmm
             FROM dbo.bookings b
             JOIN dbo.teacher_availability s ON s.id = b.slot_id
             WHERE b.id = @id`,
            { id: bookingRowId },
        );
        const booking = found.recordset[0];
        if (!booking) {
            throw new Error('ไม่พบคลาสที่เลือก');
        }
        if (!['pending', 'confirmed', 'moved'].includes(booking.status)) {
            throw new Error('ไม่สามารถยกเลิกนัดนี้ได้');
        }
        const updated = await run(
            `UPDATE dbo.bookings
             SET status = N'cancelled',
                 cancelled_at = SYSUTCDATETIME(),
                 cancel_reason = @reason,
                 updated_at = SYSUTCDATETIME()
             WHERE id = @id AND status IN (N'pending', N'confirmed', N'moved')`,
            { id: bookingRowId, reason: String(reason || 'cancelled').slice(0, 200) },
        );
        if (!updated.rowsAffected?.[0]) {
            throw new Error('ไม่สามารถยกเลิกนัดนี้ได้');
        }
        await run(
            `UPDATE dbo.move_requests
             SET status = N'rejected', decided_at = SYSUTCDATETIME()
             WHERE booking_id = @id AND status = N'pending'`,
            { id: bookingRowId },
        );
        const linked = await run(`SELECT slot_id FROM dbo.booking_slots WHERE booking_id = @id`, { id: bookingRowId });
        const slotIds = linked.recordset.length
            ? linked.recordset.map((row) => row.slot_id)
            : [booking.slot_id];
        const nextStatus = slotAfter === 'closed' ? 'closed' : 'open';
        for (const slotId of slotIds) {
            await run(
                `UPDATE dbo.teacher_availability SET status = @status WHERE id = @slotId`,
                { status: nextStatus, slotId },
            );
        }
        await run(`DELETE FROM dbo.booking_slots WHERE booking_id = @id`, { id: bookingRowId });
        return booking;
    });
}

export async function createTeacherSlot({ teacherId, dayIso, time }) {
    assertDayIso(dayIso);
    if (!isAllowedSlotTime(time)) {
        throw new Error('เวลาสล็อตใช้ได้ 10:00–19:00 น. เท่านั้น');
    }
    try {
        await query(
            `INSERT INTO dbo.teacher_availability (teacher_id, slot_date, slot_time, duration_min, status)
             VALUES (@teacherId, @dayIso, @time, 60, N'open')`,
            { teacherId, dayIso, time },
        );
    }
    catch (err) {
        const number = err?.number ?? err?.originalError?.info?.number;
        if (number === 2627 || number === 2601) {
            throw new Error('มีสล็อตเวลานี้อยู่แล้ว');
        }
        throw err;
    }
}

export async function setTeacherSlotStatus({ slotId, action, teacherId }) {
    const found = await query(
        `SELECT s.id, s.status, s.teacher_id,
                CONVERT(varchar(10), s.slot_date, 23) AS slot_iso,
                CONVERT(varchar(5), s.slot_time, 108) AS slot_hhmm,
                b.id AS booking_row_id, b.public_id AS booking_public_id, b.user_id, b.status AS booking_status
         FROM dbo.teacher_availability s
         LEFT JOIN dbo.booking_slots bs ON bs.slot_id = s.id
         LEFT JOIN dbo.bookings b ON b.id = bs.booking_id AND b.status IN (N'pending', N'confirmed', N'moved')
         WHERE s.id = @slotId AND s.teacher_id = @teacherId`,
        { slotId, teacherId },
    );
    const slot = found.recordset[0];
    if (!slot) {
        throw new Error('ไม่พบสล็อตนี้');
    }
    const next = nextSlotStatus(slot.status, action);
    if (!next) {
        throw new Error(action === 'open' ? 'เปิดได้เฉพาะสล็อตที่ปิดไว้' : 'ปิดสล็อตนี้ไม่ได้');
    }
    if (action === 'close' && slot.status === 'booked' && slot.booking_row_id) {
        const booking = await cancelLessonBooking({
            bookingRowId: slot.booking_row_id,
            reason: 'teacher_closed',
            slotAfter: 'closed',
        });
        return { slotStatus: 'closed', cancelled: true, booking };
    }
    await query(
        `UPDATE dbo.teacher_availability SET status = @status WHERE id = @id AND teacher_id = @teacherId`,
        { status: next, id: slot.id, teacherId },
    );
    return { slotStatus: next, cancelled: false, booking: null };
}

export async function bulkCloseTeacherSlots({ teacherId, fromIso, toIso }) {
    assertDayIso(fromIso);
    assertDayIso(toIso);
    if (fromIso > toIso) {
        throw new Error('ช่วงวันที่ไม่ถูกต้อง');
    }
    const closed = await query(
        `UPDATE dbo.teacher_availability
         SET status = N'closed'
         WHERE teacher_id = @teacherId
           AND slot_date >= @fromIso AND slot_date <= @toIso
           AND status = N'open'`,
        { teacherId, fromIso, toIso },
    );
    const skipped = await scalar(
        `SELECT COUNT(*) AS n
         FROM dbo.teacher_availability
         WHERE teacher_id = @teacherId
           AND slot_date >= @fromIso AND slot_date <= @toIso
           AND status = N'booked'`,
        { teacherId, fromIso, toIso },
    );
    return {
        closed: Number(closed.rowsAffected?.[0] || 0),
        skippedBooked: Number(skipped || 0),
    };
}

export async function listTeacherSignatureLogs(teacherId) {
    return query(
        `SELECT cl.id, b.public_id AS booking_id, cl.lesson_title, cl.lesson_title_en,
                cl.student_signature, cl.signed_at, cl.outcome, cl.created_at,
                u.id AS student_id, u.nickname, u.nickname_en, u.name, u.name_en,
                CONVERT(varchar(10), s.slot_date, 23) AS slot_iso,
                CONVERT(varchar(5), s.slot_time, 108) AS slot_hhmm
         FROM dbo.class_logs cl
         JOIN dbo.bookings b ON b.id = cl.booking_id
         JOIN dbo.teacher_availability s ON s.id = b.slot_id
         JOIN dbo.users u ON u.id = cl.user_id
         WHERE s.teacher_id = @teacherId AND cl.outcome = N'done'
         ORDER BY CASE WHEN cl.student_signature IS NULL THEN 0 ELSE 1 END,
                  COALESCE(cl.signed_at, cl.created_at) DESC`,
        { teacherId },
    );
}

export async function getTeacherSignatureLog(teacherId, bookingPublicId) {
    const result = await query(
        `SELECT cl.id, b.public_id AS booking_id, cl.lesson_title, cl.lesson_title_en,
                cl.student_signature, cl.signed_at, cl.outcome, cl.created_at,
                u.id AS student_id, u.nickname, u.nickname_en, u.name, u.name_en,
                CONVERT(varchar(10), s.slot_date, 23) AS slot_iso,
                CONVERT(varchar(5), s.slot_time, 108) AS slot_hhmm
         FROM dbo.class_logs cl
         JOIN dbo.bookings b ON b.id = cl.booking_id
         JOIN dbo.teacher_availability s ON s.id = b.slot_id
         JOIN dbo.users u ON u.id = cl.user_id
         WHERE s.teacher_id = @teacherId AND b.public_id = @bookingId AND cl.outcome = N'done'`,
        { teacherId, bookingId: bookingPublicId },
    );
    return result.recordset[0] ?? null;
}

export async function countPendingTeacherSignatures(teacherId) {
    const result = await query(
        `SELECT COUNT(*) AS n
         FROM dbo.class_logs cl
         JOIN dbo.bookings b ON b.id = cl.booking_id
         JOIN dbo.teacher_availability s ON s.id = b.slot_id
         WHERE s.teacher_id = @teacherId
           AND cl.outcome = N'done'
           AND cl.student_signature IS NULL`,
        { teacherId },
    );
    return Number(result.recordset[0]?.n || 0);
}

export async function listTeacherMonthSlots({ teacherId, start, end }) {
    return query(
        `SELECT s.id,
                CONVERT(varchar(10), s.slot_date, 23) AS slot_iso,
                CONVERT(varchar(5), s.slot_time, 108) AS slot_hhmm,
                s.status,
                b.public_id AS booking_id, b.status AS booking_status, b.topic, b.topic_en,
                COALESCE(b.duration_hours, 1) AS duration_hours,
                CASE WHEN b.slot_id = s.id THEN 1 ELSE 0 END AS is_primary_slot,
                u.nickname, u.nickname_en, u.name, u.name_en, u.id AS student_id
         FROM dbo.teacher_availability s
         LEFT JOIN dbo.booking_slots bs ON bs.slot_id = s.id
         LEFT JOIN dbo.bookings b ON b.id = bs.booking_id AND b.status IN (N'pending', N'confirmed', N'moved')
         LEFT JOIN dbo.users u ON u.id = b.user_id
         WHERE s.teacher_id = @teacherId AND s.slot_date >= @start AND s.slot_date <= @end
         ORDER BY s.slot_date, s.slot_time`,
        { teacherId, start, end },
    );
}

export function assertDayIso(day) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day))) {
        throw new Error('รูปแบบวันไม่ถูกต้อง');
    }
    return parseIsoDate(day);
}

export { sql, chipLabel };
