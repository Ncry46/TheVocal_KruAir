function pad(n) {
    return String(n).padStart(2, '0');
}

function toGoogleUtc(date) {
    return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

export function buildGoogleCalendarUrl({
    title,
    startDate,
    startTime,
    durationHours = 1,
    details = '',
    location = 'The Vocal · Kru Air',
}) {
    const [year, month, day] = String(startDate).split('-').map(Number);
    const [hour, minute] = String(startTime).split(':').map(Number);
    const start = new Date(Date.UTC(year, month - 1, day, hour - 7, minute));
    const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);
    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: title,
        dates: `${toGoogleUtc(start)}/${toGoogleUtc(end)}`,
        details,
        location,
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildIcsEvent({
    uid,
    title,
    startDate,
    startTime,
    durationHours = 1,
    details = '',
    location = 'The Vocal · Kru Air',
}) {
    const [year, month, day] = String(startDate).split('-').map(Number);
    const [hour, minute] = String(startTime).split(':').map(Number);
    const start = new Date(Date.UTC(year, month - 1, day, hour - 7, minute));
    const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);
    const stamp = toGoogleUtc(new Date());
    return [
        'BEGIN:VEVENT',
        `UID:${uid}@thevocal-kruair`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${toGoogleUtc(start)}`,
        `DTEND:${toGoogleUtc(end)}`,
        `SUMMARY:${title.replace(/\n/g, ' ')}`,
        `DESCRIPTION:${details.replace(/\n/g, ' ')}`,
        `LOCATION:${location}`,
        'END:VEVENT',
    ].join('\r\n');
}

export function buildIcsCalendar(events) {
    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//The Vocal Kru Air//Calendar//EN',
        'CALSCALE:GREGORIAN',
        ...events,
        'END:VCALENDAR',
    ].join('\r\n');
}

export async function calendarLinkForBooking(booking, lang = 'th') {
    const title = lang === 'en'
        ? (booking.topic_en || booking.topic || 'Vocal lesson with Kru Air')
        : (booking.topic || booking.topic_en || 'คอร์สร้องกับครูแอร์');
    const student = booking.nickname || booking.student_name || '';
    const details = lang === 'en'
        ? `Lesson with ${student || 'student'} · The Vocal Kru Air`
        : `เรียนกับ ${student || 'นักเรียน'} · The Vocal ครูแอร์`;
    return buildGoogleCalendarUrl({
        title,
        startDate: booking.slot_iso,
        startTime: booking.slot_hhmm,
        durationHours: Number(booking.duration_hours) || 1,
        details,
    });
}
