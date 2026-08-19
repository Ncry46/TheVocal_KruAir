const THAI_DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export function parseIsoDate(iso) {
    const [year, month, day] = String(iso).split('-').map(Number);
    return new Date(year, month - 1, day);
}

export function toIsoDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function chipLabel(date) {
    return `${THAI_DAYS[date.getDay()]} ${date.getDate()}`;
}

export function thaiDate(date) {
    return `${date.getDate()} ${THAI_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function thaiMonthYear(date) {
    return `${THAI_MONTHS[date.getMonth()]} ${date.getFullYear() + 543}`;
}

export function plusOneHour(hhmm) {
    const hour = Number(String(hhmm).slice(0, 2));
    return `${String(hour + 1).padStart(2, '0')}:00`;
}

export function slotLabel(date, time) {
    return `${chipLabel(date)} ${time}`;
}

export function lessonTimeRange(time) {
    return `${time}–${plusOneHour(time)} น.`;
}

export function startOfWeekMonday(date = new Date()) {
    const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = copy.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    copy.setDate(copy.getDate() + diff);
    return copy;
}

export function relativeTime(from) {
    const ms = Date.now() - from.getTime();
    const minutes = Math.max(1, Math.round(ms / 60000));
    if (minutes < 60) {
        return `เมื่อ ${minutes} นาทีที่แล้ว`;
    }
    const hours = Math.round(minutes / 60);
    if (hours < 24) {
        return `เมื่อ ${hours} ชม.ที่แล้ว`;
    }
    const days = Math.round(hours / 24);
    if (days < 7) {
        return `เมื่อ ${days} วันที่แล้ว`;
    }
    return thaiDate(from);
}
