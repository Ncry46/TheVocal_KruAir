import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, Field, Input, Spinner } from '@components/ui';
import { AuthenticatedSlipImage } from '@components/admin/AuthenticatedSlipImage';
import { api } from '@app/services/apiClient';
import { useApp } from '@app/context/AppContext';

const MAX_SLIP_BYTES = 5 * 1024 * 1024;

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('read failed'));
        reader.readAsDataURL(file);
    });
}

export default function Payment() {
    const { ref, token } = useParams();
    const navigate = useNavigate();
    const { language, t, toast } = useApp();
    const [order, setOrder] = useState(null);
    const [note, setNote] = useState('');
    const [slipPreview, setSlipPreview] = useState('');
    const [slipDataUrl, setSlipDataUrl] = useState('');
    const [busy, setBusy] = useState(false);

    const load = async () => {
        if (token) {
            const started = await api.startPaymentLink(token);
            const data = await api.getPurchase(started.refNo);
            setOrder(data);
            return;
        }
        const data = await api.getPurchase(ref);
        setOrder(data);
    };

    useEffect(() => {
        load().catch((err) => {
            toast(err instanceof Error ? err.message : t('payment.loadFailed'));
            navigate('/app/packages');
        });
    }, [ref, token, language]);

    if (!order) {
        return <Spinner />;
    }

    const statusLabel = {
        pending: t('payment.statusPending'),
        awaiting_confirm: t('payment.statusAwaiting'),
        success: t('payment.statusSuccess'),
        cancelled: t('payment.statusCancelled'),
    }[order.status] || order.status;

    const statusTone = order.status === 'success' ? 'green'
        : order.status === 'cancelled' ? 'gray'
            : order.status === 'awaiting_confirm' ? 'amber' : 'pink';

    const notifyPaid = async () => {
        if (!slipDataUrl) {
            toast(t('payment.slipRequired'));
            return;
        }
        setBusy(true);
        try {
            const refNo = token ? order.refNo : ref;
            await api.notifyPurchasePaid(refNo, { note, slipDataUrl });
            toast(t('payment.notifyOk'), 'ok');
            setSlipPreview('');
            setSlipDataUrl('');
            await load();
        }
        catch (err) {
            toast(err instanceof Error ? err.message : t('payment.notifyFailed'));
        }
        finally {
            setBusy(false);
        }
    };

    const onSlipChange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        if (!file.type.startsWith('image/')) {
            toast(t('payment.slipInvalid'));
            event.target.value = '';
            return;
        }
        if (file.size > MAX_SLIP_BYTES) {
            toast(t('payment.slipTooLarge'));
            event.target.value = '';
            return;
        }
        try {
            const dataUrl = await readFileAsDataUrl(file);
            setSlipDataUrl(dataUrl);
            setSlipPreview(URL.createObjectURL(file));
        }
        catch {
            toast(t('payment.slipInvalid'));
        }
    };

    const pay = order.payment || {};

    return (
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <Card title={t('payment.title')} action={<Badge tone={statusTone}>{statusLabel}</Badge>}>
          {order.installmentNo && order.installmentCount > 1 && (
            <div className="info-row">
              <span className="muted">{t('payment.installment')}</span>
              <b>{order.installmentNo}/{order.installmentCount}</b>
            </div>
          )}
          <div className="sumpanel" style={{ marginBottom: 16 }}>
            <div className="sumrow">
              <span className="muted">{t('payment.order')}</span>
              <b>{order.refNo}</b>
            </div>
            <div className="sumrow">
              <span className="muted">{t('payment.item')}</span>
              <b>{order.packageName}</b>
            </div>
            <div className="sumrow total">
              <span>{t('payment.amount')}</span>
              <span className="accent">฿{Number(order.amount).toLocaleString()}</span>
            </div>
          </div>

          {!pay.configured ? (
            <div className="empty">{t('payment.notConfigured')}</div>
          ) : (
            <>
              {pay.qrImageUrl && (
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <img
                    src={pay.qrImageUrl}
                    alt="PromptPay QR"
                    style={{ width: 240, height: 240, borderRadius: 16, background: '#fff', padding: 10, border: '1px solid var(--line)' }}
                  />
                  <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{t('payment.scanQr')}</div>
                </div>
              )}
              <div className="info-row"><span className="muted">{t('payment.promptpay')}</span><b>{pay.promptpayId || '—'}</b></div>
              <div className="info-row"><span className="muted">{t('payment.bank')}</span><b>{pay.bankName || '—'}</b></div>
              <div className="info-row"><span className="muted">{t('payment.account')}</span><b>{pay.bankAccount || '—'}</b></div>
              <div className="info-row"><span className="muted">{t('payment.accountName')}</span><b>{pay.accountName || '—'}</b></div>
            </>
          )}

          {order.status === 'pending' && (
            <>
              <Field label={t('payment.slip')}>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={onSlipChange}
                  style={{ width: '100%' }}
                />
                <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>{t('payment.slipHint')}</div>
                {slipPreview && (
                  <div style={{ marginTop: 12 }}>
                    <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>{t('payment.slipPreview')}</div>
                    <img
                      src={slipPreview}
                      alt={t('payment.slipPreview')}
                      style={{ width: '100%', maxHeight: 480, objectFit: 'contain', borderRadius: 12, border: '1px solid var(--line)', background: '#fff' }}
                    />
                  </div>
                )}
              </Field>
              <Field label={t('payment.note')}>
                <Input placeholder={t('payment.notePlaceholder')} value={note} onChange={(e) => setNote(e.target.value)}/>
              </Field>
              <Button pink style={{ width: '100%', marginTop: 12 }} onClick={notifyPaid} disabled={busy || !pay.configured || !slipDataUrl}>
                {busy ? t('payment.notifying') : t('payment.notifyBtn')}
              </Button>
            </>
          )}

          {order.status === 'awaiting_confirm' && (
            <>
              <div className="pagetip">{t('payment.awaitingTip')}</div>
              {order.hasSlip && (
                <div style={{ marginTop: 12 }}>
                  <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>{t('payment.slipPreview')}</div>
                  <AuthenticatedSlipImage
                    fetchPath={`/purchases/${encodeURIComponent(order.refNo)}/slip`}
                    alt={t('payment.slipPreview')}
                    loadingLabel={t('common.loading')}
                    failedLabel={language === 'en' ? 'Could not load slip' : 'โหลดสลิปไม่ได้'}
                    style={{ width: '100%', maxHeight: 480, objectFit: 'contain', borderRadius: 12, border: '1px solid var(--line)', background: '#fff' }}
                  />
                </div>
              )}
            </>
          )}

          {order.status === 'success' && (
            <Button green style={{ width: '100%', marginTop: 12 }} onClick={() => navigate('/app')}>
              {t('payment.backHome')}
            </Button>
          )}

          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <Link to="/app/packages" className="link">{t('payment.backPackages')}</Link>
          </div>
        </Card>
      </div>
    );
}
