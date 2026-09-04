function crc16(data) {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i += 1) {
        crc ^= data.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j += 1) {
            crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
            crc &= 0xFFFF;
        }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
}

function formatTarget(id) {
    const digits = String(id || '').replace(/\D/g, '');
    if (digits.length >= 13) {
        return `0013${digits.length}${digits}`;
    }
    const phone = digits.replace(/^0/, '');
    return `01130066${phone.length}${phone}`;
}

export function buildPromptPayPayload(promptPayId, amount) {
    const target = formatTarget(promptPayId);
    if (!target || target.length < 8) {
        return null;
    }
    const merchantInfo = `0016A000000677010111${target}`;
    let payload = '000201010212';
    payload += `29${String(merchantInfo.length).padStart(2, '0')}${merchantInfo}`;
    if (amount != null && Number(amount) > 0) {
        const amt = Number(amount).toFixed(2);
        payload += `54${String(amt.length).padStart(2, '0')}${amt}`;
    }
    payload += '53037645802TH';
    const withCrcPrefix = `${payload}6304`;
    return `${withCrcPrefix}${crc16(withCrcPrefix)}`;
}

export function promptPayQrImageUrl(payload, size = 280) {
    if (!payload) {
        return null;
    }
    return `https://quickchart.io/qr?size=${size}&text=${encodeURIComponent(payload)}`;
}
