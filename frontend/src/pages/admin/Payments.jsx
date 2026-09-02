import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge, Button, Card, Spinner } from '@components/ui';
import { AuthenticatedSlipImage } from '@components/admin/AuthenticatedSlipImage';
import { SlipPreviewModal } from '@components/admin/SlipPreviewModal';
import { api } from '@app/services/apiClient';
import { useApp } from '@app/context/AppContext';

export default function Payments() {
    const { language, t, toast } = useApp();
    const [rows, setRows] = useState(null);
    const [busyRef, setBusyRef] = useState('');
    const [previewRef, setPreviewRef] = useState(null);
    const [searchParams, setSearchParams] = useSearchParams();

    const load = () => api.getPendingPayments().then(setRows).catch(() => setRows([]));

    useEffect(() => {
        load();
    }, [language]);

    useEffect(() => {
        const ref = searchParams.get('ref');
        const openSlip = searchParams.get('slip') === '1';
        if (!ref || !openSlip || !rows) {
            return;
        }
        const exists = rows.some((row) => row.refNo === ref);
        if (exists) {
            setPreviewRef(ref);
        }
        setSearchParams({}, { replace: true });
    }, [rows, searchParams, setSearchParams]);

    const confirm = async (refNo) => {
        setBusyRef(refNo);
        try {
            await api.confirmPayment(refNo);
            toast(t('payments.confirmOk'), 'ok');
            await load();
        }
        catch (err) {
            toast(err instanceof Error ? err.message : t('payments.confirmFailed'));
        }
        finally {
            setBusyRef('');
        }
    };

    const reject = async (refNo) => {
        setBusyRef(refNo);
        try {
            await api.rejectPayment(refNo);
            toast(t('payments.rejectOk'), 'ok');
            await load();
        }
        catch (err) {
            toast(err instanceof Error ? err.message : t('payments.rejectFailed'));
        }
        finally {
            setBusyRef('');
        }
    };

    if (!rows) {
        return <Spinner />;
    }

    return (
      <>
      <Card title={t('payments.title')} action={<Badge tone="amber">{rows.length}</Badge>}>
        <div className="pagetip" style={{ marginBottom: 12 }}>{t('payments.subtitle')}</div>
        {rows.length === 0 ? (
          <div className="empty">{t('payments.empty')}</div>
        ) : rows.map((row) => (
          <div key={row.refNo} className="toggle-row">
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{row.student} · {row.label}</div>
              <div className="muted" style={{ fontSize: 11 }}>
                {row.refNo} · ฿{Number(row.amount).toLocaleString()} · {row.hours} {language === 'en' ? 'hrs' : 'ชม.'}
              </div>
              {row.studentNote && (
                <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{row.studentNote}</div>
              )}
              {row.hasSlip && (
                <button
                  type="button"
                  className="link"
                  style={{ fontSize: 11, marginTop: 6, padding: 0, border: 0, background: 'none', cursor: 'pointer' }}
                  onClick={() => setPreviewRef(row.refNo)}
                >
                  {t('payments.viewSlip')}
                </button>
              )}
              {row.status === 'awaiting_confirm' && !row.hasSlip && (
                <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                  {language === 'en' ? 'No slip attached — ask the student to resubmit with a slip photo.' : 'ยังไม่มีสลิป — ให้นักเรียนแจ้งโอนใหม่พร้อมแนบรูปสลิป'}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {row.hasSlip && (
                <button type="button" onClick={() => setPreviewRef(row.refNo)} style={{ padding: 0, border: 0, background: 'none', cursor: 'pointer' }}>
                  <AuthenticatedSlipImage
                    fetchPath={`/teacher/payments/${encodeURIComponent(row.refNo)}/slip`}
                    alt={t('payments.viewSlip')}
                    className="slip-thumb"
                    loadingLabel="…"
                    failedLabel="!"
                  />
                </button>
              )}
              <Badge tone={row.status === 'awaiting_confirm' ? 'amber' : 'pink'}>
                {row.status === 'awaiting_confirm' ? t('payments.awaiting') : t('payments.pending')}
              </Badge>
              <Button size="sm" green disabled={busyRef === row.refNo} onClick={() => confirm(row.refNo)}>
                {t('payments.confirm')}
              </Button>
              <Button size="sm" ghost disabled={busyRef === row.refNo} onClick={() => reject(row.refNo)}>
                {t('payments.reject')}
              </Button>
            </div>
          </div>
        ))}
      </Card>
      <SlipPreviewModal
        open={Boolean(previewRef)}
        refNo={previewRef}
        language={language}
        onClose={() => setPreviewRef(null)}
      />
      </>
    );
}
