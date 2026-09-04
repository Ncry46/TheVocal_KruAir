import { query } from './store.js';

const DEFAULTS = {
    promptpayId: '',
    bankName: '',
    bankAccount: '',
    accountName: '',
    qrImageUrl: '',
};

export async function ensurePaymentSettingsSchema() {
    await query(`
        IF OBJECT_ID(N'dbo.payment_settings', N'U') IS NULL
        CREATE TABLE dbo.payment_settings (
            id INT NOT NULL CONSTRAINT PK_payment_settings PRIMARY KEY DEFAULT 1,
            promptpay_id NVARCHAR(20) NULL,
            bank_name NVARCHAR(100) NULL,
            bank_account NVARCHAR(40) NULL,
            account_name NVARCHAR(100) NULL,
            qr_image_url NVARCHAR(500) NULL,
            updated_at DATETIME2 NOT NULL CONSTRAINT DF_payment_settings_updated DEFAULT SYSUTCDATETIME(),
            CONSTRAINT CK_payment_settings_singleton CHECK (id = 1)
        )`);
    await query(`
        IF NOT EXISTS (SELECT 1 FROM dbo.payment_settings WHERE id = 1)
            INSERT INTO dbo.payment_settings (id) VALUES (1)`);
}

function mapRow(row) {
    if (!row) {
        return { ...DEFAULTS };
    }
    return {
        promptpayId: row.promptpay_id || '',
        bankName: row.bank_name || '',
        bankAccount: row.bank_account || '',
        accountName: row.account_name || '',
        qrImageUrl: row.qr_image_url || '',
        updatedAt: row.updated_at || null,
    };
}

export async function getPaymentSettings() {
    await ensurePaymentSettingsSchema();
    const result = await query(`SELECT TOP 1 * FROM dbo.payment_settings WHERE id = 1`);
    return mapRow(result.recordset[0]);
}

export async function updatePaymentSettings(input) {
    await ensurePaymentSettingsSchema();
    await query(
        `UPDATE dbo.payment_settings SET
            promptpay_id = @promptpayId,
            bank_name = @bankName,
            bank_account = @bankAccount,
            account_name = @accountName,
            qr_image_url = @qrImageUrl,
            updated_at = SYSUTCDATETIME()
         WHERE id = 1`,
        {
            promptpayId: String(input.promptpayId ?? '').trim() || null,
            bankName: String(input.bankName ?? '').trim() || null,
            bankAccount: String(input.bankAccount ?? '').trim() || null,
            accountName: String(input.accountName ?? '').trim() || null,
            qrImageUrl: String(input.qrImageUrl ?? '').trim() || null,
        },
    );
    return getPaymentSettings();
}

export function paymentConfigured(settings) {
    return Boolean(
        settings?.promptpayId
        || settings?.qrImageUrl
        || (settings?.bankName && settings?.bankAccount),
    );
}
