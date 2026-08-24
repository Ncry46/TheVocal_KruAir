import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    canStudentCancel,
    confirmDeadlineAt,
    hoursUntilSlot,
    isAllowedSlotTime,
    nextSlotStatus,
    shouldExpirePending,
    shouldSendDayBeforeReminder,
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

describe('1-day reminder', () => {
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
