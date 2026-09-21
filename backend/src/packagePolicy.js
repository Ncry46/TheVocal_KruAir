export const LOW_HOURS_THRESHOLD = 2;

const DEFAULT_LESSON_NOTES = new Set([
    'บันทึกโดยครูแอร์',
    '—',
]);

export function packageHoursLeft(hoursTotal, hoursUsed) {
    return Math.max(0, Number(hoursTotal) - Number(hoursUsed));
}

export function shouldNotifyLowHours(previousLeft, newLeft) {
    const prev = Number(previousLeft);
    const next = Number(newLeft);
    if (next <= 0) {
        return prev > 0;
    }
    return prev > LOW_HOURS_THRESHOLD && next <= LOW_HOURS_THRESHOLD;
}

/** Days since hours hit zero (Bangkok calendar days). Null if still has hours or unknown. */
export function daysSinceHoursDepleted(depletedAt, now = new Date()) {
    if (!depletedAt) {
        return null;
    }
    const start = new Date(depletedAt);
    if (Number.isNaN(start.getTime())) {
        return null;
    }
    const ms = now.getTime() - start.getTime();
    if (ms < 0) {
        return 0;
    }
    return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export function isHomeworkNote(note) {
    const trimmed = String(note || '').trim();
    if (!trimmed) {
        return false;
    }
    return !DEFAULT_LESSON_NOTES.has(trimmed);
}
