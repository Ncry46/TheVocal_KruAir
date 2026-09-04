import { SLOT_TIMES } from './bookingPolicy.js';
import { toIsoDate } from './dates.js';
import { createLessonBooking, query } from './store.js';

function makePublicId(prefix) {
    return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export async function ensureRecurringScheduleSchema() {
    await query(`
        IF OBJECT_ID(N'dbo.student_recurring_schedules', N'U') IS NULL
        CREATE TABLE dbo.student_recurring_schedules (
            id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_student_recurring_schedules PRIMARY KEY,
            public_id NVARCHAR(40) NOT NULL,
            user_id INT NOT NULL,
            teacher_id INT NOT NULL,
            weekday TINYINT NOT NULL,
            slot_time TIME NOT NULL,
            duration_hours INT NOT NULL CONSTRAINT DF_srs_hours DEFAULT 1,
            mode NVARCHAR(20) NOT NULL CONSTRAINT DF_srs_mode DEFAULT N'studio',
            is_active NVARCHAR(1) NOT NULL CONSTRAINT DF_srs_active DEFAULT N'Y',
            created_by INT NOT NULL,
            created_at DATETIME2 NOT NULL CONSTRAINT DF_srs_created DEFAULT SYSUTCDATETIME(),
            updated_at DATETIME2 NOT NULL CONSTRAINT DF_srs_updated DEFAULT SYSUTCDATETIME(),
            CONSTRAINT FK_srs_user FOREIGN KEY (user_id) REFERENCES dbo.users (id),
            CONSTRAINT FK_srs_teacher FOREIGN KEY (teacher_id) REFERENCES dbo.users (id),
            CONSTRAINT FK_srs_creator FOREIGN KEY (created_by) REFERENCES dbo.users (id)
        );
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_srs_public' AND object_id = OBJECT_ID(N'dbo.student_recurring_schedules'))
            CREATE UNIQUE INDEX UX_srs_public ON dbo.student_recurring_schedules (public_id);
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_srs_user_active' AND object_id = OBJECT_ID(N'dbo.student_recurring_schedules'))
            CREATE INDEX IX_srs_user_active ON dbo.student_recurring_schedules (user_id, is_active);
    `);
}

export async function listRecurringSchedules(userId) {
    await ensureRecurringScheduleSchema();
    const result = await query(
        `SELECT public_id, weekday,
                CONVERT(varchar(5), slot_time, 108) AS slot_hhmm,
                duration_hours, mode, is_active, created_at
         FROM dbo.student_recurring_schedules
         WHERE user_id = @userId AND is_active = N'Y'
         ORDER BY weekday, slot_time`,
        { userId },
    );
    return result.recordset.map((row) => ({
        id: row.public_id,
        weekday: Number(row.weekday),
        time: row.slot_hhmm,
        hours: Number(row.duration_hours) || 1,
        mode: row.mode === 'online' ? 'online' : 'studio',
        createdAt: row.created_at,
    }));
}

export async function createRecurringSchedule({
    userId,
    teacherId,
    createdBy,
    weekday,
    time,
    hours = 1,
    mode = 'studio',
}) {
    await ensureRecurringScheduleSchema();
    const day = Number(weekday);
    if (!Number.isInteger(day) || day < 0 || day > 6) {
        throw new Error('กรุณาเลือกวันในสัปดาห์');
    }
    if (!SLOT_TIMES.includes(String(time))) {
        throw new Error('เวลาเริ่มใช้ได้ 10:00–19:00 น. เท่านั้น');
    }
    const duration = Number(hours) || 1;
    if (!Number.isInteger(duration) || duration < 1) {
        throw new Error('จำนวนชั่วโมงต้องเป็นจำนวนเต็มอย่างน้อย 1');
    }
    const publicIdValue = makePublicId('rs-');
    await query(
        `INSERT INTO dbo.student_recurring_schedules
            (public_id, user_id, teacher_id, weekday, slot_time, duration_hours, mode, created_by)
         VALUES (@publicId, @userId, @teacherId, @weekday, @time, @hours, @mode, @createdBy)`,
        {
            publicId: publicIdValue,
            userId,
            teacherId,
            weekday: day,
            time: String(time),
            hours: duration,
            mode: mode === 'online' ? 'online' : 'studio',
            createdBy,
        },
    );
    return { id: publicIdValue };
}

export async function deleteRecurringSchedule(publicId, teacherId) {
    await ensureRecurringScheduleSchema();
    const found = await query(
        `SELECT id FROM dbo.student_recurring_schedules
         WHERE public_id = @id AND teacher_id = @teacherId AND is_active = N'Y'`,
        { id: publicId, teacherId },
    );
    if (!found.recordset[0]) {
        throw new Error('ไม่พบตารางประจำที่เลือก');
    }
    await query(
        `UPDATE dbo.student_recurring_schedules
         SET is_active = N'N', updated_at = SYSUTCDATETIME()
         WHERE public_id = @id`,
        { id: publicId },
    );
}

function nextOccurrences(weekday, count, fromDate = new Date()) {
    const results = [];
    const cursor = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
    let guard = 0;
    while (results.length < count && guard < 60) {
        if (cursor.getDay() === weekday) {
            results.push(toIsoDate(cursor));
        }
        cursor.setDate(cursor.getDate() + 1);
        guard += 1;
    }
    return results;
}

/**
 * Generate up to `weeks` occurrences per active rule, chronologically,
 * stopping when remaining hours are insufficient.
 */
export async function generateRecurringBookings({
    userId,
    teacherId,
    weeks = 4,
}) {
    await ensureRecurringScheduleSchema();
    const rules = await listRecurringSchedules(userId);
    if (!rules.length) {
        return { created: [], skipped: [], message: 'ยังไม่มีตารางประจำ' };
    }

    const candidates = [];
    for (const rule of rules) {
        for (const dayIso of nextOccurrences(rule.weekday, weeks)) {
            candidates.push({
                dayIso,
                time: rule.time,
                hours: rule.hours,
                mode: rule.mode,
                ruleId: rule.id,
            });
        }
    }
    candidates.sort((a, b) => `${a.dayIso}T${a.time}`.localeCompare(`${b.dayIso}T${b.time}`));

    const created = [];
    const skipped = [];

    for (const item of candidates) {
        try {
            const booking = await createLessonBooking({
                publicId: makePublicId('L'),
                userId,
                dayIso: item.dayIso,
                time: item.time,
                topic: 'เรียนประจำรายสัปดาห์',
                topicEn: 'Weekly recurring lesson',
                source: 'teacher',
                mode: item.mode,
                durationHours: item.hours,
                teacherId,
                createdByTeacher: true,
            });
            created.push({
                id: booking.public_id,
                day: item.dayIso,
                time: item.time,
                hours: item.hours,
                ruleId: item.ruleId,
            });
        }
        catch (err) {
            skipped.push({
                day: item.dayIso,
                time: item.time,
                hours: item.hours,
                ruleId: item.ruleId,
                reason: err instanceof Error ? err.message : 'ข้าม',
            });
            if (/ชั่วโมงคงเหลือ/i.test(String(err?.message || ''))) {
                break;
            }
        }
    }

    return { created, skipped };
}
