export const SLOT_TIMES = [
    '10:00', '11:00', '12:00', '13:00', '14:00',
    '15:00', '16:00', '17:00', '18:00', '19:00',
];

export const CANCEL_MIN_HOURS = 24;
export const REMINDER_MIN_HOURS = 20;
export const REMINDER_MAX_HOURS = 28;
export const LAST_MINUTE_CONFIRM_GRACE_HOURS = 2;

export function slotStartAt(isoDate, hhmm) {
    const [year, month, day] = String(isoDate).split('-').map(Number);
    const [hour, minute] = String(hhmm).split(':').map(Number);
    return new Date(year, month - 1, day, hour, minute || 0, 0, 0);
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

export function shouldSendDayBeforeReminder({ status, hoursUntil, reminderSentAt }) {
    if (reminderSentAt) {
        return false;
    }
    if (status !== 'pending' && status !== 'confirmed') {
        return false;
    }
    return hoursUntil <= REMINDER_MAX_HOURS && hoursUntil >= REMINDER_MIN_HOURS;
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
