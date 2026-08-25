import { getPool, sql } from './db.js';
import { confirmDeadlineAt, isAllowedSlotTime, nextSlotStatus, slotStartAt } from './bookingPolicy.js';
import { parseIsoDate, toIsoDate } from './dates.js';
import { chipLabel, educationEn, genresEn, methodEn, moveStatus, pick, relativeTime } from './lang.js';
import { isYes, toYn } from './yn.js';

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

export async function addNotification(userId, title, body, tone = 'blue', titleEn = null, bodyEn = null) {
    await query(
        `INSERT INTO dbo.notifications (public_id, user_id, title, body, title_en, body_en, tone)
         VALUES (CONCAT('N', REPLACE(CONVERT(varchar(36), NEWID()), '-', '')), @userId, @title, @body, @titleEn, @bodyEn, @tone)`,
        { userId, title, body, titleEn, bodyEn, tone },
    );
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
    await ensureColumn('users', 'name_en', 'name_en NVARCHAR(100) NULL');
    await ensureColumn('users', 'nickname_en', 'nickname_en NVARCHAR(50) NULL');
    await ensureColumn('users', 'education_en', 'education_en NVARCHAR(100) NULL');
    await ensureColumn('users', 'reason_en', 'reason_en NVARCHAR(MAX) NULL');
    await ensureColumn('users', 'genres_en', 'genres_en NVARCHAR(MAX) NULL');
    await ensureColumn('transactions', 'method_en', 'method_en NVARCHAR(80) NULL');
    await ensureColumn('payments', 'method_en', 'method_en NVARCHAR(80) NULL');
    await dropUsersPublicId();
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
}

export async function enrollStudent(input) {
    return withTransaction(async (run) => {
        const inserted = await run(
            `INSERT INTO dbo.users (role, email, phone, emergency_contact, password_hash, name, name_en, nickname, nickname_en, age, education, education_en, genres, genres_en, reason, reason_en, language, avatar, consent_pdpa_at)
             OUTPUT INSERTED.*
             VALUES ('student', @email, @phone, @emergency, @hash, @name, @nameEn, @nickname, @nicknameEn, @age, @education, @educationEn, @genres, @genresEn, @reason, @reasonEn, @language, @avatar, SYSUTCDATETIME())`,
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
                education: input.education,
                educationEn: input.educationEn || (input.education ? educationEn(input.education) : null),
                genres: input.genres,
                genresEn: input.genresEn || null,
                reason: input.reason,
                reasonEn: input.reasonEn || null,
                language: input.language,
                avatar: input.avatar,
            },
        );
        const user = inserted.recordset[0];
        if (!user) {
            throw new Error('บันทึกผู้เรียนลงฐานข้อมูลไม่สำเร็จ');
        }
        await run(
            `INSERT INTO dbo.user_packages (user_id, package_id, hours_total, hours_used, expires_at, status)
             VALUES (@userId, N'trial', 1, 0, DATEADD(month, 2, SYSUTCDATETIME()), N'active')`,
            { userId: user.id },
        );
        const pkg = await run(
            `SELECT TOP 1 id FROM dbo.user_packages WHERE user_id = @userId ORDER BY id DESC`,
            { userId: user.id },
        );
        if (!pkg.recordset[0]?.id) {
            throw new Error('บันทึกชั่วโมงทดลองลงฐานข้อมูลไม่สำเร็จ');
        }
        await run(
            `INSERT INTO dbo.enrollments (public_id, user_id, package_id, hours_granted, status, source)
             VALUES (@enrollmentId, @userId, N'trial', 1, N'active', N'trial')`,
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
                     N'ยินดีต้อนรับ', N'สมัครเรียนสำเร็จ — มีชั่วโมงทดลอง 1 ชม. จองเวลาเรียนได้เลย',
                     N'Welcome', N'You are enrolled — you have 1 trial hour. Book your first lesson now.', N'blue')`,
            { userId: user.id },
        );
        return {
            user,
            enrollmentId: enrollment.recordset[0].public_id,
            hoursGranted: 1,
        };
    });
}

export async function createLessonBooking({ publicId, userId, dayIso, time, topic, topicEn, source, mode }) {
    return withTransaction(async (run) => {
        const pkgResult = await run(
            `SELECT TOP 1 up.id, up.hours_total, up.hours_used
             FROM dbo.user_packages up
             WHERE up.user_id = @userId AND up.status = N'active' AND up.expires_at > SYSUTCDATETIME()
             ORDER BY up.created_at DESC`,
            { userId },
        );
        const pkg = pkgResult.recordset[0];
        if (!pkg || Number(pkg.hours_total) - Number(pkg.hours_used) <= 0) {
            throw new Error('ชั่วโมงคงเหลือไม่พอ — กรุณาสมัครเรียนหรือซื้อแพ็กเกจก่อนจอง');
        }
        const teacherResult = await run(
            `SELECT TOP 1 id FROM dbo.users WHERE role = N'teacher' AND status = N'Y' ORDER BY id`,
        );
        const teacherId = teacherResult.recordset[0]?.id;
        if (!teacherId) {
            throw new Error('ยังไม่มีครูในระบบ');
        }
        const slotResult = await run(
            `SELECT id, status,
                    CONVERT(varchar(10), slot_date, 23) AS slot_iso,
                    CONVERT(varchar(5), slot_time, 108) AS slot_hhmm
             FROM dbo.teacher_availability WITH (UPDLOCK, ROWLOCK)
             WHERE teacher_id = @teacherId
               AND CONVERT(varchar(10), slot_date, 23) = @dayIso
               AND CONVERT(varchar(5), slot_time, 108) = @time`,
            { teacherId, dayIso, time },
        );
        const slot = slotResult.recordset[0];
        if (!slot) {
            throw new Error('ไม่พบสล็อตที่เลือก');
        }
        if (slot.status === 'closed') {
            throw new Error('ครูปิดสล็อตนี้แล้ว');
        }
        if (slot.status !== 'open') {
            throw new Error('สล็อตนี้ถูกจองแล้ว');
        }
        const booked = await run(
            `UPDATE dbo.teacher_availability
             SET status = N'booked'
             WHERE id = @slotId AND status = N'open'`,
            { slotId: slot.id },
        );
        if (!booked.rowsAffected?.[0]) {
            throw new Error('สล็อตนี้ถูกจองแล้ว');
        }
        const bookingSource = source === 'line' ? 'line' : 'web';
        const bookingMode = mode === 'online' ? 'online' : 'studio';
        const deadline = confirmDeadlineAt(slotStartAt(slot.slot_iso, slot.slot_hhmm), new Date());
        await run(
            `INSERT INTO dbo.bookings (public_id, user_id, slot_id, user_package_id, status, topic, topic_en, source, mode, confirm_deadline, updated_at)
             VALUES (@publicId, @userId, @slotId, @pkgId, N'pending', @topic, @topicEn, @source, @mode, @deadline, SYSUTCDATETIME())`,
            {
                publicId,
                userId,
                slotId: slot.id,
                pkgId: pkg.id,
                topic,
                topicEn,
                source: bookingSource,
                mode: bookingMode,
                deadline,
            },
        );
        const saved = await run(
            `SELECT public_id, status, slot_id, user_id FROM dbo.bookings WHERE public_id = @publicId`,
            { publicId },
        );
        const booking = saved.recordset[0];
        if (!booking) {
            throw new Error('บันทึกการจองเรียนลงฐานข้อมูลไม่สำเร็จ');
        }
        await run(
            `INSERT INTO dbo.notifications (public_id, user_id, title, body, title_en, body_en, tone)
             VALUES (CONCAT('N', REPLACE(CONVERT(varchar(36), NEWID()), '-', '')), @userId,
                     N'จองเวลาเรียนสำเร็จ', @bodyTh, N'Booking confirmed', @bodyEn, N'blue')`,
            {
                userId,
                bodyTh: `ล็อกสล็อตแล้ว — ระบบจะเตือนนัดก่อนเรียน 1 วัน`,
                bodyEn: 'The slot is locked — you will get a reminder 1 day before class.',
            },
        );
        return booking;
    });
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
        await run(
            `UPDATE dbo.teacher_availability SET status = @status WHERE id = @slotId`,
            { status: slotAfter === 'closed' ? 'closed' : 'open', slotId: booking.slot_id },
        );
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
         LEFT JOIN dbo.bookings b ON b.slot_id = s.id AND b.status IN (N'pending', N'confirmed', N'moved')
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

export async function listTeacherMonthSlots({ teacherId, start, end }) {
    return query(
        `SELECT s.id,
                CONVERT(varchar(10), s.slot_date, 23) AS slot_iso,
                CONVERT(varchar(5), s.slot_time, 108) AS slot_hhmm,
                s.status,
                b.public_id AS booking_id, b.status AS booking_status, b.topic, b.topic_en,
                u.nickname, u.nickname_en, u.name, u.name_en, u.id AS student_id
         FROM dbo.teacher_availability s
         LEFT JOIN dbo.bookings b ON b.slot_id = s.id AND b.status IN (N'pending', N'confirmed', N'moved')
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
