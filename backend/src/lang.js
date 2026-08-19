import { parseIsoDate } from './dates.js';

const EN_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TH_DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export function resolveLang(req) {
    const raw = String(req.headers['x-lang'] || req.query.lang || '').toLowerCase();
    return raw.startsWith('en') ? 'en' : 'th';
}

export function pick(row, field, lang) {
    if (lang === 'en') {
        const english = row[`${field}_en`];
        if (english != null && String(english).trim() !== '') {
            return english;
        }
    }
    return row[field];
}

export function chipLabel(date, lang = 'th') {
    const days = lang === 'en' ? EN_DAYS : TH_DAYS;
    return `${days[date.getDay()]} ${date.getDate()}`;
}

export function formatDate(date, lang = 'th') {
    if (lang === 'en') {
        return `${date.getDate()} ${EN_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
    }
    return `${date.getDate()} ${TH_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function monthYear(date, lang = 'th') {
    if (lang === 'en') {
        return `${EN_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
    }
    return `${TH_MONTHS[date.getMonth()]} ${date.getFullYear() + 543}`;
}

export function lessonTimeRange(time, lang = 'th') {
    const hour = Number(String(time).slice(0, 2));
    const end = `${String(hour + 1).padStart(2, '0')}:00`;
    return lang === 'en' ? `${time}–${end}` : `${time}–${end} น.`;
}

export function slotLabel(date, time, lang = 'th') {
    return `${chipLabel(date, lang)} ${time}`;
}

export function relativeTime(from, lang = 'th') {
    const ms = Date.now() - from.getTime();
    const minutes = Math.max(1, Math.round(ms / 60000));
    if (lang === 'en') {
        if (minutes < 60) {
            return `${minutes} min ago`;
        }
        const hours = Math.round(minutes / 60);
        if (hours < 24) {
            return `${hours} hr ago`;
        }
        const days = Math.round(hours / 24);
        if (days < 7) {
            return `${days} day${days === 1 ? '' : 's'} ago`;
        }
        return formatDate(from, 'en');
    }
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
    return formatDate(from, 'th');
}

export function slotStatus(status, lang = 'th') {
    const open = status === 'open';
    if (lang === 'en') {
        return open ? 'Open' : 'Full';
    }
    return open ? 'ว่าง' : 'เต็ม';
}

export function paymentStatus(status, lang = 'th') {
    if (status === 'success') {
        return lang === 'en' ? 'Paid' : 'สำเร็จ';
    }
    return status;
}

export function moveStatus(status, lang = 'th') {
    const map = {
        pending: lang === 'en' ? 'Pending' : 'รออนุมัติ',
        approved: lang === 'en' ? 'Approved' : 'อนุมัติแล้ว',
        rejected: lang === 'en' ? 'Rejected' : 'ปฏิเสธ',
    };
    return map[status] ?? status;
}

export function localizePackage(row, lang) {
    return {
        id: row.id,
        name: pick(row, 'name', lang),
        hours: row.hours,
        price: Number(row.price),
        note: pick(row, 'note', lang),
        tag: pick(row, 'tag', lang),
        tone: row.tone,
    };
}

export function packageStatusFromRow(row, lang = 'th') {
    if (!row) {
        return { name: '—', hours: 0, used: 0, left: 0, expiresAt: '—' };
    }
    const expires = new Date(row.expires_at);
    return {
        name: pick(row, 'package_name', lang) ?? row.package_name,
        hours: row.hours_total,
        used: row.hours_used,
        left: Math.max(0, row.hours_total - row.hours_used),
        expiresAt: formatDate(expires, lang),
    };
}

export { parseIsoDate };
