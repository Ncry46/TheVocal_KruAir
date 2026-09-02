function text(content, options = {}) {
    return { type: 'text', text: String(content), ...options };
}

function bubble(bodyContents, { headerText = null, footerButtons = [] } = {}) {
    const contents = {
        type: 'bubble',
        body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: bodyContents },
    };
    if (headerText) {
        contents.header = {
            type: 'box',
            layout: 'vertical',
            contents: [text(headerText, { weight: 'bold', size: 'lg' })],
        };
    }
    if (footerButtons.length > 0) {
        contents.footer = {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            contents: footerButtons.map((btn) => ({
                type: 'button',
                style: btn.style || 'link',
                color: btn.color,
                action: btn.action,
            })),
        };
    }
    return { type: 'flex', altText: headerText || 'VOCALITY ACADEMY', contents };
}

export function flexPackageStatus(pkg, lang = 'th') {
    const header = lang === 'en' ? '🎟️ My package' : '🎟️ แพ็กเกจของฉัน';
    const noPkg = lang === 'en'
        ? 'No active package — buy one in the app to start booking.'
        : 'ยังไม่มีแพ็กเกจที่ใช้งาน — ซื้อแพ็กเกจในแอปเพื่อเริ่มจองเรียน';
    if (!pkg || pkg.left === 0 && pkg.hours === 0) {
        return bubble([text(noPkg)], { headerText: header });
    }
    const leftLabel = lang === 'en' ? 'Hours left' : 'ชั่วโมงคงเหลือ';
    const expiresLabel = lang === 'en' ? 'Expires' : 'หมดอายุ';
    return bubble([
        text(pkg.name, { weight: 'bold', size: 'md' }),
        text(`${leftLabel}: ${pkg.left} / ${pkg.hours}`, { size: 'sm' }),
        text(`${expiresLabel}: ${pkg.expiresAt}`, { size: 'sm', color: '#888888' }),
    ], { headerText: header });
}

export function flexHistory(rows, lang = 'th') {
    const header = lang === 'en' ? '📖 Lesson history' : '📖 ประวัติการเรียน';
    if (!rows.length) {
        const empty = lang === 'en' ? 'No completed lessons yet.' : 'ยังไม่มีประวัติการเรียน';
        return bubble([text(empty)], { headerText: header });
    }
    const items = rows.slice(0, 5).flatMap((row, index) => {
        const block = [
            text(`${row.date} · ${row.time}`, { weight: 'bold', size: 'sm' }),
            text(row.lesson, { size: 'sm', wrap: true }),
        ];
        if (index < Math.min(rows.length, 5) - 1) {
            block.push({ type: 'separator', margin: 'md' });
        }
        return block;
    });
    return bubble(items, { headerText: header });
}

export function flexContact(lang = 'th') {
    const header = lang === 'en' ? '💬 Contact Kru Air' : '💬 ติดต่อครูแอร์';
    const lines = lang === 'en'
        ? [
            'VOCALITY ACADEMY BY KRU AIR',
            'Live 1:1 vocal lessons',
            'Tue–Sun 10:00–19:00 (closed Mon)',
            'LINE OA: add us as a friend to get reminders',
            'Website: book, pay, and manage your profile',
        ]
        : [
            'VOCALITY ACADEMY BY KRU AIR',
            'เรียนร้องเพลงสด ตัวต่อตัว 1:1',
            'อังคาร–อาทิตย์ 10:00–19:00 น. (หยุดจันทร์)',
            'LINE OA: แอดเพื่อนเพื่อรับแจ้งเตือนนัด',
            'เว็บไซต์: จอง ชำระ และจัดการโปรไฟล์ได้ครบ',
        ];
    return bubble(lines.map((line) => text(line, { size: 'sm', wrap: true })), { headerText: header });
}

export function flexLessonReminder({ dateLabel, timeLabel, teacherLabel, pkgLabel, bookingId, liffBookingUrl, lang = 'th' }) {
    const header = lang === 'en' ? '🔔 Lesson reminder' : '🔔 เตือนนัดเรียน';
    const alt = lang === 'en'
        ? `Lesson reminder ${dateLabel} ${timeLabel}`
        : `เตือนนัดเรียน ${dateLabel} ${timeLabel}`;
    const buttons = [
        {
            style: 'primary',
            action: { type: 'postback', label: lang === 'en' ? '✅ Confirm' : '✅ ยืนยันมาเรียน', data: `CONFIRM|${bookingId}` },
        },
        {
            action: {
                type: 'uri',
                label: lang === 'en' ? '🔁 Reschedule' : '🔁 ขอเลื่อนนัด',
                uri: liffBookingUrl || `https://line.me`,
            },
        },
        {
            style: 'link',
            color: '#e5484d',
            action: { type: 'postback', label: lang === 'en' ? '❌ Cancel' : '❌ ยกเลิกนัด', data: `CANCEL|${bookingId}` },
        },
    ];
    return {
        ...bubble([
            text(dateLabel, { size: 'sm' }),
            text(`${timeLabel} · ${teacherLabel}`, { weight: 'bold', wrap: true }),
            text(pkgLabel, { size: 'sm', color: '#888888', margin: 'md' }),
        ], { headerText: header, footerButtons: buttons }),
        altText: alt,
    };
}

export function flexPostbackResult(message, lang = 'th') {
    const header = lang === 'en' ? 'VOCALITY ACADEMY' : 'VOCALITY ACADEMY';
    return bubble([text(message, { wrap: true })], { headerText: header });
}
