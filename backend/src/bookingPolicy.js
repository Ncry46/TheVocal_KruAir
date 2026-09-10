export const SLOT_TIMES = [
    '10:00', '11:00', '12:00', '13:00', '14:00',
    '15:00', '16:00', '17:00', '18:00', '19:00',
];

export const CANCEL_MIN_HOURS = 24;
export const REMINDER_MIN_HOURS = 20;
export const REMINDER_MAX_HOURS = 28;
export const LAST_MINUTE_CONFIRM_GRACE_HOURS = 2;
export const DAY1_REMINDER_HOUR = 9;
export const DAY1_REMINDER_MINUTE = 0;
export const HOMEWORK_D3_REMINDER_HOUR = 9;
export const HOMEWORK_D3_REMINDER_MINUTE = 30;
/** Student sign-out allowed until this many minutes after lesson end. */
export const STUDENT_CHECKOUT_GRACE_MINUTES = 30;

export function slotStartAt(isoDate, hhmm) {
    const [year, month, day] = String(isoDate).split('-').map(Number);
    const [hour, minute] = String(hhmm).split(':').map(Number);
    return new Date(year, month - 1, day, hour, minute || 0, 0, 0);
}

export function lessonEndsAt(isoDate, hhmm, durationHours = 1) {
    const start = slotStartAt(isoDate, hhmm);
    const hours = Math.max(1, Number(durationHours) || 1);
    return new Date(start.getTime() + hours * 36e5);
}

export function studentCheckoutDeadlineAt(isoDate, hhmm, durationHours = 1) {
    const endsAt = lessonEndsAt(isoDate, hhmm, durationHours);
    return new Date(endsAt.getTime() + STUDENT_CHECKOUT_GRACE_MINUTES * 60e3);
}

/** Calendar date YYYY-MM-DD in Asia/Bangkok. */
export function bangkokDateIso(now = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(now);
}

export function bangkokDateTimeParts(now = new Date()) {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Bangkok',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }).formatToParts(now)
            .filter((part) => part.type !== 'literal')
            .map((part) => [part.type, part.value]),
    );
    return {
        date: `${parts.year}-${parts.month}-${parts.day}`,
        hour: Number(parts.hour),
        minute: Number(parts.minute),
    };
}

/** Add calendar days to YYYY-MM-DD without timezone drift. */
export function addCalendarDaysIso(isoDate, days) {
    const [year, month, day] = String(isoDate).split('-').map(Number);
    const utc = new Date(Date.UTC(year, month - 1, day));
    utc.setUTCDate(utc.getUTCDate() + Number(days));
    return utc.toISOString().slice(0, 10);
}

/**
 * Run a daily Bangkok job once after the target clock time (catch-up until noon).
 * Dedup with lastRunDate === today's Bangkok date.
 */
export function shouldRunBangkokDailyJob(now, { hour, minute }, lastRunDate) {
    const parts = bangkokDateTimeParts(now);
    if (lastRunDate === parts.date) {
        return false;
    }
    const current = parts.hour * 60 + parts.minute;
    const start = Number(hour) * 60 + Number(minute);
    const noon = 12 * 60;
    return current >= start && current < noon;
}

/** Sign allowed on the lesson's calendar day only (Asia/Bangkok). */
export function canSignLesson({ slotIso, now = new Date() }) {
    const lessonDay = String(slotIso || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lessonDay)) {
        return false;
    }
    return bangkokDateIso(now) === lessonDay;
}

/** Student sign-in: only during scheduled lesson time (start..end). */
export function canStudentCheckIn({ slotIso, slotHhmm, durationHours = 1, now = new Date() }) {
    const lessonDay = String(slotIso || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lessonDay)) {
        return false;
    }
    if (bangkokDateIso(now) !== lessonDay) {
        return false;
    }
    const startAt = slotStartAt(lessonDay, slotHhmm).getTime();
    const endsAt = lessonEndsAt(lessonDay, slotHhmm, durationHours).getTime();
    const t = now.getTime();
    return t >= startAt && t <= endsAt;
}

/** Student sign-out: from lesson end through +30 minutes grace. */
export function canStudentCheckOut({ slotIso, slotHhmm, durationHours = 1, now = new Date() }) {
    const lessonDay = String(slotIso || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lessonDay)) {
        return false;
    }
    if (bangkokDateIso(now) !== lessonDay) {
        return false;
    }
    const endsAt = lessonEndsAt(lessonDay, slotHhmm, durationHours).getTime();
    const deadline = studentCheckoutDeadlineAt(lessonDay, slotHhmm, durationHours).getTime();
    const t = now.getTime();
    return t >= endsAt && t <= deadline;
}

/** Teacher check-in: lesson day + at/after scheduled end. */
export function canTeacherCheckIn({ slotIso, slotHhmm, durationHours = 1, now = new Date() }) {
    const lessonDay = String(slotIso || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lessonDay)) {
        return false;
    }
    if (bangkokDateIso(now) !== lessonDay) {
        return false;
    }
    const endsAt = lessonEndsAt(lessonDay, slotHhmm, durationHours);
    return now.getTime() >= endsAt.getTime();
}

export function hoursUntilSlot(isoDate, hhmm, now = new Date()) {
    return (slotStartAt(isoDate, hhmm).getTime() - now.getTime()) / 36e5;
}

export function canStudentCancel({ status, hoursUntil }) {
    if (status !== 'pending' && status !== 'confirmed') {
        return false;
    }
    return Number(hoursUntil) >= CANCEL_MIN_HOURS;
}

export function confirmDeadlineAt(slotStart, bookedAt) {
    const deadline = new Date(slotStart.getTime() - CANCEL_MIN_HOURS * 36e5);
    if (deadline.getTime() <= bookedAt.getTime()) {
        return new Date(bookedAt.getTime() + LAST_MINUTE_CONFIRM_GRACE_HOURS * 36e5);
    }
    return deadline;
}

export function shouldExpirePending({ status, confirmDeadline, now }) {
    return status === 'pending' && Boolean(confirmDeadline) && now >= confirmDeadline;
}

/** @deprecated Prefer calendar day-1 job; kept for older hour-window callers/tests. */
export function shouldSendDayBeforeReminder({ status, hoursUntil, reminderSentAt }) {
    if (reminderSentAt) {
        return false;
    }
    if (status !== 'pending' && status !== 'confirmed') {
        return false;
    }
    return hoursUntil <= REMINDER_MAX_HOURS && hoursUntil >= REMINDER_MIN_HOURS;
}

export function isActiveLessonStatus(status) {
    return status === 'pending' || status === 'confirmed';
}

export function nextSlotStatus(current, action) {
    if (action === 'close' && (current === 'open' || current === 'booked')) {
        return 'closed';
    }
    if (action === 'open' && current === 'closed') {
        return 'open';
    }
    return null;
}

export function isAllowedSlotTime(time) {
    return SLOT_TIMES.includes(String(time));
}
