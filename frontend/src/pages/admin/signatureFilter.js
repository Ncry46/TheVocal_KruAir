function rowDateIso(row) {
    const slotIso = String(row.slotIso ?? '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(slotIso)) {
        return slotIso;
    }
    const signedAt = String(row.signedAt ?? '');
    if (/^\d{4}-\d{2}-\d{2}/.test(signedAt)) {
        return signedAt.slice(0, 10);
    }
    return '';
}

export function filterSignaturesByDate(rows, { year, month, day }) {
    const list = rows ?? [];
    if (!year) {
        return list;
    }
    return list.filter((row) => {
        const iso = rowDateIso(row);
        if (!iso) {
            return !month && !day;
        }
        const [rowYear, rowMonth, rowDay] = iso.split('-');
        if (rowYear !== String(year)) {
            return false;
        }
        if (month && rowMonth !== String(month).padStart(2, '0')) {
            return false;
        }
        if (day && rowDay !== String(day).padStart(2, '0')) {
            return false;
        }
        return true;
    });
}

export function signatureYears(rows, fallbackYear) {
    const years = new Set([String(fallbackYear)]);
    for (const row of rows ?? []) {
        const iso = rowDateIso(row);
        const year = iso.slice(0, 4);
        if (year) {
            years.add(year);
        }
    }
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
}

export function daysInMonth(year, month) {
    return new Date(Number(year), Number(month), 0).getDate();
}
