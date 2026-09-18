import { useEffect, useState } from 'react';
import { Badge, Button, Card, Field, Input, Modal, Spinner } from '@components/ui';
import { api } from '@app/services/apiClient';
import { useApp } from '@app/context/AppContext';

const EMPTY_PKG = {
    nameTh: '',
    nameEn: '',
    hours: '',
    price: '',
    noteTh: '',
    noteEn: '',
    tagTh: '',
    tagEn: '',
    tone: 'pink',
    active: true,
};

export default function Packages() {
    const { language, t, toast } = useApp();
    const [packages, setPackages] = useState(null);
    const [pkgOpen, setPkgOpen] = useState(false);
    const [pkgForm, setPkgForm] = useState(EMPTY_PKG);
    const [editingId, setEditingId] = useState(null);
    const [pkgBusy, setPkgBusy] = useState(false);
    const [paymentForm, setPaymentForm] = useState({
        promptpayId: '',
        bankName: '',
        bankAccount: '',
        accountName: '',
        qrImageUrl: '',
    });
    const [paymentBusy, setPaymentBusy] = useState(false);

    const loadPackages = () => api.getAdminPackages().then(setPackages).catch(() => setPackages([]));

    useEffect(() => {
        loadPackages();
        api.getSettings()
            .then((settings) => {
                const payment = settings.integrations?.payment ?? {};
                setPaymentForm({
                    promptpayId: payment.promptpayId || '',
                    bankName: payment.bankName || '',
                    bankAccount: payment.bankAccount || '',
                    accountName: payment.accountName || '',
                    qrImageUrl: payment.qrImageUrl || '',
                });
            })
            .catch(() => {});
    }, [language]);

    const hoursUnit = language === 'en' ? 'hrs' : 'ชม.';

    const openPackageModal = (pkg = null) => {
        if (pkg) {
            setEditingId(pkg.id);
            setPkgForm({
                nameTh: pkg.nameTh ?? pkg.name,
                nameEn: pkg.nameEn ?? '',
                hours: String(pkg.hours),
                price: String(pkg.price),
                noteTh: pkg.noteTh ?? pkg.note ?? '',
                noteEn: pkg.noteEn ?? '',
                tagTh: pkg.tagTh ?? pkg.tag ?? '',
                tagEn: pkg.tagEn ?? '',
                tone: pkg.tone ?? 'pink',
                active: pkg.active,
            });
        }
        else {
            setEditingId(null);
            setPkgForm(EMPTY_PKG);
        }
        setPkgOpen(true);
    };

    const savePackage = async () => {
        if (!pkgForm.nameTh.trim() || !pkgForm.hours || pkgForm.price === '') {
            toast(t('offers.needFields'));
            return;
        }
        setPkgBusy(true);
        try {
            const payload = {
                name: pkgForm.nameTh.trim(),
                nameEn: pkgForm.nameEn.trim() || pkgForm.nameTh.trim(),
                hours: Number(pkgForm.hours),
                price: Number(pkgForm.price),
                note: pkgForm.noteTh.trim() || null,
                noteEn: pkgForm.noteEn.trim() || null,
                tag: pkgForm.tagTh.trim() || null,
                tagEn: pkgForm.tagEn.trim() || null,
                tone: pkgForm.tone,
                active: pkgForm.active,
            };
            if (editingId) {
                await api.updatePackage(editingId, payload);
            }
            else {
                await api.createPackage(payload);
            }
            toast(t('settings.packageSaved'), 'ok');
            setPkgOpen(false);
            await loadPackages();
        }
        catch (err) {
            toast(err instanceof Error ? err.message : t('settings.packageFailed'));
        }
        finally {
            setPkgBusy(false);
        }
    };

    const togglePackage = async (pkg) => {
        setPkgBusy(true);
        try {
            await api.updatePackage(pkg.id, { active: !pkg.active });
            await loadPackages();
        }
        catch (err) {
            toast(err instanceof Error ? err.message : t('settings.packageFailed'));
        }
        finally {
            setPkgBusy(false);
        }
    };

    const savePayment = async () => {
        setPaymentBusy(true);
        try {
            await api.updatePaymentSettings(paymentForm);
            toast(t('settings.paymentSaved'), 'ok');
        }
        catch (err) {
            toast(err instanceof Error ? err.message : t('settings.paymentFailed'));
        }
        finally {
            setPaymentBusy(false);
        }
    };

    if (!packages) {
        return <Spinner />;
    }

    return (<>
      <div className="grid cols-2 settings-grid">
      <Card
        className="span-2"
        title={t('settings.packages')}
        action={(
          <Button pink size="sm" onClick={() => openPackageModal()}>
            {t('settings.addPackage')}
          </Button>
        )}
      >
        {packages.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>{language === 'en' ? 'No packages yet' : 'ยังไม่มีแพ็กเกจ'}</p>
        ) : (
          <div className="pkg-admin-grid">
            {packages.map((pkg) => (
              <div key={pkg.id} className="toggle-row">
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{pkg.name} · {pkg.hours} {hoursUnit}</div>
                  <div className="muted" style={{ fontSize: 11 }}>฿{Number(pkg.price).toLocaleString()}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Badge tone={pkg.active ? 'green' : 'gray'}>{pkg.active ? t('settings.active') : t('settings.inactive')}</Badge>
                  <Button size="sm" ghost onClick={() => openPackageModal(pkg)} disabled={pkgBusy}>{t('settings.editPackage')}</Button>
                  <Button size="sm" ghost onClick={() => togglePackage(pkg)} disabled={pkgBusy}>
                    {pkg.active ? t('settings.inactive') : t('settings.active')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="pagetip">{t('settings.packageTip')}</div>
      </Card>

      <Card className="span-2" title={t('settings.paymentSetup')}>
        <div className="two-col">
          <Field label={t('settings.promptpayId')}>
            <Input value={paymentForm.promptpayId} onChange={(e) => setPaymentForm((current) => ({ ...current, promptpayId: e.target.value }))}/>
          </Field>
          <Field label={t('settings.bankName')}>
            <Input value={paymentForm.bankName} onChange={(e) => setPaymentForm((current) => ({ ...current, bankName: e.target.value }))}/>
          </Field>
        </div>
        <div className="two-col">
          <Field label={t('settings.bankAccount')}>
            <Input value={paymentForm.bankAccount} onChange={(e) => setPaymentForm((current) => ({ ...current, bankAccount: e.target.value }))}/>
          </Field>
          <Field label={t('settings.accountName')}>
            <Input value={paymentForm.accountName} onChange={(e) => setPaymentForm((current) => ({ ...current, accountName: e.target.value }))}/>
          </Field>
        </div>
        <Field label={t('settings.qrImageUrl')}>
          <Input value={paymentForm.qrImageUrl} onChange={(e) => setPaymentForm((current) => ({ ...current, qrImageUrl: e.target.value }))}/>
        </Field>
        <Button pink style={{ width: '100%' }} onClick={savePayment} disabled={paymentBusy}>
          {paymentBusy ? t('settings.savingPayment') : t('settings.savePayment')}
        </Button>
        <div className="pagetip">{t('settings.paymentSetupTip')}</div>
      </Card>
      </div>

      <Modal open={pkgOpen} onClose={() => setPkgOpen(false)} title={editingId ? t('settings.editPackage') : t('settings.addPackage')}>
        <Field label={t('settings.packageName')} required>
          <Input value={pkgForm.nameTh} onChange={(e) => setPkgForm((current) => ({ ...current, nameTh: e.target.value }))}/>
        </Field>
        <Field label={t('settings.packageNameEn')}>
          <Input value={pkgForm.nameEn} onChange={(e) => setPkgForm((current) => ({ ...current, nameEn: e.target.value }))}/>
        </Field>
        <div className="two-col">
          <Field label={t('settings.packageHours')} required>
            <Input type="number" min="1" value={pkgForm.hours} onChange={(e) => setPkgForm((current) => ({ ...current, hours: e.target.value }))}/>
          </Field>
          <Field label={t('settings.packagePrice')} required>
            <Input type="number" min="0" value={pkgForm.price} onChange={(e) => setPkgForm((current) => ({ ...current, price: e.target.value }))}/>
          </Field>
        </div>
        <Field label={t('settings.packageNote')}>
          <Input value={pkgForm.noteTh} onChange={(e) => setPkgForm((current) => ({ ...current, noteTh: e.target.value }))}/>
        </Field>
        <Field label={t('settings.packageNoteEn')}>
          <Input value={pkgForm.noteEn} onChange={(e) => setPkgForm((current) => ({ ...current, noteEn: e.target.value }))}/>
        </Field>
        <label className="check-row" style={{ marginBottom: 14 }}>
          <input type="checkbox" checked={pkgForm.active} onChange={(e) => setPkgForm((current) => ({ ...current, active: e.target.checked }))}/>
          {t('settings.enableSale')}
        </label>
        <Button pink style={{ width: '100%' }} onClick={savePackage} disabled={pkgBusy}>
          {pkgBusy ? t('settings.savingPackage') : t('settings.savePackage')}
        </Button>
      </Modal>
    </>);
}
