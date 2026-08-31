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

export function isHomeworkNote(note) {
    const trimmed = String(note || '').trim();
    if (!trimmed) {
        return false;
    }
    return !DEFAULT_LESSON_NOTES.has(trimmed);
}
