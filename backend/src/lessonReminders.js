import { parseIsoDate } from './dates.js';
import { flexLessonReminder } from './lineFlex.js';
import { liffUrl } from './lineLiff.js';
import { chipLabel, lessonTimeRange, pick } from './lang.js';
import { findLineUserIdForAppUser, pushLineMessages } from './lineMessaging.js';
import {
    activePackage,
    addNotification,
    findUserById,
    notifySlotTeacher,
    packageStatusFromRow,
    query,
    studentLabel,
} from './store.js';

export async function deliverDayBeforeReminder(row) {
    const date = parseIsoDate(row.slot_iso);
    const dateLabelTh = chipLabel(date, 'th');
    const dateLabelEn = chipLabel(date, 'en');
    const timeLabelTh = lessonTimeRange(row.slot_hhmm, 'th');
    const timeLabelEn = lessonTimeRange(row.slot_hhmm, 'en');

    await addNotification(
        row.user_id,
        'เตือนนัดเรียนพรุ่งนี้',
        `นัด ${dateLabelTh} ${timeLabelTh} — อย่าลืมมาเรียนนะครับ`,
        'blue',
        'Lesson reminder for tomorrow',
        `Your lesson is ${dateLabelEn} ${timeLabelEn} — see you there.`,
        '/app',
        { skipLinePush: true },
    );

    try {
        const lineUserId = await findLineUserIdForAppUser(row.user_id, query);
        if (lineUserId) {
            const teacher = row.teacher_id ? await findUserById(row.teacher_id) : null;
            const teacherLabel = teacher
                ? `${pick(teacher, 'nickname', 'th')} (${pick(teacher, 'name', 'th')})`
                : 'ครูแอร์';
            const pkg = packageStatusFromRow(await activePackage(row.user_id), 'th');
            const flex = flexLessonReminder({
                dateLabel: dateLabelTh,
                timeLabel: timeLabelTh,
                teacherLabel,
                pkgLabel: `เหลือ ${pkg.left} ชม.`,
                bookingId: row.public_id,
                liffBookingUrl: liffUrl('/app') || liffUrl('/'),
                lang: 'th',
            });
            await pushLineMessages(lineUserId, [flex]);
        }
    }
    catch (err) {
        console.error('LINE lesson reminder push failed:', err instanceof Error ? err.message : err);
    }

    const student = await findUserById(row.user_id);
    await notifySlotTeacher(
        row.slot_id,
        'เตือนคลาสพรุ่งนี้',
        `พรุ่งนี้ ${studentLabel(student, 'th')} ${dateLabelTh} ${timeLabelTh}`,
        'blue',
        'Lesson tomorrow',
        `Tomorrow: ${studentLabel(student, 'en')} ${dateLabelEn} ${timeLabelEn}`,
    );
}
