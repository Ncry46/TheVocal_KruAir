import { pick } from './lang.js';
import { buildPaymentPresentation } from './payments.js';
import { addNotification, query, withTransaction } from './store.js';

export async function ensurePaymentLinksSchema() {
    await query(`
        IF OBJECT_ID(N'dbo.payment_links', N'U') IS NULL
        CREATE TABLE dbo.payment_links (
            id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_payment_links PRIMARY KEY,
            public_id NVARCHAR(40) NOT NULL,
            user_id INT NOT NULL,
            title NVARCHAR(200) NOT NULL,
            title_en NVARCHAR(200) NULL,
            hours INT NOT NULL,
            total_amount DECIMAL(12,2) NOT NULL,
            installment_count INT NOT NULL CONSTRAINT DF_payment_links_installments DEFAULT 1,
            installments_paid INT NOT NULL CONSTRAINT DF_payment_links_paid DEFAULT 0,
            status NVARCHAR(20) NOT NULL CONSTRAINT DF_payment_links_status DEFAULT N'active',
            created_by INT NOT NULL,
            offer_id INT NULL,
            created_at DATETIME2 NOT NULL CONSTRAINT DF_payment_links_created DEFAULT SYSUTCDATETIME(),
            updated_at DATETIME2 NOT NULL CONSTRAINT DF_payment_links_updated DEFAULT SYSUTCDATETIME()
        );
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_payment_links_public' AND object_id = OBJECT_ID(N'dbo.payment_links'))
            CREATE UNIQUE INDEX UX_payment_links_public ON dbo.payment_links (public_id)`);
}

function installmentAmount(total, count, index) {
    const base = Math.floor(Number(total) / count);
    const remainder = Number(total) - base * count;
    return index < count - 1 ? base : base + remainder;
}

export async function createPaymentLink({
    studentUserId,
    teacherId,
    title,
    titleEn,
    hours,
    totalAmount,
    installmentCount = 1,
    offerId = null,
    publicId,
}) {
    await ensurePaymentLinksSchema();
    const count = Math.max(1, Math.min(12, Number(installmentCount) || 1));
    const result = await query(
        `INSERT INTO dbo.payment_links (public_id, user_id, title, title_en, hours, total_amount, installment_count, created_by, offer_id)
         OUTPUT INSERTED.*
         VALUES (@publicId, @userId, @title, @titleEn, @hours, @total, @count, @teacherId, @offerId)`,
        {
            publicId,
            userId: studentUserId,
            title,
            titleEn: titleEn || title,
            hours: Number(hours),
            total: Number(totalAmount),
            count,
            teacherId,
            offerId,
        },
    );
    const link = result.recordset[0];
    const student = await query(`SELECT nickname FROM dbo.users WHERE id = @id`, { id: studentUserId });
    const nickname = student.recordset[0]?.nickname ?? '';
    const payPath = `/app/pay/link/${link.public_id}`;
    await addNotification(
        studentUserId,
        count > 1 ? 'ลิงก์ผ่อนชำระจากครูแอร์' : 'ลิงก์ชำระเงินจากครูแอร์',
        `${title} · ฿${Number(totalAmount).toLocaleString()}${count > 1 ? ` · ${count} งวด` : ''} — เปิดลิงก์เพื่อชำระ`,
        'amber',
        count > 1 ? 'Installment payment link' : 'Payment link from Kru Air',
        `${title} · ฿${Number(totalAmount).toLocaleString()}${count > 1 ? ` · ${count} installments` : ''} — open the link to pay.`,
        payPath,
    );
    return {
        ...formatLinkRow(link, nickname),
        payPath,
    };
}

function formatLinkRow(row, nickname = '') {
    const count = Number(row.installment_count) || 1;
    const paid = Number(row.installments_paid) || 0;
    const nextIndex = paid;
    const nextAmount = paid < count
        ? installmentAmount(row.total_amount, count, paid)
        : null;
    return {
        id: row.public_id,
        studentId: row.user_id,
        student: nickname,
        title: row.title,
        titleEn: row.title_en,
        hours: Number(row.hours),
        totalAmount: Number(row.total_amount),
        installmentCount: count,
        installmentsPaid: paid,
        nextInstallment: paid < count ? paid + 1 : null,
        nextAmount,
        status: row.status,
        createdAt: row.created_at,
    };
}

export async function listPaymentLinksForStudent(userId) {
    await ensurePaymentLinksSchema();
    const result = await query(
        `SELECT pl.*, u.nickname
         FROM dbo.payment_links pl
         JOIN dbo.users u ON u.id = pl.user_id
         WHERE pl.user_id = @userId AND pl.status = N'active'
         ORDER BY pl.created_at DESC`,
        { userId },
    );
    return result.recordset.map((row) => formatLinkRow(row, row.nickname));
}

export async function listPaymentLinksForTeacher(teacherId = null) {
    await ensurePaymentLinksSchema();
    const result = teacherId
        ? await query(
            `SELECT pl.*, u.nickname
             FROM dbo.payment_links pl
             JOIN dbo.users u ON u.id = pl.user_id
             WHERE pl.created_by = @teacherId AND pl.status IN (N'active', N'completed', N'cancelled')
             ORDER BY pl.created_at DESC`,
            { teacherId },
        )
        : await query(
            `SELECT pl.*, u.nickname
             FROM dbo.payment_links pl
             JOIN dbo.users u ON u.id = pl.user_id
             WHERE pl.status IN (N'active', N'completed', N'cancelled')
             ORDER BY pl.created_at DESC`,
        );
    return result.recordset.map((row) => ({
        ...formatLinkRow(row, row.nickname),
        payPath: `/app/pay/link/${row.public_id}`,
    }));
}

export async function cancelPaymentLink(publicId, teacherId) {
    await ensurePaymentLinksSchema();
    const found = await query(
        `SELECT id, status FROM dbo.payment_links WHERE public_id = @id AND created_by = @teacherId`,
        { id: publicId, teacherId },
    );
    const row = found.recordset[0];
    if (!row) {
        throw new Error('ไม่พบลิงก์ชำระเงิน');
    }
    if (row.status === 'completed') {
        throw new Error('ลิงก์นี้ชำระครบแล้ว — ยกเลิกไม่ได้');
    }
    await query(
        `UPDATE dbo.payment_links SET status = N'cancelled', updated_at = SYSUTCDATETIME() WHERE id = @id`,
        { id: row.id },
    );
    return { ok: true };
}

export async function getPaymentLinkForUser(publicId, userId) {
    await ensurePaymentLinksSchema();
    const result = await query(
        `SELECT pl.*, u.nickname
         FROM dbo.payment_links pl
         JOIN dbo.users u ON u.id = pl.user_id
         WHERE pl.public_id = @id`,
        { id: publicId },
    );
    const row = result.recordset[0];
    if (!row) {
        return null;
    }
    if (userId != null && row.user_id !== userId) {
        throw new Error('ลิงก์นี้ไม่ใช่ของบัญชีคุณ');
    }
    return formatLinkRow(row, row.nickname);
}

export async function startPaymentFromLink(publicId, userId, paymentPublicId) {
    await ensurePaymentLinksSchema();
    const linkResult = await query(
        `SELECT * FROM dbo.payment_links WHERE public_id = @id AND user_id = @userId AND status = N'active'`,
        { id: publicId, userId },
    );
    const link = linkResult.recordset[0];
    if (!link) {
        throw new Error('ไม่พบลิงก์ชำระเงิน');
    }
    const paid = Number(link.installments_paid) || 0;
    const count = Number(link.installment_count) || 1;
    if (paid >= count) {
        throw new Error('ชำระครบทุกงวดแล้ว');
    }
    const pending = await query(
        `SELECT TOP 1 t.ref_no
         FROM dbo.transactions t
         WHERE t.payment_link_id = @linkId AND t.installment_no = @no AND t.status IN (N'pending', N'awaiting_confirm')`,
        { linkId: link.id, no: paid + 1 },
    );
    if (pending.recordset[0]) {
        const refNo = pending.recordset[0].ref_no;
        const presentation = await buildPaymentPresentation(
            installmentAmount(link.total_amount, count, paid),
        );
        return {
            refNo,
            amount: installmentAmount(link.total_amount, count, paid),
            hours: Number(link.hours),
            label: count > 1
                ? `${link.title} (งวด ${paid + 1}/${count})`
                : link.title,
            status: 'pending',
            payment: presentation,
            installmentNo: paid + 1,
            installmentCount: count,
            linkId: link.public_id,
        };
    }

    const amount = installmentAmount(link.total_amount, count, paid);
    return withTransaction(async (run) => {
        const txCount = await run(`SELECT COUNT(*) AS n FROM dbo.transactions`);
        const refNo = `INV-${new Date().getFullYear()}-${8800 + Number(txCount.recordset[0].n) + 1}`;
        const payMethod = 'พร้อมเพย์ / โอน';
        const label = count > 1
            ? `${link.title} (งวด ${paid + 1}/${count})`
            : link.title;

        const tx = await run(
            `INSERT INTO dbo.transactions (ref_no, user_id, package_id, gross_amount, discount_amount, net_amount, method, method_en, status, offer_id, payment_link_id, installment_no, installment_total)
             OUTPUT INSERTED.*
             VALUES (@refNo, @userId, N'link', @gross, 0, @net, @method, @methodEn, N'pending', @offerId, @linkId, @installNo, @installTotal)`,
            {
                refNo,
                userId,
                gross: amount,
                net: amount,
                method: payMethod,
                methodEn: 'PromptPay / Bank transfer',
                offerId: link.offer_id,
                linkId: link.id,
                installNo: paid + 1,
                installTotal: count,
            },
        );
        const transaction = tx.recordset[0];
        await run(
            `INSERT INTO dbo.payments (public_id, transaction_id, gateway, method, method_en, gateway_status, raw_webhook)
             VALUES (@publicId, @txId, N'manual', @method, @methodEn, N'pending', @webhook)`,
            {
                publicId: paymentPublicId,
                txId: transaction.id,
                method: payMethod,
                methodEn: 'PromptPay / Bank transfer',
                webhook: JSON.stringify({ mode: 'payment_link', linkId: link.public_id, installment: paid + 1 }),
            },
        );
        const presentation = await buildPaymentPresentation(amount);
        return {
            refNo,
            amount,
            hours: Number(link.hours),
            label,
            status: 'pending',
            payment: presentation,
            installmentNo: paid + 1,
            installmentCount: count,
            linkId: link.public_id,
        };
    });
}

export async function onPaymentLinkInstallmentConfirmed(linkId, installmentNo) {
    await ensurePaymentLinksSchema();
    const linkResult = await query(`SELECT * FROM dbo.payment_links WHERE id = @id`, { id: linkId });
    const link = linkResult.recordset[0];
    if (!link) {
        return;
    }
    const paid = Math.max(Number(link.installments_paid) || 0, Number(installmentNo) || 0);
    const count = Number(link.installment_count) || 1;
    const status = paid >= count ? 'completed' : 'active';
    await query(
        `UPDATE dbo.payment_links SET installments_paid = @paid, status = @status, updated_at = SYSUTCDATETIME() WHERE id = @id`,
        { id: link.id, paid, status },
    );
    if (status === 'completed' && link.offer_id) {
        await query(
            `UPDATE dbo.student_offers SET status = N'granted', updated_at = SYSUTCDATETIME() WHERE id = @id AND status = N'pending_payment'`,
            { id: link.offer_id },
        );
    }
}
