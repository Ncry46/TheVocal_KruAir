import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge, Button, Card, Input, Spinner } from '@components/ui';
import { AuthenticatedSlipImage } from '@components/admin/AuthenticatedSlipImage';
import { SlipPreviewModal } from '@components/admin/SlipPreviewModal';
import { downloadAuthenticatedSlip } from '@components/admin/downloadAuthenticatedSlip';
import { api } from '@app/services/apiClient';
import { useApp } from '@app/context/AppContext';

export default function Payments() {
    const { language, t, toast } = useApp();
    const [rows, setRows] = useState(null);
    const [query, setQuery] = useState('');
    const [busyRef, setBusyRef] = useState('');
    const [downloadRef, setDownloadRef] = useState('');
    const [previewRef, setPreviewRef] = useState(null);
    const [searchParams, setSearchParams] = useSearchParams();

    const load = () => api.getPendingPayments().then(setRows).catch(() => setRows([]));

    useEffect(() => {
        load();
    }, [language]);

    useEffect(() => {
        const ref = searchParams.get('ref');
        if (!ref || !rows) {
            return;
        }
        // Deep-link highlights the payment row; do not auto-open the large slip modal.
        const card = document.getElementById(`pay-ref-${ref}`);
        card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setSearchParams({}, { replace: true });
    }, [rows, searchParams, setSearchParams]);

    const filtered = useMemo(() => {
        const list = rows ?? [];
        const needle = query.trim().toLowerCase();
        if (!needle) {
            return list;
        }
        return list.filter((row) => (
            [row.student, row.studentEn, row.fullName, row.email, row.refNo, row.label]
                .some((value) => String(value ?? '').toLowerCase().includes(needle))
        ));
    }, [rows, query]);

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

    const downloadSlip = async (refNo) => {
        setDownloadRef(refNo);
        try {
            await downloadAuthenticatedSlip(
                `/teacher/payments/${encodeURIComponent(refNo)}/slip`,
                { filenameBase: `slip-${refNo}` },
            );
            toast(t('payments.downloadOk'), 'ok');
        }
        catch {
            toast(t('payments.downloadFailed'));
        }
        finally {
            setDownloadRef('');
        }
    };

    if (!rows) {
        return <Spinner />;
    }

    return (
      <>
      <Card
        title={t('payments.title')}
        action={<Badge tone="amber">{filtered.length}{query.trim() ? ` / ${rows.length}` : ''}</Badge>}
      >
        <div className="pagetip">{t('payments.subtitle')}</div>

        <div className="pay-review-toolbar">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('payments.searchPlaceholder')}
            aria-label={t('payments.searchPlaceholder')}
          />
          {query.trim() && (
            <Button ghost size="sm" type="button" onClick={() => setQuery('')}>
              {t('payments.clearSearch')}
            </Button>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="empty">{t('payments.empty')}</div>
        ) : filtered.length === 0 ? (
          <div className="empty">{t('payments.searchEmpty')}</div>
        ) : (
          <div className="pay-review-list">
            {filtered.map((row) => (
              <article
                key={row.refNo}
                id={`pay-ref-${row.refNo}`}
                className="pay-review-card"
              >
                <div className="pay-review-main">
                  {row.hasSlip ? (
                    <button
                      type="button"
                      className="pay-review-slip"
                      onClick={() => setPreviewRef(row.refNo)}
                      aria-label={t('payments.viewSlip')}
                    >
                      <AuthenticatedSlipImage
                        fetchPath={`/teacher/payments/${encodeURIComponent(row.refNo)}/slip`}
                        alt={t('payments.viewSlip')}
                        className="slip-thumb"
                        loadingLabel="…"
                        failedLabel="!"
                      />
                    </button>
                  ) : (
                    <div className="pay-review-slip pay-review-slip-empty muted">
                      {language === 'en' ? 'No slip' : 'ไม่มีสลิป'}
                    </div>
                  )}

                  <div className="pay-review-info">
                    <div className="pay-review-title-row">
                      <h3 className="pay-review-name">{row.student}</h3>
                      <Badge tone={row.status === 'awaiting_confirm' ? 'amber' : 'pink'}>
                        {row.status === 'awaiting_confirm' ? t('payments.awaiting') : t('payments.pending')}
                      </Badge>
                    </div>
                    <div className="pay-review-package">{row.label}</div>
                    <div className="muted pay-review-meta">
                      {row.refNo} · ฿{Number(row.amount).toLocaleString()} · {row.hours} {language === 'en' ? 'hrs' : 'ชม.'}
                    </div>
                    {row.studentNote && (
                      <div className="muted pay-review-note">{row.studentNote}</div>
                    )}
                    {row.status === 'awaiting_confirm' && !row.hasSlip && (
                      <div className="muted pay-review-note">
                        {language === 'en'
                          ? 'No slip attached — ask the student to resubmit with a slip photo.'
                          : 'ยังไม่มีสลิป — ให้นักเรียนแจ้งโอนใหม่พร้อมแนบรูปสลิป'}
                      </div>
                    )}
                    {row.hasSlip && (
                      <div className="pay-review-slip-links">
                        <button type="button" className="link" onClick={() => setPreviewRef(row.refNo)}>
                          {t('payments.viewSlip')}
                        </button>
                        <button
                          type="button"
                          className="link"
                          disabled={downloadRef === row.refNo}
                          onClick={() => downloadSlip(row.refNo)}
                        >
                          {downloadRef === row.refNo ? t('payments.downloading') : t('payments.downloadSlip')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pay-review-actions">
                  <Button size="sm" green disabled={busyRef === row.refNo} onClick={() => confirm(row.refNo)}>
                    {t('payments.confirm')}
                  </Button>
                  <Button size="sm" ghost disabled={busyRef === row.refNo} onClick={() => reject(row.refNo)}>
                    {t('payments.reject')}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>
      <SlipPreviewModal
        open={Boolean(previewRef)}
        refNo={previewRef}
        language={language}
        onClose={() => setPreviewRef(null)}
        onToast={toast}
      />
      </>
    );
}
