import { useEffect, useState } from 'react';
import { Badge, Button, Card, Field, Input, Modal, Spinner, Table } from '@components/ui';
import { api } from '@app/services/apiClient';
import { useApp } from '@app/context/AppContext';

const EMPTY_FORM = {
    code: '',
    type: 'fixed',
    value: '',
    maxDiscount: '',
    validTo: '',
    maxUses: '',
};

export default function Vouchers() {
    const { language, t, toast } = useApp();
    const [rows, setRows] = useState(null);
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [busy, setBusy] = useState(false);

    const load = () => api.getVouchers().then(setRows);

    useEffect(() => {
        load();
    }, [language]);

    const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

    const create = async () => {
        if (!form.code.trim() || !form.value) {
            toast(t('vouchers.needFields'));
            return;
        }
        setBusy(true);
        try {
            await api.createVoucher({
                code: form.code.trim(),
                type: form.type,
                value: Number(form.value),
                maxDiscount: form.type === 'percent' && form.maxDiscount ? Number(form.maxDiscount) : null,
                validTo: form.validTo || null,
                maxUses: form.maxUses ? Number(form.maxUses) : null,
                isActive: true,
            });
            setOpen(false);
            setForm(EMPTY_FORM);
            toast(t('vouchers.createdOk'), 'ok');
            await load();
        }
        catch (err) {
            toast(err instanceof Error ? err.message : t('vouchers.createFailed'));
        }
        finally {
            setBusy(false);
        }
    };

    const toggle = async (row) => {
        const nextActive = row.state !== 'active';
        setBusy(true);
        try {
            await api.setVoucherStatus(row.code, nextActive);
            toast(nextActive ? t('vouchers.enabledOk') : t('vouchers.disabledOk'), 'ok');
            await load();
        }
        catch (err) {
            toast(err instanceof Error ? err.message : t('vouchers.updateFailed'));
        }
        finally {
            setBusy(false);
        }
    };

    if (!rows) {
        return <Spinner />;
    }

    return (<>
      <Card title={t('vouchers.title')} action={<Button pink size="sm" onClick={() => { setForm(EMPTY_FORM); setOpen(true); }}>
            {t('vouchers.add')}
          </Button>}>
        <Table
          heads={[t('vouchers.code'), t('vouchers.type'), t('vouchers.expires'), t('vouchers.used'), t('vouchers.status'), '']}
          rows={rows.map((voucher) => [
            <b key="c" className="mono">{voucher.code}</b>,
            voucher.type,
            voucher.expires,
            <b key="u">{voucher.used}</b>,
            voucher.state === 'active'
                ? <Badge key="st" tone="green">{t('vouchers.active')}</Badge>
                : <Badge key="st" tone="gray">{t('vouchers.disabled')}</Badge>,
            voucher.state === 'active' ? (
              <Button key="a" danger size="sm" onClick={() => toggle(voucher)} disabled={busy}>
                {t('vouchers.disable')}
              </Button>
            ) : (
              <Button key="a" ghost size="sm" onClick={() => toggle(voucher)} disabled={busy}>
                {t('vouchers.enable')}
              </Button>
            ),
          ])}
        />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={t('vouchers.create')}>
        <Field label={t('vouchers.code')} required>
          <Input placeholder={t('vouchers.codePlaceholder')} value={form.code} onChange={(event) => setField('code', event.target.value)}/>
        </Field>
        <Field label={t('vouchers.discountType')}>
          <select className="input" value={form.type} onChange={(event) => setField('type', event.target.value)}>
            <option value="fixed">{t('vouchers.typeFixed')}</option>
            <option value="percent">{t('vouchers.typePercent')}</option>
          </select>
        </Field>
        <Field label={form.type === 'percent' ? t('vouchers.percentValue') : t('vouchers.bahtValue')} required>
          <Input type="number" min="1" placeholder={form.type === 'percent' ? '10' : '500'} value={form.value} onChange={(event) => setField('value', event.target.value)}/>
        </Field>
        {form.type === 'percent' && (
          <Field label={t('vouchers.maxDiscount')}>
            <Input type="number" min="0" placeholder={t('vouchers.maxDiscountPh')} value={form.maxDiscount} onChange={(event) => setField('maxDiscount', event.target.value)}/>
          </Field>
        )}
        <Field label={t('vouchers.validTo')}>
          <Input type="date" value={form.validTo} onChange={(event) => setField('validTo', event.target.value)}/>
        </Field>
        <Field label={t('vouchers.maxUses')}>
          <Input type="number" min="1" placeholder={t('vouchers.maxUsesPh')} value={form.maxUses} onChange={(event) => setField('maxUses', event.target.value)}/>
        </Field>
        <Button pink style={{ width: '100%' }} onClick={create} disabled={busy}>
          {busy ? t('vouchers.creating') : t('vouchers.create')}
        </Button>
      </Modal>
    </>);
}
