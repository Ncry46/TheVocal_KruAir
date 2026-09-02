import { methodEn, pick } from './lang.js';
import { buildPromptPayPayload, promptPayQrImageUrl } from './promptPay.js';
import { onPaymentLinkInstallmentConfirmed } from './paymentLinks.js';
import { ensurePaymentSettingsSchema, getPaymentSettings, paymentConfigured } from './paymentSettings.js';
import {
    addNotification,
    discountForVoucher,
    gatewayFromMethod,
    query,
    withTransaction,
} from './store.js';
import { savePaymentSlip, resolvePaymentSlipFile } from './uploads.js';

async function ensurePaymentColumns() {
    await ensurePaymentSettingsSchema();
    await query(
        `IF COL_LENGTH('dbo.transactions', 'payment_slip_url') IS NULL
         ALTER TABLE dbo.transactions ADD payment_slip_url NVARCHAR(500) NULL`,
    );
    await query(
        `IF COL_LENGTH('dbo.transactions', 'payment_slip_data') IS NULL
         ALTER TABLE dbo.transactions ADD payment_slip_data NVARCHAR(MAX) NULL`,
    );
}

function hasStoredSlip(row) {
    return Boolean(row?.payment_slip_url || row?.payment_slip_data);
}

function slipPayloadFromRow(row) {
    const file = resolvePaymentSlipFile(row.payment_slip_url);
    if (file) {
        return { kind: 'file', file };
    }
    const raw = String(row.payment_slip_data || '').trim();
    const match = raw.match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
    if (match) {
        return {
            kind: 'buffer',
            mime: match[1],
            buffer: Buffer.from(match[2], 'base64'),
        };
    }
    return null;
}

export async function getPaymentSlipPayloadForRef(refNo, { userId = null, allowTeacher = false } = {}) {
    const result = await query(
        `SELECT t.payment_slip_url, t.payment_slip_data, t.user_id FROM dbo.transactions t WHERE t.ref_no = @refNo`,
        { refNo },
    );
    const row = result.recordset[0];
    if (!hasStoredSlip(row)) {
        throw new Error('ไม่พบสลิปการโอน');
    }
    if (!allowTeacher && userId != null && row.user_id !== userId) {
        throw new Error('ไม่มีสิทธิ์ดูสลิปนี้');
    }
    const payload = slipPayloadFromRow(row);
    if (!payload) {
        throw new Error('ไม่พบไฟล์สลิปบนเซิร์ฟเวอร์');
    }
    return payload;
}

/** @deprecated use getPaymentSlipPayloadForRef */
export async function getPaymentSlipFileForRef(refNo, options = {}) {
    const payload = await getPaymentSlipPayloadForRef(refNo, options);
    if (payload.kind !== 'file') {
        throw new Error('ไม่พบไฟล์สลิปบนเซิร์ฟเวอร์');
    }
    return payload.file;
}

export async function buildPaymentPresentation(amount, settings = null) {
    const config = settings || await getPaymentSettings();
    const payload = config.promptpayId ? buildPromptPayPayload(config.promptpayId, amount) : null;
    const dynamicQrUrl = payload ? promptPayQrImageUrl(payload) : null;
    return {
        configured: paymentConfigured(config),
        promptpayId: config.promptpayId || null,
        bankName: config.bankName || null,
        bankAccount: config.bankAccount || null,
        accountName: config.accountName || null,
        qrImageUrl: dynamicQrUrl || config.qrImageUrl || null,
        amount: Number(amount),
    };
}

export async function createPendingPurchase({
    userId,
    pkgId,
    offerPublicId,
    voucherCode,
    paymentPublicId,
}) {
    await ensurePaymentColumns();
    const settings = await getPaymentSettings();
    if (!paymentConfigured(settings)) {
        throw new Error('ครูแอร์ยังไม่ได้ตั้งค่าช่องทางรับเงิน — ติดต่อครูแอร์');
    }

    return withTransaction(async (run) => {
        let pkg;
        let offer = null;
        let hours;
        let gross;
        let resolvedPkgId;

        if (offerPublicId) {
            const offerResult = await run(
                `SELECT o.*, u.nickname
                 FROM dbo.student_offers o
                 JOIN dbo.users u ON u.id = o.user_id
                 WHERE o.public_id = @id AND o.user_id = @userId`,
                { id: offerPublicId, userId },
            );
            offer = offerResult.recordset[0];
            if (!offer) {
                throw new Error('ไม่พบคอร์สที่ต้องชำระ');
            }
            if (offer.status !== 'pending_payment') {
                throw new Error('คอร์สนี้ไม่ได้อยู่ในสถานะรอชำระ');
            }
            const pendingTx = await run(
                `SELECT TOP 1 id FROM dbo.transactions
                 WHERE offer_id = @offerId AND status IN (N'pending', N'awaiting_confirm')`,
                { offerId: offer.id },
            );
            if (pendingTx.recordset[0]) {
                throw new Error('มีรายการชำระค้างอยู่แล้ว — ดูที่หน้าชำระเงิน');
            }
            resolvedPkgId = 'offer';
            hours = Number(offer.hours);
            gross = Number(offer.price);
        }
        else {
            const pkgResult = await run(
                `SELECT * FROM dbo.packages WHERE id = @id AND is_active = N'Y'`,
                { id: pkgId },
            );
            pkg = pkgResult.recordset[0];
            if (!pkg) {
                throw new Error('ไม่พบแพ็กเกจที่เลือก');
            }
            resolvedPkgId = pkg.id;
            hours = Number(pkg.hours);
            gross = Number(pkg.price);
        }

        let discount = 0;
        let voucher = null;
        const code = String(voucherCode ?? '').trim().toUpperCase();
        if (code && !offer) {
            const voucherResult = await run(
                `SELECT * FROM dbo.vouchers WHERE code = @code AND is_active = N'Y' AND (valid_to IS NULL OR valid_to >= SYSUTCDATETIME())`,
                { code },
            );
            voucher = voucherResult.recordset[0];
            if (!voucher) {
                throw new Error(`โค้ด "${code}" ไม่ถูกต้องหรือหมดอายุ`);
            }
            if (voucher.max_uses != null && voucher.used_count >= voucher.max_uses) {
                throw new Error(`โค้ด "${code}" ถูกใช้ครบแล้ว`);
            }
            discount = Math.min(discountForVoucher(voucher, gross), gross);
        }

        const net = gross - discount;
        const count = await run(`SELECT COUNT(*) AS n FROM dbo.transactions`);
        const refNo = `INV-${new Date().getFullYear()}-${8800 + Number(count.recordset[0].n) + 1}`;
        const payMethod = 'พร้อมเพย์ / โอน';
        const gateway = gatewayFromMethod(payMethod);

        const tx = await run(
            `INSERT INTO dbo.transactions (ref_no, user_id, package_id, gross_amount, discount_amount, net_amount, voucher_code, method, method_en, status, offer_id)
             OUTPUT INSERTED.*
             VALUES (@refNo, @userId, @pkgId, @gross, @discount, @net, @voucher, @method, @methodEn, N'pending', @offerId)`,
            {
                refNo,
                userId,
                pkgId: resolvedPkgId,
                gross,
                discount,
                net,
                voucher: code || null,
                method: payMethod,
                methodEn: methodEn(payMethod),
                offerId: offer?.id ?? null,
            },
        );
        const transaction = tx.recordset[0];
        await run(
            `INSERT INTO dbo.payments (public_id, transaction_id, payment_ref, gateway, method, method_en, gateway_status, raw_webhook)
             VALUES (@publicId, @txId, NULL, @gateway, @method, @methodEn, N'pending', @webhook)`,
            {
                publicId: paymentPublicId,
                txId: transaction.id,
                gateway,
                method: payMethod,
                methodEn: methodEn(payMethod),
                webhook: JSON.stringify({ mode: 'manual_transfer', status: 'pending' }),
            },
        );

        const presentation = await buildPaymentPresentation(net, settings);
        const label = offer ? offer.title : pick(pkg, 'name', 'th');
        await addNotification(
            userId,
            'รอชำระเงิน',
            `ออเดอร์ ${refNo} · ${label} · ฿${net.toLocaleString()} — โอนแล้วแจ้งในระบบ`,
            'amber',
            'Payment pending',
            `Order ${refNo} · ฿${net.toLocaleString()} — transfer then notify in the app.`,
            `/app/pay/${refNo}`,
        );

        return {
            refNo,
            transactionId: transaction.id,
            amount: net,
            hours,
            label,
            status: 'pending',
            payment: presentation,
        };
    });
}

export async function getPurchaseByRef(refNo, userId = null) {
    await ensurePaymentColumns();
    const result = await query(
        `SELECT t.*, p.gateway_status, p.public_id AS payment_public_id,
                o.public_id AS offer_public_id, o.title AS offer_title, o.title_en AS offer_title_en,
                o.hours AS offer_hours, pkg.name AS pkg_name, pkg.name_en AS pkg_name_en, pkg.hours AS pkg_hours,
                pl.title AS link_title, pl.title_en AS link_title_en, pl.hours AS link_hours,
                u.nickname
         FROM dbo.transactions t
         JOIN dbo.payments p ON p.transaction_id = t.id
         LEFT JOIN dbo.student_offers o ON o.id = t.offer_id
         LEFT JOIN dbo.packages pkg ON pkg.id = t.package_id
         LEFT JOIN dbo.payment_links pl ON pl.id = t.payment_link_id
         JOIN dbo.users u ON u.id = t.user_id
         WHERE t.ref_no = @refNo`,
        { refNo },
    );
    const row = result.recordset[0];
    if (!row) {
        return null;
    }
    if (userId != null && row.user_id !== userId) {
        return null;
    }
    const presentation = await buildPaymentPresentation(row.net_amount);
    const label = row.offer_title || row.link_title || row.pkg_name;
    const labelEn = row.offer_title_en || row.link_title_en || row.pkg_name_en;
    const installmentSuffix = row.installment_no && row.installment_total > 1
        ? ` (งวด ${row.installment_no}/${row.installment_total})`
        : '';
    return {
        refNo: row.ref_no,
        status: row.status,
        gatewayStatus: row.gateway_status,
        amount: Number(row.net_amount),
        gross: Number(row.gross_amount),
        discount: Number(row.discount_amount),
        studentNote: row.student_note || null,
        slipUrl: row.payment_slip_url || null,
        hasSlip: hasStoredSlip(row),
        packageId: row.package_id,
        packageName: `${label}${installmentSuffix}`,
        packageNameEn: `${labelEn || label}${installmentSuffix}`,
        hours: row.offer_hours ?? row.link_hours ?? row.pkg_hours,
        offerPublicId: row.offer_public_id || null,
        installmentNo: row.installment_no || null,
        installmentCount: row.installment_total || null,
        studentName: row.nickname,
        payment: presentation,
    };
}

export async function notifyPurchasePaid(refNo, userId, { note = '', slipDataUrl = '' } = {}) {
    await ensurePaymentColumns();
    const slipInput = String(slipDataUrl ?? '').trim();
    if (!slipInput) {
        throw new Error('กรุณาแนบรูปสลิปการโอนเงิน');
    }
    const slipUrl = savePaymentSlip(slipInput);
    const result = await query(
        `SELECT t.id, t.user_id, t.ref_no, t.status, t.net_amount, u.nickname
         FROM dbo.transactions t
         JOIN dbo.users u ON u.id = t.user_id
         WHERE t.ref_no = @refNo`,
        { refNo },
    );
    const row = result.recordset[0];
    if (!row || row.user_id !== userId) {
        throw new Error('ไม่พบรายการชำระเงิน');
    }
    if (row.status !== 'pending') {
        throw new Error('รายการนี้ไม่สามารถแจ้งโอนได้');
    }
    await query(
        `UPDATE dbo.transactions SET status = N'awaiting_confirm', student_note = @note, payment_slip_url = @slipUrl, payment_slip_data = @slipData WHERE id = @id;
         UPDATE dbo.payments SET gateway_status = N'awaiting_confirm' WHERE transaction_id = @id`,
        {
            id: row.id,
            note: String(note || '').trim().slice(0, 500) || null,
            slipUrl,
            slipData: slipInput.slice(0, 7_000_000),
        },
    );
    await notifySlotTeacherPending(row);
    return { ok: true, status: 'awaiting_confirm', slipUrl };
}

async function notifySlotTeacherPending(row) {
    const teachers = await query(
        `SELECT id FROM dbo.users WHERE role IN (N'teacher', N'admin') AND status = N'Y'`,
    );
    for (const teacher of teachers.recordset) {
        await addNotification(
            teacher.id,
            'มีการแจ้งโอนเงิน',
            `น้อง${row.nickname} แจ้งโอน ${row.ref_no} · ฿${Number(row.net_amount).toLocaleString()} พร้อมสลิป — กรุณายืนยัน`,
            'amber',
            'Transfer notified',
            `${row.nickname} reported payment for ${row.ref_no} · ฿${Number(row.net_amount).toLocaleString()} with slip — please confirm.`,
            `/teacher/payments?ref=${encodeURIComponent(row.ref_no)}&slip=1`,
        );
    }
}

export async function listPendingPayments() {
    await ensurePaymentColumns();
    const result = await query(
        `SELECT t.ref_no, t.status, t.net_amount, t.gross_amount, t.created_at, t.student_note, t.payment_slip_url, t.payment_slip_data,
                u.nickname, u.name, u.email,
                o.title AS offer_title, o.public_id AS offer_public_id, o.hours AS offer_hours,
                pkg.name AS pkg_name, pkg.hours AS pkg_hours
         FROM dbo.transactions t
         JOIN dbo.users u ON u.id = t.user_id
         JOIN dbo.payments p ON p.transaction_id = t.id
         LEFT JOIN dbo.student_offers o ON o.id = t.offer_id
         LEFT JOIN dbo.packages pkg ON pkg.id = t.package_id
         WHERE t.status IN (N'pending', N'awaiting_confirm')
         ORDER BY t.created_at DESC`,
    );
    return result.recordset.map((row) => ({
        refNo: row.ref_no,
        status: row.status,
        amount: Number(row.net_amount),
        student: row.nickname || row.name,
        email: row.email,
        label: row.offer_title || row.pkg_name || '—',
        hours: row.offer_hours ?? row.pkg_hours,
        offerPublicId: row.offer_public_id || null,
        studentNote: row.student_note || null,
        slipUrl: row.payment_slip_url || null,
        hasSlip: hasStoredSlip(row),
        createdAt: row.created_at,
    }));
}

export async function confirmPendingPurchase(refNo, teacherId, enrollmentPublicId) {
    await ensurePaymentColumns();
    return withTransaction(async (run) => {
        const txResult = await run(
            `SELECT t.*, o.id AS offer_row_id, o.public_id AS offer_public_id, o.hours AS offer_hours, o.title AS offer_title, o.title_en AS offer_title_en,
                    pkg.hours AS pkg_hours, pkg.name AS pkg_name, pkg.name_en AS pkg_name_en,
                    pl.hours AS link_hours, pl.installment_count AS link_installments, pl.installments_paid AS link_paid
             FROM dbo.transactions t
             LEFT JOIN dbo.student_offers o ON o.id = t.offer_id
             LEFT JOIN dbo.packages pkg ON pkg.id = t.package_id
             LEFT JOIN dbo.payment_links pl ON pl.id = t.payment_link_id
             WHERE t.ref_no = @refNo`,
            { refNo },
        );
        const tx = txResult.recordset[0];
        if (!tx) {
            throw new Error('ไม่พบรายการชำระเงิน');
        }
        if (tx.status !== 'pending' && tx.status !== 'awaiting_confirm') {
            throw new Error('รายการนี้ยืนยันไม่ได้');
        }

        const isInstallment = tx.payment_link_id && Number(tx.installment_total) > 1;
        const isLastInstallment = !isInstallment
            || Number(tx.installment_no) >= Number(tx.installment_total);

        const hours = tx.offer_row_id
            ? Number(tx.offer_hours)
            : tx.payment_link_id
                ? Number(tx.link_hours)
                : Number(tx.pkg_hours);
        const pkgId = tx.offer_row_id ? 'offer' : tx.payment_link_id ? 'link' : tx.package_id;

        await run(
            `UPDATE dbo.transactions SET status = N'success', paid_at = SYSUTCDATETIME(), confirmed_by = @teacherId, confirmed_at = SYSUTCDATETIME() WHERE id = @id;
             UPDATE dbo.payments SET gateway_status = N'success', payment_ref = @paymentRef, paid_at = SYSUTCDATETIME() WHERE transaction_id = @id`,
            { id: tx.id, teacherId, paymentRef: `CONF-${tx.ref_no}` },
        );

        if (tx.payment_link_id) {
            await onPaymentLinkInstallmentConfirmed(tx.payment_link_id, tx.installment_no);
        }

        if (!isLastInstallment) {
            await addNotification(
                tx.user_id,
                'รับชำระงวดแล้ว',
                `ครูแอร์ยืนยันงวด ${tx.installment_no}/${tx.installment_total} ของ ${tx.ref_no} แล้ว — ชำระงวดถัดไปได้ที่ลิงก์เดิม`,
                'green',
                'Installment confirmed',
                `Installment ${tx.installment_no}/${tx.installment_total} for ${tx.ref_no} confirmed — pay the next installment via the same link.`,
            );
            return { refNo: tx.ref_no, hours: 0, installment: true, installmentNo: tx.installment_no };
        }

        await run(
            `UPDATE dbo.user_packages SET status = N'expired' WHERE user_id = @userId AND status = N'active'`,
            { userId: tx.user_id },
        );
        const pkgInsert = await run(
            `INSERT INTO dbo.user_packages (user_id, package_id, hours_total, hours_used, expires_at, status, transaction_id)
             OUTPUT INSERTED.id
             VALUES (@userId, @pkgId, @hours, 0, DATEADD(month, 6, SYSUTCDATETIME()), N'active', @txId)`,
            { userId: tx.user_id, pkgId, hours, txId: tx.id },
        );
        const userPackageId = pkgInsert.recordset[0]?.id;

        await run(
            `INSERT INTO dbo.enrollments (public_id, user_id, package_id, hours_granted, status, source)
             VALUES (@enrollmentId, @userId, @pkgId, @hours, N'active', N'web')`,
            { enrollmentId: enrollmentPublicId, userId: tx.user_id, pkgId, hours },
        );

        if (tx.offer_row_id) {
            await run(
                `UPDATE dbo.student_offers SET status = N'granted', user_package_id = @pkgId, updated_at = SYSUTCDATETIME() WHERE id = @id`,
                { id: tx.offer_row_id, pkgId: userPackageId },
            );
        }

        if (tx.voucher_code) {
            const voucherResult = await run(
                `SELECT id FROM dbo.vouchers WHERE code = @code`,
                { code: tx.voucher_code },
            );
            const voucher = voucherResult.recordset[0];
            if (voucher) {
                await run(
                    `UPDATE dbo.vouchers SET used_count = used_count + 1 WHERE id = @id`,
                    { id: voucher.id },
                );
            }
        }

        const nameTh = tx.offer_title || tx.pkg_name;
        const nameEn = tx.offer_title_en || tx.pkg_name_en;
        await addNotification(
            tx.user_id,
            'ยืนยันรับเงินแล้ว',
            `ครูแอร์ยืนยัน ${tx.ref_no} แล้ว — เพิ่ม ${hours} ชม. เข้าบัญชี`,
            'green',
            'Payment confirmed',
            `Kru Air confirmed ${tx.ref_no} — ${hours} hour(s) added to your account.`,
        );

        return { refNo: tx.ref_no, hours, label: nameTh, labelEn: nameEn };
    });
}

export async function rejectPendingPurchase(refNo, teacherId, reason = '') {
    await ensurePaymentColumns();
    const result = await query(
        `SELECT t.id, t.user_id, t.ref_no, t.status, t.voucher_code
         FROM dbo.transactions t WHERE t.ref_no = @refNo`,
        { refNo },
    );
    const tx = result.recordset[0];
    if (!tx) {
        throw new Error('ไม่พบรายการชำระเงิน');
    }
    if (tx.status !== 'pending' && tx.status !== 'awaiting_confirm') {
        throw new Error('รายการนี้ปฏิเสธไม่ได้');
    }
    await query(
        `UPDATE dbo.transactions SET status = N'cancelled', confirmed_by = @teacherId, confirmed_at = SYSUTCDATETIME(), student_note = COALESCE(student_note, @reason) WHERE id = @id;
         UPDATE dbo.payments SET gateway_status = N'cancelled' WHERE transaction_id = @id`,
        { id: tx.id, teacherId, reason: String(reason || '').trim().slice(0, 500) || null },
    );
    await addNotification(
        tx.user_id,
        'การชำระเงินไม่ผ่าน',
        `รายการ ${tx.ref_no} ไม่ได้รับการยืนยัน — ติดต่อครูแอร์หรือลองใหม่`,
        'pink',
        'Payment not confirmed',
        `Order ${tx.ref_no} was not confirmed — contact Kru Air or try again.`,
    );
    return { ok: true };
}
