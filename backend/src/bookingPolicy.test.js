import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    canSignLesson,
    canStudentCheckIn,
    canStudentCheckOut,
    canTeacherCheckIn,
    canStudentCancel,
    confirmDeadlineAt,
    hoursUntilSlot,
    isAllowedSlotTime,
    lessonEndsAt,
    nextSlotStatus,
    shouldExpirePending,
    shouldSendDayBeforeReminder,
    shouldRunBangkokDailyJob,
    addCalendarDaysIso,
    slotStartAt,
} from './bookingPolicy.js';

describe('slotStartAt / hoursUntilSlot', () => {
    it('builds a local datetime from date and time', () => {
        const start = slotStartAt('2026-08-22', '17:00');
        assert.equal(start.getFullYear(), 2026);
        assert.equal(start.getMonth(), 7);
        assert.equal(start.getDate(), 22);
        assert.equal(start.getHours(), 17);
    });

    it('returns hours remaining until the slot', () => {
        const now = new Date(2026, 7, 21, 17, 0, 0);
        assert.equal(hoursUntilSlot('2026-08-22', '17:00', now), 24);
    });
});

describe('lessonEndsAt / canSignLesson', () => {
    it('ends one hour after start by default', () => {
        const end = lessonEndsAt('2026-09-04', '14:00', 1);
        assert.equal(end.getHours(), 15);
        assert.equal(end.getMinutes(), 0);
    });

    it('uses multi-hour duration', () => {
        const end = lessonEndsAt('2026-09-04', '14:00', 2);
        assert.equal(end.getHours(), 16);
    });

    it('allows signing only on the lesson calendar day', () => {
        const before = new Date('2026-09-03T17:00:00+07:00');
        const onDayMorning = new Date('2026-09-04T00:30:00+07:00');
        const after = new Date('2026-09-05T10:00:00+07:00');
        assert.equal(canSignLesson({ slotIso: '2026-09-04', now: before }), false);
        assert.equal(canSignLesson({ slotIso: '2026-09-04', now: onDayMorning }), true);
        assert.equal(canSignLesson({ slotIso: '2026-09-04', now: after }), false);
    });
});

describe('student cancel', () => {
    it('allows cancel 24 hours or more before class', () => {
        assert.equal(canStudentCancel({ status: 'pending', hoursUntil: 24 }), true);
        assert.equal(canStudentCancel({ status: 'confirmed', hoursUntil: 48 }), true);
    });

    it('blocks cancel inside 24 hours', () => {
        assert.equal(canStudentCancel({ status: 'pending', hoursUntil: 23.9 }), false);
        assert.equal(canStudentCancel({ status: 'confirmed', hoursUntil: 6 }), false);
    });

    it('blocks cancel for moved, done, or cancelled bookings', () => {
        assert.equal(canStudentCancel({ status: 'moved', hoursUntil: 48 }), false);
        assert.equal(canStudentCancel({ status: 'done', hoursUntil: 48 }), false);
        assert.equal(canStudentCancel({ status: 'cancelled', hoursUntil: 48 }), false);
    });
});

describe('confirm deadline', () => {
    it('is 24 hours before class when booked early', () => {
        const slotStart = slotStartAt('2026-08-22', '17:00');
        const bookedAt = new Date(2026, 7, 19, 10, 0, 0);
        const deadline = confirmDeadlineAt(slotStart, bookedAt);
        assert.equal(deadline.getTime(), slotStartAt('2026-08-21', '17:00').getTime());
    });

    it('gives 2 hours grace when booked inside the 24-hour window', () => {
        const slotStart = slotStartAt('2026-08-22', '17:00');
        const bookedAt = new Date(2026, 7, 22, 8, 0, 0);
        const deadline = confirmDeadlineAt(slotStart, bookedAt);
        assert.equal(deadline.getTime(), new Date(2026, 7, 22, 10, 0, 0).getTime());
    });
});

describe('expire unconfirmed bookings', () => {
    it('expires pending bookings after the deadline', () => {
        const now = new Date(2026, 7, 21, 18, 0, 0);
        assert.equal(shouldExpirePending({
            status: 'pending',
            confirmDeadline: new Date(2026, 7, 21, 17, 0, 0),
            now,
        }), true);
    });

    it('does not expire confirmed bookings or those still inside the window', () => {
        const now = new Date(2026, 7, 21, 16, 0, 0);
        assert.equal(shouldExpirePending({
            status: 'pending',
            confirmDeadline: new Date(2026, 7, 21, 17, 0, 0),
            now,
        }), false);
        assert.equal(shouldExpirePending({
            status: 'confirmed',
            confirmDeadline: new Date(2026, 7, 21, 10, 0, 0),
            now,
        }), false);
    });
});

describe('canTeacherCheckIn', () => {
    it('allows check-in only on lesson day after end time', () => {
        const beforeEnd = new Date(2026, 8, 7, 14, 30, 0);
        const afterEnd = new Date(2026, 8, 7, 15, 0, 0);
        const nextDay = new Date(2026, 8, 8, 16, 0, 0);
        assert.equal(canTeacherCheckIn({
            slotIso: '2026-09-07',
            slotHhmm: '14:00',
            durationHours: 1,
            now: beforeEnd,
        }), false);
        assert.equal(canTeacherCheckIn({
            slotIso: '2026-09-07',
            slotHhmm: '14:00',
            durationHours: 1,
            now: afterEnd,
        }), true);
        assert.equal(canTeacherCheckIn({
            slotIso: '2026-09-07',
            slotHhmm: '14:00',
            durationHours: 1,
            now: nextDay,
        }), false);
    });
});

describe('canStudentCheckIn / canStudentCheckOut', () => {
    it('allows student check-in only during lesson time', () => {
        const beforeStart = new Date(2026, 8, 7, 13, 59, 0);
        const atStart = new Date(2026, 8, 7, 14, 0, 0);
        const midLesson = new Date(2026, 8, 7, 14, 30, 0);
        const atEnd = new Date(2026, 8, 7, 15, 0, 0);
        const afterEnd = new Date(2026, 8, 7, 15, 1, 0);
        assert.equal(canStudentCheckIn({
            slotIso: '2026-09-07',
            slotHhmm: '14:00',
            durationHours: 1,
            now: beforeStart,
        }), false);
        assert.equal(canStudentCheckIn({
            slotIso: '2026-09-07',
            slotHhmm: '14:00',
            durationHours: 1,
            now: atStart,
        }), true);
        assert.equal(canStudentCheckIn({
            slotIso: '2026-09-07',
            slotHhmm: '14:00',
            durationHours: 1,
            now: midLesson,
        }), true);
        assert.equal(canStudentCheckIn({
            slotIso: '2026-09-07',
            slotHhmm: '14:00',
            durationHours: 1,
            now: atEnd,
        }), true);
        assert.equal(canStudentCheckIn({
            slotIso: '2026-09-07',
            slotHhmm: '14:00',
            durationHours: 1,
            now: afterEnd,
        }), false);
    });

    it('allows student check-out from end through 30-minute grace', () => {
        const beforeEnd = new Date(2026, 8, 7, 14, 30, 0);
        const atEnd = new Date(2026, 8, 7, 15, 0, 0);
        const withinGrace = new Date(2026, 8, 7, 15, 30, 0);
        const afterGrace = new Date(2026, 8, 7, 15, 31, 0);
        assert.equal(canStudentCheckOut({
            slotIso: '2026-09-07',
            slotHhmm: '14:00',
            durationHours: 1,
            now: beforeEnd,
        }), false);
        assert.equal(canStudentCheckOut({
            slotIso: '2026-09-07',
            slotHhmm: '14:00',
            durationHours: 1,
            now: atEnd,
        }), true);
        assert.equal(canStudentCheckOut({
            slotIso: '2026-09-07',
            slotHhmm: '14:00',
            durationHours: 1,
            now: withinGrace,
        }), true);
        assert.equal(canStudentCheckOut({
            slotIso: '2026-09-07',
            slotHhmm: '14:00',
            durationHours: 1,
            now: afterGrace,
        }), false);
    });
});

describe('1-day reminder (legacy hour window)', () => {
    it('sends when class is about 1 day away and not yet reminded', () => {
        assert.equal(shouldSendDayBeforeReminder({
            status: 'confirmed',
            hoursUntil: 24,
            reminderSentAt: null,
        }), true);
        assert.equal(shouldSendDayBeforeReminder({
            status: 'pending',
            hoursUntil: 20,
            reminderSentAt: null,
        }), true);
    });

    it('skips already reminded, too early, too late, or inactive bookings', () => {
        assert.equal(shouldSendDayBeforeReminder({
            status: 'confirmed',
            hoursUntil: 24,
            reminderSentAt: new Date(2026, 7, 21, 10, 0, 0),
        }), false);
        assert.equal(shouldSendDayBeforeReminder({
            status: 'confirmed',
            hoursUntil: 48,
            reminderSentAt: null,
        }), false);
        assert.equal(shouldSendDayBeforeReminder({
            status: 'confirmed',
            hoursUntil: 6,
            reminderSentAt: null,
        }), false);
        assert.equal(shouldSendDayBeforeReminder({
            status: 'cancelled',
            hoursUntil: 24,
            reminderSentAt: null,
        }), false);
    });
});

describe('bangkok daily reminder schedule', () => {
    it('adds calendar days without drift', () => {
        assert.equal(addCalendarDaysIso('2026-09-07', 1), '2026-09-08');
        assert.equal(addCalendarDaysIso('2026-09-07', 3), '2026-09-10');
        assert.equal(addCalendarDaysIso('2026-12-31', 1), '2027-01-01');
    });

    it('runs day-1 job after 09:00 Bangkok until noon once per day', () => {
        const morning = new Date('2026-09-07T02:05:00.000Z'); // 09:05 Bangkok
        assert.equal(shouldRunBangkokDailyJob(morning, { hour: 9, minute: 0 }, null), true);
        assert.equal(shouldRunBangkokDailyJob(morning, { hour: 9, minute: 0 }, '2026-09-07'), false);

        const tooEarly = new Date('2026-09-07T01:30:00.000Z'); // 08:30 Bangkok
        assert.equal(shouldRunBangkokDailyJob(tooEarly, { hour: 9, minute: 0 }, null), false);

        const homeworkSlot = new Date('2026-09-07T02:35:00.000Z'); // 09:35 Bangkok
        assert.equal(shouldRunBangkokDailyJob(homeworkSlot, { hour: 9, minute: 30 }, null), true);
        assert.equal(shouldRunBangkokDailyJob(homeworkSlot, { hour: 9, minute: 30 }, '2026-09-07'), false);
    });
});

describe('teacher slot status', () => {
    it('closes open or booked slots and reopens closed slots', () => {
        assert.equal(nextSlotStatus('open', 'close'), 'closed');
        assert.equal(nextSlotStatus('booked', 'close'), 'closed');
        assert.equal(nextSlotStatus('closed', 'open'), 'open');
        assert.equal(nextSlotStatus('open', 'open'), null);
        assert.equal(nextSlotStatus('booked', 'open'), null);
    });

    it('only allows teaching hours 10:00–19:00', () => {
        assert.equal(isAllowedSlotTime('10:00'), true);
        assert.equal(isAllowedSlotTime('19:00'), true);
        assert.equal(isAllowedSlotTime('09:00'), false);
        assert.equal(isAllowedSlotTime('20:00'), false);
        assert.equal(isAllowedSlotTime('17:30'), false);
    });
});
