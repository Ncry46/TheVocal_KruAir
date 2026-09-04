import { chipLabel, lessonTimeRange, pick } from './lang.js';
import { parseIsoDate, plusOneHour } from './dates.js';
import { canStudentCancel, hoursUntilSlot } from './bookingPolicy.js';
import {
    activePackage,
    addNotification,
    cancelLessonBooking,
    findUserById,
    findUserByLineUserId,
    notifySlotTeacher,
    packageStatusFromRow,
    query,
    studentLabel,
} from './store.js';
import { flexContact, flexHistory, flexPackageStatus, flexPostbackResult } from './lineFlex.js';
import { liffUrl } from './lineLiff.js';
import { replyLineMessages } from './lineMessaging.js';

export function parsePostbackData(raw) {
    const value = String(raw || '').trim();
    const [action, arg] = value.split('|');
    return { action: action || value, arg: arg || null };
}

async function loadLessonForLineUser(bookingPublicId, userId) {
    const found = await query(
        `SELECT b.*, CONVERT(varchar(10), s.slot_date, 23) AS slot_iso, CONVERT(varchar(5), s.slot_time, 108) AS slot_hhmm
         FROM dbo.bookings b
         JOIN dbo.teacher_availability s ON s.id = b.slot_id
         WHERE b.public_id = @id AND b.user_id = @userId`,
        { id: bookingPublicId, userId },
    );
    const lesson = found.recordset[0];
    if (!lesson) {
        throw new Error('ไม่พบคลาสที่เลือก');
    }
    return lesson;
}

async function loadHistoryRows(userId, lang = 'th') {
    const result = await query(
        `SELECT TOP 5 cl.lesson_title, cl.lesson_title_en, cl.outcome,
                CONVERT(varchar(10), s.slot_date, 23) AS slot_iso,
                CONVERT(varchar(5), s.slot_time, 108) AS slot_hhmm
         FROM dbo.class_logs cl
         JOIN dbo.bookings b ON b.id = cl.booking_id
         JOIN dbo.teacher_availability s ON s.id = b.slot_id
         WHERE cl.user_id = @userId
         ORDER BY cl.created_at DESC`,
        { userId },
    );
    return result.recordset.map((row) => {
        const date = parseIsoDate(row.slot_iso);
        const noShow = lang === 'en' ? 'No-show' : 'No-show (ไม่มาเรียน)';
        return {
            date: chipLabel(date, lang),
            time: `${row.slot_hhmm}–${plusOneHour(row.slot_hhmm)}`,
            lesson: row.outcome === 'no_show' ? noShow : pick(row, 'lesson_title', lang),
        };
    });
}

async function confirmLesson(userId, bookingPublicId, lang = 'th') {
    const lesson = await loadLessonForLineUser(bookingPublicId, userId);
    if (lesson.status !== 'pending') {
        throw new Error(lang === 'en' ? 'This lesson is already confirmed or cancelled.' : 'นัดนี้ยืนยันแล้วหรือยกเลิกไปแล้ว');
    }
    await query(
        `UPDATE dbo.bookings SET status = N'confirmed', confirmed_at = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME() WHERE id = @id AND status = N'pending'`,
        { id: lesson.id },
    );
    const date = parseIsoDate(lesson.slot_iso);
    await addNotification(
        userId,
        'ยืนยันนัดเรียนแล้ว',
        `ยืนยันการมาเรียน ${chipLabel(date, 'th')} ${lessonTimeRange(lesson.slot_hhmm, 'th')} เรียบร้อย — แล้วพบกันนะครับ`,
        'green',
        'Attendance confirmed',
        `Confirmed for ${chipLabel(date, 'en')} ${lessonTimeRange(lesson.slot_hhmm, 'en')} — see you soon.`,
    );
    const student = await findUserById(userId);
    await notifySlotTeacher(
        lesson.slot_id,
        'นักเรียนยืนยันนัดแล้ว',
        `${studentLabel(student, 'th')} ยืนยัน ${chipLabel(date, 'th')} ${lessonTimeRange(lesson.slot_hhmm, 'th')}`,
        'green',
        'Student confirmed attendance',
        `${studentLabel(student, 'en')} confirmed ${chipLabel(date, 'en')} ${lessonTimeRange(lesson.slot_hhmm, 'en')}`,
    );
    return lang === 'en'
        ? `Confirmed for ${chipLabel(date, 'en')} ${lessonTimeRange(lesson.slot_hhmm, 'en')} — see you soon!`
        : `ยืนยันนัด ${chipLabel(date, 'th')} ${lessonTimeRange(lesson.slot_hhmm, 'th')} แล้ว — แล้วพบกันนะครับ`;
}

async function cancelLesson(userId, bookingPublicId, lang = 'th') {
    const lesson = await loadLessonForLineUser(bookingPublicId, userId);
    const hoursUntil = hoursUntilSlot(lesson.slot_iso, lesson.slot_hhmm);
    if (!canStudentCancel({ status: lesson.status, hoursUntil })) {
        throw new Error(lang === 'en'
            ? 'Cancel at least 24 hours before the lesson — contact Kru Air.'
            : 'ยกเลิกได้น้อยกว่า 24 ชม.ก่อนเรียน กรุณาติดต่อครูแอร์');
    }
    const booking = await cancelLessonBooking({
        bookingRowId: lesson.id,
        reason: 'student_cancel',
        slotAfter: 'open',
    });
    const date = parseIsoDate(booking.slot_iso);
    await addNotification(
        userId,
        'ยกเลิกนัดเรียนแล้ว',
        `ยกเลิกนัด ${chipLabel(date, 'th')} ${lessonTimeRange(booking.slot_hhmm, 'th')} แล้ว — ชั่วโมงยังไม่ถูกหัก จองใหม่ได้เลย`,
        'blue',
        'Lesson cancelled',
        `Cancelled ${chipLabel(date, 'en')} ${lessonTimeRange(booking.slot_hhmm, 'en')} — hours were not deducted.`,
    );
    const student = await findUserById(userId);
    await notifySlotTeacher(
        booking.slot_id,
        'นักเรียนยกเลิกนัด',
        `${studentLabel(student, 'th')} ยกเลิก ${chipLabel(date, 'th')} ${lessonTimeRange(booking.slot_hhmm, 'th')} — สล็อตว่างแล้ว`,
        'pink',
        'Student cancelled a lesson',
        `${studentLabel(student, 'en')} cancelled ${chipLabel(date, 'en')} ${lessonTimeRange(booking.slot_hhmm, 'en')} — the slot is open again`,
    );
    return lang === 'en'
        ? `Cancelled ${chipLabel(date, 'en')} ${lessonTimeRange(booking.slot_hhmm, 'en')}. Hours were not deducted.`
        : `ยกเลิกนัด ${chipLabel(date, 'th')} ${lessonTimeRange(booking.slot_hhmm, 'th')} แล้ว — ชั่วโมงยังไม่ถูกหัก`;
}

export async function handleLinePostback({ lineUserId, data, replyToken, lang = 'th' }) {
    const { action, arg } = parsePostbackData(data);
    const user = await findUserByLineUserId(lineUserId);
    if (!user && action !== 'CONTACT') {
        const registerUrl = liffUrl('/register') || '/register';
        const message = lang === 'en'
            ? `Please register or link your account first:\n${registerUrl}`
            : `กรุณาสมัครสมาชิกหรือเชื่อมบัญชีก่อน:\n${registerUrl}`;
        await replyLineMessages(replyToken, [flexPostbackResult(message, lang)]);
        return;
    }

    if (action === 'MY_HOURS') {
        const pkg = packageStatusFromRow(await activePackage(user.id), lang);
        await replyLineMessages(replyToken, [flexPackageStatus(pkg, lang)]);
        return;
    }

    if (action === 'MY_HISTORY') {
        const rows = await loadHistoryRows(user.id, lang);
        await replyLineMessages(replyToken, [flexHistory(rows, lang)]);
        return;
    }

    if (action === 'CONTACT') {
        await replyLineMessages(replyToken, [flexContact(lang)]);
        return;
    }

    if (action === 'CONFIRM' && arg) {
        try {
            const message = await confirmLesson(user.id, arg, lang);
            await replyLineMessages(replyToken, [flexPostbackResult(message, lang)]);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
            await replyLineMessages(replyToken, [flexPostbackResult(message, lang)]);
        }
        return;
    }

    if (action === 'CANCEL' && arg) {
        try {
            const message = await cancelLesson(user.id, arg, lang);
            await replyLineMessages(replyToken, [flexPostbackResult(message, lang)]);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
            await replyLineMessages(replyToken, [flexPostbackResult(message, lang)]);
        }
        return;
    }

    if (action === 'MOVE' && arg) {
        const bookingUrl = liffUrl(`/app/booking?move=${encodeURIComponent(arg)}`) || '/app/booking';
        const message = lang === 'en'
            ? `Open the booking page to choose a new slot:\n${bookingUrl}`
            : `เปิดหน้าจองเพื่อเลือกวัน-เวลาใหม่:\n${bookingUrl}`;
        await replyLineMessages(replyToken, [flexPostbackResult(message, lang)]);
        return;
    }

    const fallback = lang === 'en' ? 'Unknown menu action.' : 'ไม่รู้จักคำสั่งนี้';
    await replyLineMessages(replyToken, [flexPostbackResult(fallback, lang)]);
}
