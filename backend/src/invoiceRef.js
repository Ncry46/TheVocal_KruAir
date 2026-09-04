/** Invoice refs: INV-YYYYMMDD-001 (Bangkok calendar day + daily sequence). */

export function bangkokYmd(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    return `${year}${month}${day}`;
}

export function invoiceDayPrefix(date = new Date()) {
    return `INV-${bangkokYmd(date)}-`;
}

/**
 * Next invoice number for today (Asia/Bangkok).
 * @param {(sql: string, params?: object) => Promise<{ recordset: any[] }>} run
 */
export async function nextInvoiceRef(run, date = new Date()) {
    const prefix = invoiceDayPrefix(date);
    const like = `${prefix}%`;
    const result = await run(
        `SELECT TOP 1 ref_no
         FROM dbo.transactions
         WHERE ref_no LIKE @like
         ORDER BY ref_no DESC`,
        { like },
    );
    let seq = 1;
    const last = result.recordset[0]?.ref_no;
    if (last) {
        const match = String(last).match(/^INV-\d{8}-(\d+)$/);
        if (match) {
            seq = Number(match[1]) + 1;
        }
    }
    if (!Number.isFinite(seq) || seq < 1) {
        seq = 1;
    }
    if (seq > 999) {
        throw new Error('เลขบิลวันนี้เต็มแล้ว (เกิน 999 รายการ)');
    }
    return `${prefix}${String(seq).padStart(3, '0')}`;
}
