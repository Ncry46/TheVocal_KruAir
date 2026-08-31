import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Field, Input, Modal, Spinner, Table } from '@components/ui';
import { api } from '@app/services/apiClient';
import { useApp } from '@app/context/AppContext';

const EMPTY_OFFER = {
    title: '',
    titleEn: '',
    hours: '',
    price: '',
    grantNow: true,
};

function offerTone(status) {
    if (status === 'granted') {
        return 'green';
    }
    if (status === 'pending_payment') {
        return 'amber';
    }
    return 'gray';
}

export default function Students() {
    const { language, t, toast } = useApp();
    const [rows, setRows] = useState(null);
    const [q, setQ] = useState('');
    const [offerOpen, setOfferOpen] = useState(false);
    const [selected, setSelected] = useState(null);
    const [offers, setOffers] = useState([]);
    const [form, setForm] = useState(EMPTY_OFFER);
    const [busy, setBusy] = useState(false);

    const load = () => api.getStudents().then(setRows);

    useEffect(() => {
        load();
    }, [language]);

    const filtered = useMemo(() => {
        const list = rows ?? [];
        const needle = q.trim().toLowerCase();
        if (!needle) {
            return list;
        }
        return list.filter((row) => row.name.toLowerCase().includes(needle) || row.pkg.toLowerCase().includes(needle));
    }, [rows, q]);

    const openOfferModal = async (student) => {
        setSelected(student);
        setForm(EMPTY_OFFER);
        setOfferOpen(true);
        try {
            const list = await api.getStudentOffers(student.id);
            setOffers(list);
        }
        catch {
            setOffers([]);
        }
    };

    const createOffer = async () => {
        if (!selected || !form.title.trim() || !form.hours || form.price === '') {
            toast(t('offers.needFields'));
            return;
        }
        setBusy(true);
        try {
            await api.createStudentOffer(selected.id, {
                title: form.title.trim(),
                titleEn: form.titleEn.trim() || form.title.trim(),
                hours: Number(form.hours),
                price: Number(form.price),
                grantNow: form.grantNow,
            });
            toast(t('offers.createdOk'), 'ok');
            setForm(EMPTY_OFFER);
            setOffers(await api.getStudentOffers(selected.id));
            await load();
        }
        catch (err) {
            toast(err instanceof Error ? err.message : t('offers.createFailed'));
        }
        finally {
            setBusy(false);
        }
    };

    const cancelOffer = async (offerId) => {
        setBusy(true);
        try {
            await api.cancelStudentOffer(offerId);
            toast(t('offers.cancelOk'), 'ok');
            if (selected) {
                setOffers(await api.getStudentOffers(selected.id));
            }
        }
        catch (err) {
            toast(err instanceof Error ? err.message : t('offers.cancelFailed'));
        }
        finally {
            setBusy(false);
        }
    };

    const offerLabel = (status) => {
        if (status === 'granted') {
            return t('offers.granted');
        }
        if (status === 'pending_payment') {
            return t('offers.pending');
        }
        return t('offers.cancelled');
    };

    if (!rows) {
        return <Spinner />;
    }

    return (
      <>
        <Card
          title={t('studentsPage.title')}
          action={<Input placeholder={t('studentsPage.search')} value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 230 }}/>}
        >
          <Table
            heads={[t('studentsPage.student'), t('studentsPage.info'), t('studentsPage.package'), t('studentsPage.left'), t('studentsPage.done'), t('studentsPage.status'), '']}
            rows={filtered.map((student) => [
              <b key="n">{student.name}</b>,
              student.info,
              student.pkg === '—' ? <span key="p" className="muted">—</span> : student.pkg,
              student.left > 0 ? <b key="l" className="accent">{student.left} {t('studentsPage.hours')}</b> : <span key="l" className="muted">0</span>,
              `${student.done} ${t('studentsPage.classes')}`,
              student.state === 'active'
                  ? <Badge key="st" tone="green">{t('studentsPage.active')}</Badge>
                  : student.state === 'new'
                      ? <Badge key="st" tone="blue">{t('studentsPage.new')}</Badge>
                      : <Badge key="st" tone="gray">{t('studentsPage.expired')}</Badge>,
              <Button key="a" size="sm" pink onClick={() => openOfferModal(student)}>{t('studentsPage.addCourse')}</Button>,
            ])}
          />
        </Card>

        <Modal open={offerOpen} onClose={() => setOfferOpen(false)} title={`${t('offers.addCourse')} — ${selected?.name ?? ''}`}>
          <Field label={t('offers.courseTitle')} required>
            <Input value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}/>
          </Field>
          <Field label={t('offers.courseTitleEn')}>
            <Input value={form.titleEn} onChange={(e) => setForm((current) => ({ ...current, titleEn: e.target.value }))}/>
          </Field>
          <div className="two-col">
            <Field label={t('offers.courseHours')} required>
              <Input type="number" min="1" value={form.hours} onChange={(e) => setForm((current) => ({ ...current, hours: e.target.value }))}/>
            </Field>
            <Field label={t('offers.coursePrice')} required>
              <Input type="number" min="0" value={form.price} onChange={(e) => setForm((current) => ({ ...current, price: e.target.value }))}/>
            </Field>
          </div>
          <div className="chip-row" style={{ marginBottom: 14 }}>
            <button type="button" className={`dchip ${form.grantNow ? 'on' : ''}`} onClick={() => setForm((current) => ({ ...current, grantNow: true }))}>
              {t('offers.grantNow')}
            </button>
            <button type="button" className={`dchip ${!form.grantNow ? 'on' : ''}`} onClick={() => setForm((current) => ({ ...current, grantNow: false }))}>
              {t('offers.pendingPayment')}
            </button>
          </div>
          <Button pink style={{ width: '100%', marginBottom: 16 }} onClick={createOffer} disabled={busy}>
            {busy ? t('offers.creating') : t('offers.create')}
          </Button>

          {offers.length > 0 && (
            <div>
              <div className="grp">{t('offers.existing')}</div>
              {offers.map((offer) => (
                <div key={offer.id} className="toggle-row">
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{offer.title} · {offer.hours} {t('offers.hours')} · ฿{Number(offer.price).toLocaleString()}</div>
                    <div className="muted" style={{ fontSize: 11 }}>{offer.createdAt}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Badge tone={offerTone(offer.status)}>{offerLabel(offer.status)}</Badge>
                    {offer.status === 'pending_payment' && (
                      <Button size="sm" ghost danger onClick={() => cancelOffer(offer.id)} disabled={busy}>{t('offers.cancel')}</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      </>
    );
}
