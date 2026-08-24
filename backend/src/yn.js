export function isYes(value) {
    if (value === true || value === 1) {
        return true;
    }
    const text = (Buffer.isBuffer(value) ? value.toString('utf8') : String(value ?? '')).trim().toLowerCase();
    return text === 'y' || text === 'active' || text === '1';
}

export function toYn(value) {
    return isYes(value) || String(value ?? '').trim().toLowerCase() === 'y' ? 'Y' : 'N';
}
