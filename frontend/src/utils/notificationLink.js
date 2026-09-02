const INV_REF = /INV-\d{4}-\d+/;

function extractRef(text) {
    const match = String(text || '').match(INV_REF);
    return match ? match[0] : null;
}

function includesAny(text, phrases) {
    const value = String(text || '').toLowerCase();
    return phrases.some((phrase) => value.includes(phrase.toLowerCase()));
}

export function resolveNotificationLink(notification, mode) {
    if (notification?.link) {
        return notification.link;
    }

    const title = notification?.title || '';
    const body = notification?.body || '';
    const combined = `${title} ${body}`;
    const ref = extractRef(body) || extractRef(title);

    if (mode === 'teacher') {
        if (includesAny(title, ['แจ้งโอนเงิน', 'Transfer notified'])) {
            return ref
                ? `/teacher/payments?ref=${encodeURIComponent(ref)}&slip=1`
                : '/teacher/payments';
        }
        if (includesAny(combined, ['คำขอเลื่อน', 'move request', 'ขอเลื่อนนัด'])) {
            return '/teacher/requests';
        }
        if (includesAny(title, ['การบ้าน', 'homework', 'Homework'])) {
            return '/teacher/students';
        }
        if (includesAny(combined, ['นัด', 'lesson', 'Lesson', 'booking'])) {
            return '/teacher/calendar';
        }
        return null;
    }

    if (includesAny(title, ['รอชำระ', 'Payment pending'])) {
        return ref ? `/app/pay/${encodeURIComponent(ref)}` : '/app/packages';
    }
    if (includesAny(title, ['ไม่ผ่าน', 'not confirmed', 'rejected'])) {
        return ref ? `/app/pay/${encodeURIComponent(ref)}` : '/app/packages';
    }
    if (includesAny(title, ['ยืนยันรับเงิน', 'Payment confirmed', 'ชำระเงินสำเร็จ', 'Payment successful', 'ได้รับชั่วโมง', 'รับชำระงวด'])) {
        return '/app/receipts';
    }
    if (includesAny(title, ['ลิงก์ชำระ', 'payment link', 'คอร์สรอชำระ', 'Installment payment link'])) {
        return '/app/packages';
    }
    if (includesAny(title, ['การบ้าน', 'homework', 'Homework'])) {
        return '/app/homework';
    }
    if (includesAny(combined, ['เลื่อนนัด', 'move', 'Move'])) {
        return '/app';
    }
    if (includesAny(combined, ['นัด', 'lesson', 'Reminder', 'เตือน'])) {
        return '/app';
    }
    if (includesAny(combined, ['ชั่วโมง', 'hour', 'แพ็กเกจ', 'package'])) {
        return '/app/packages';
    }
    return null;
}
