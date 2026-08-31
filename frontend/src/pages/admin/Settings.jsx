import { useEffect, useState } from 'react';
import { Badge, Button, Card, Field, Input, Kpi, Modal, Spinner } from '@components/ui';
import { BellIcon, CalendarIcon, GraduationIcon, MicIcon } from '@components/icons';
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

function Row({ k, v }) {
    return (
      <div className="info-row">
        <span className="muted">{k}</span>
        <b>{v}</b>
      </div>
    );
}

function Status({ on, onLabel, offLabel }) {
    return (
      <Badge tone={on ? 'green' : 'gray'}>
        {on ? onLabel : offLabel}
      </Badge>
    );
}

export default function Settings() {
    const { language, t, toast } = useApp();
    const [data, setData] = useState(null);
    const [packages, setPackages] = useState([]);
    const [pkgOpen, setPkgOpen] = useState(false);
    const [pkgForm, setPkgForm] = useState(EMPTY_PKG);
    const [editingId, setEditingId] = useState(null);
    const [pkgBusy, setPkgBusy] = useState(false);

    const loadPackages = () => api.getAdminPackages().then(setPackages).catch(() => setPackages([]));

    useEffect(() => {
        api.getSettings()
            .then(setData)
            .catch((err) => toast(err instanceof Error ? err.message : t('settings.loadFailed')));
        loadPackages();
    }, [language, t, toast]);

    if (!data) {
        return <Spinner />;
    }

    const lastRun = data.jobs.lastRunAt
        ? new Date(data.jobs.lastRunAt).toLocaleString(language === 'en' ? 'en-GB' : 'th-TH')
        : t('settings.neverRun');
    const hoursUnit = language === 'en' ? 'hrs' : 'ชม.';
    const paymentLabel = data.integrations.payment.mode === 'mock'
        ? t('settings.paymentMock')
        : t('settings.paymentLive');

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

    return (
      <>
        <div className="grid cols-4" style={{ marginBottom: 18 }}>
          <Kpi
            tone="green"
            icon={<GraduationIcon width={19} height={19}/>}
            value={String(data.accounts.student)}
            label={t('settings.kpiStudents')}
            sub={t('settings.kpiActive')}
          />
          <Kpi
            tone="pink"
            icon={<MicIcon width={19} height={19}/>}
            value={String(data.accounts.teacher)}
            label={t('settings.kpiTeachers')}
            sub={t('settings.kpiActive')}
          />
          <Kpi
            tone="blue"
            icon={<CalendarIcon width={19} height={19}/>}
            value={String(data.accounts.upcomingLessons)}
            label={t('settings.kpiUpcoming')}
            sub={t('settings.kpiBooked')}
          />
          <Kpi
            tone="gold"
            icon={<BellIcon width={19} height={19}/>}
            value={String(data.jobs.lastReminded ?? 0)}
            label={t('settings.kpiReminded')}
            sub={lastRun}
          />
        </div>

        <div className="grid cols-2">
          <Card title={t('settings.school')} action={<Badge tone="pink">{t('settings.liveOps')}</Badge>}>
            <Row k={t('settings.schoolName')} v={data.school.name}/>
            <Row k={t('settings.publicUrl')} v={data.school.publicUrl}/>
            <Row k={t('settings.classType')} v={data.school.studio}/>
            <Row k={t('settings.workingHours')} v={data.schedule.workingHours}/>
            <Row k={t('settings.closedDay')} v={data.school.closedDay}/>
            <div className="pagetip">{t('settings.schoolTip')}</div>
          </Card>

          <Card
            title={t('settings.packages')}
            action={(
              <Button pink size="sm" onClick={() => openPackageModal()}>
                {t('settings.addPackage')}
              </Button>
            )}
          >
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
            <div className="pagetip">{t('settings.packageTip')}</div>
          </Card>

          <Card title={t('settings.slots')}>
            <Row k={t('settings.slotLength')} v={`${data.schedule.slotMinutes} ${language === 'en' ? 'minutes' : 'นาที'}`}/>
            <Row k={t('settings.times')} v={data.schedule.slotTimes.join(', ')}/>
            <Row k={t('settings.confirmRule')} v={t('settings.confirmRuleVal').replace('{n}', String(data.schedule.confirmHours))}/>
            <Row k={t('settings.cancelRule')} v={t('settings.cancelRuleVal').replace('{n}', String(data.schedule.cancelHours))}/>
            <div className="pagetip">{t('settings.slotTip')}</div>
          </Card>

          <Card title={t('settings.integrations')}>
            <div className="toggle-row">
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{t('settings.lineLogin')}</div>
                <div className="muted" style={{ fontSize: 11 }}>
                  {data.integrations.lineLogin.configured ? t('settings.lineLoginOn') : t('settings.lineLoginOff')}
                </div>
              </div>
              <Status
                on={data.integrations.lineLogin.configured}
                onLabel={t('settings.ready')}
                offLabel={t('settings.notConnected')}
              />
            </div>
            <div className="toggle-row">
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{t('settings.lineOa')}</div>
                <div className="muted" style={{ fontSize: 11 }}>
                  {data.integrations.lineOa.connected ? t('settings.lineOaOn') : t('settings.lineOaOff')}
                </div>
              </div>
              <Status
                on={data.integrations.lineOa.connected}
                onLabel={t('settings.ready')}
                offLabel={t('settings.notConnected')}
              />
            </div>
            <div className="toggle-row">
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{t('settings.payment')}</div>
                <div className="muted" style={{ fontSize: 11 }}>{paymentLabel}</div>
              </div>
              <Badge tone="amber">{t('settings.sandbox')}</Badge>
            </div>
            <div className="pagetip">{t('settings.integrationTip')}</div>
          </Card>

          <Card title={t('settings.jobs')}>
            <div className="toggle-row">
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{t('settings.dayBefore')}</div>
                <div className="muted" style={{ fontSize: 11 }}>{t('settings.dayBeforeHint')}</div>
              </div>
              <Status on={data.jobs.dayBefore.enabled} onLabel={t('settings.on')} offLabel={t('settings.off')}/>
            </div>
            <div className="toggle-row">
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{t('settings.expirePending')}</div>
                <div className="muted" style={{ fontSize: 11 }}>{t('settings.expirePendingHint')}</div>
              </div>
              <Status on={data.jobs.expireUnconfirmed.enabled} onLabel={t('settings.on')} offLabel={t('settings.off')}/>
            </div>
            <div className="toggle-row">
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{t('settings.expiry')}</div>
                <div className="muted" style={{ fontSize: 11 }}>{t('settings.expiryHint')}</div>
              </div>
              <Status on={false} onLabel={t('settings.on')} offLabel={t('settings.off')}/>
            </div>
            <Row k={t('settings.lastJob')} v={lastRun}/>
            <Row k={t('settings.lastExpired')} v={String(data.jobs.lastExpired ?? 0)}/>
            <Row k={t('settings.lastReminded')} v={String(data.jobs.lastReminded ?? 0)}/>
          </Card>

          <Card title={t('settings.security')}>
            <Row k={t('settings.database')} v={data.data.database}/>
            <Row k={t('settings.sqlHost')} v={data.data.sqlHost || '—'}/>
            <Row
              k={t('settings.tls')}
              v={data.data.https ? t('settings.tlsOn') : t('settings.tlsOff')}
            />
            <Row k={t('settings.rbac')} v={t('settings.rbacVal')}/>
            <Row k={t('settings.backup')} v={t('settings.backupVal')}/>
            <Row k={t('settings.pdpa')} v={t('settings.pdpaVal')}/>
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
      </>
    );
}
