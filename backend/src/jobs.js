import { chipLabel, lessonTimeRange } from './lang.js';
import { parseIsoDate } from './dates.js';
import { hoursUntilSlot, shouldExpirePending, shouldSendDayBeforeReminder } from './bookingPolicy.js';
import { LOW_HOURS_THRESHOLD, packageHoursLeft } from './packagePolicy.js';
import { addNotification, cancelLessonBooking, findUserById, notifySlotTeacher, query, studentLabel } from './store.js';

export const jobState = {
    lastRunAt: null,
    lastResult: { expired: 0, reminded: 0, lowHours: 0 },
    enabled: true,
};

async function loadActiveLessons() {
    const result = await query(
        `SELECT b.id, b.public_id, b.user_id, b.slot_id, b.status, b.confirm_deadline, b.reminder_sent_at,
                CONVERT(varchar(10), s.slot_date, 23) AS slot_iso,
                CONVERT(varchar(5), s.slot_time, 108) AS slot_hhmm
         FROM dbo.bookings b
         JOIN dbo.teacher_availability s ON s.id = b.slot_id
         WHERE b.status IN (N'pending', N'confirmed')`,
    );
    return result.recordset;
}

export async function expireUnconfirmedBookings(now = new Date()) {
    const rows = await loadActiveLessons();
    let expired = 0;
    for (const row of rows) {
        if (!shouldExpirePending({
            status: row.status,
            confirmDeadline: row.confirm_deadline ? new Date(row.confirm_deadline) : null,
            now,
        })) {
            continue;
        }
        const booking = await cancelLessonBooking({
            bookingRowId: row.id,
            reason: 'confirm_expired',
            slotAfter: 'open',
        });
        const date = parseIsoDate(booking.slot_iso);
        await addNotification(
            booking.user_id,
            'หมดเวลายืนยันนัด',
            `นัด ${chipLabel(date, 'th')} ${lessonTimeRange(booking.slot_hhmm, 'th')} ถูกยกเลิกเพราะไม่ได้ยืนยันตามกำหนด — จองใหม่ได้เลย`,
            'pink',
            'Confirmation window closed',
            `Your lesson on ${chipLabel(date, 'en')} ${lessonTimeRange(booking.slot_hhmm, 'en')} was cancelled because it was not confirmed in time.`,
        );
        const student = await findUserById(booking.user_id);
        await notifySlotTeacher(
            booking.slot_id,
            'นัดหมดเวลาคอนเฟิร์ม',
            `${studentLabel(student, 'th')} ไม่ได้ยืนยัน ${chipLabel(date, 'th')} ${lessonTimeRange(booking.slot_hhmm, 'th')} — สล็อตว่างแล้ว`,
            'pink',
            'Confirmation expired',
            `${studentLabel(student, 'en')} did not confirm ${chipLabel(date, 'en')} ${lessonTimeRange(booking.slot_hhmm, 'en')} — the slot is open again`,
        );
        expired += 1;
    }
    return expired;
}

export async function sendDayBeforeReminders(now = new Date()) {
    const rows = await loadActiveLessons();
    let reminded = 0;
    for (const row of rows) {
        const hoursUntil = hoursUntilSlot(row.slot_iso, row.slot_hhmm, now);
        if (!shouldSendDayBeforeReminder({
            status: row.status,
            hoursUntil,
            reminderSentAt: row.reminder_sent_at,
        })) {
            continue;
        }
        const date = parseIsoDate(row.slot_iso);
        await addNotification(
            row.user_id,
            'เตือนนัดเรียนพรุ่งนี้',
            `นัด ${chipLabel(date, 'th')} ${lessonTimeRange(row.slot_hhmm, 'th')} — อย่าลืมมาเรียนนะครับ`,
            'blue',
            'Lesson reminder for tomorrow',
            `Your lesson is ${chipLabel(date, 'en')} ${lessonTimeRange(row.slot_hhmm, 'en')} — see you there.`,
        );
        const student = await findUserById(row.user_id);
        await notifySlotTeacher(
            row.slot_id,
            'เตือนคลาสพรุ่งนี้',
            `พรุ่งนี้ ${studentLabel(student, 'th')} ${chipLabel(date, 'th')} ${lessonTimeRange(row.slot_hhmm, 'th')}`,
            'blue',
            'Lesson tomorrow',
            `Tomorrow: ${studentLabel(student, 'en')} ${chipLabel(date, 'en')} ${lessonTimeRange(row.slot_hhmm, 'en')}`,
        );
        await query(
            `UPDATE dbo.bookings SET reminder_sent_at = SYSUTCDATETIME() WHERE id = @id AND reminder_sent_at IS NULL`,
            { id: row.id },
        );
        reminded += 1;
    }
    return reminded;
}

export async function sendLowHoursReminders() {
    const result = await query(
        `SELECT up.id, up.user_id, up.hours_total, up.hours_used
         FROM dbo.user_packages up
         JOIN dbo.users u ON u.id = up.user_id
         WHERE up.status = N'active'
           AND up.expires_at > SYSUTCDATETIME()
           AND up.low_hours_notified_at IS NULL
           AND (up.hours_total - up.hours_used) <= @threshold
           AND (up.hours_total - up.hours_used) > 0
           AND u.role = N'student'
           AND u.status = N'Y'`,
        { threshold: LOW_HOURS_THRESHOLD },
    );
    let notified = 0;
    for (const row of result.recordset) {
        const left = packageHoursLeft(row.hours_total, row.hours_used);
        await addNotification(
            row.user_id,
            'ชั่วโมงเรียนใกล้หมด',
            `เหลืออีก ${left} ชม. — ติดต่อครูแอร์เพื่อต่อคอร์สหรือซื้อแพ็กเกจ`,
            'pink',
            'Course hours running low',
            `${left} hour(s) left — contact Kru Air to renew or buy a package.`,
        );
        await query(
            `UPDATE dbo.user_packages SET low_hours_notified_at = SYSUTCDATETIME() WHERE id = @pkgId`,
            { pkgId: row.id },
        );
        notified += 1;
    }
    return notified;
}

export async function runSchoolJobs(now = new Date()) {
    const expired = await expireUnconfirmedBookings(now);
    const reminded = await sendDayBeforeReminders(now);
    const lowHours = await sendLowHoursReminders();
    jobState.lastRunAt = now.toISOString();
    jobState.lastResult = { expired, reminded, lowHours };
    return jobState.lastResult;
}
