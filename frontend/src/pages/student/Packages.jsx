import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Badge, Button, Card, Field, Input, Spinner } from '@components/ui';
import { CheckIcon, CrownIcon, MusicNoteIcon, PhoneIcon, PinIcon } from '@components/icons';
import { api } from '@app/services/apiClient';
import { useApp } from '@app/context/AppContext';

const PKG_IMG = {
    single: '/img/pkg-desk.jpg',
    beginner: '/img/pkg-desk.jpg',
    pro: '/img/pkg-stage.jpg',
    master: '/img/pkg-studio.jpg',
};

function packageImage(id) {
    return PKG_IMG[id] || '/img/pkg-studio.jpg';
}

export default function Packages() {
    const { language, t, toast } = useApp();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const [pkgs, setPkgs] = useState(null);
    const [offers, setOffers] = useState([]);
    const [links, setLinks] = useState([]);
    const [pkgId, setPkgId] = useState(params.get('pkg') || 'single');
    const [code, setCode] = useState('');
    const [voucher, setVoucher] = useState('');
    const [discount, setDiscount] = useState(0);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        api.getPackages().then(setPkgs).catch(() => setPkgs([]));
        api.getMyOffers().then(setOffers).catch(() => setOffers([]));
        api.getMyPaymentLinks().then(setLinks).catch(() => setLinks([]));
    }, [language]);

    useEffect(() => {
        if (!pkgs?.length) {
            return;
        }
        if (!pkgs.some((pkg) => pkg.id === pkgId)) {
            setPkgId(pkgs[0].id);
        }
    }, [pkgs, pkgId]);

    const pkg = pkgs?.find((item) => item.id === pkgId);
    const total = pkg ? Math.max(0, pkg.price - discount) : 0;

    const selectPackage = (id) => {
        setPkgId(id);
        setVoucher('');
        setDiscount(0);
        setCode('');
    };

    const applyVoucher = async () => {
        if (!pkg || !code.trim()) {
            return;
        }
        setBusy(true);
        try {
            const amount = await api.validateVoucher(code.trim(), pkg.price);
            setVoucher(code.trim().toUpperCase());
            setDiscount(amount);
            toast(`${t('checkout.voucherOk')} ${language === 'en' ? 'Discount' : 'ลด'} ฿${amount.toLocaleString()}`, 'ok');
        }
        catch (err) {
            setVoucher('');
            setDiscount(0);
            toast(err instanceof Error ? err.message : t('checkout.voucherError'));
        }
        finally {
            setBusy(false);
        }
    };

    const startCheckout = async ({ offerId = '' } = {}) => {
        if (busy) {
            return;
        }
        if (!offerId && !pkg) {
            return;
        }
        setBusy(true);
        try {
            const result = await api.purchase(offerId ? '' : pkg.id, voucher, offerId);
            navigate(`/app/pay/${result.refNo}`);
        }
        catch (err) {
            toast(err instanceof Error ? err.message : t('checkout.paymentError'));
        }
        finally {
            setBusy(false);
        }
    };

    const openLink = async (token) => {
        setBusy(true);
        try {
            const result = await api.startPaymentLink(token);
            navigate(`/app/pay/${result.refNo}`);
        }
        catch (err) {
            toast(err instanceof Error ? err.message : t('checkout.paymentError'));
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

    const offerTone = (status) => {
        if (status === 'granted') {
            return 'green';
        }
        if (status === 'pending_payment') {
            return 'amber';
        }
        return 'gray';
    };

    if (!pkgs) {
        return <Spinner />;
    }

    return (
      <div className="checkout-layout">
        <div>
          <div
            className={
              pkgs.length === 1 ? 'pkg-showcase'
                : pkgs.length === 2 ? 'pkg-grid-duo'
                  : 'grid cols-3'
            }
            style={{ marginBottom: 16 }}
          >
            {pkgs.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`pkg ${item.id === pkgId ? 'on' : ''}`}
                onClick={() => selectPackage(item.id)}
              >
                {item.tag && (
                  <div className="crown">
                    <CrownIcon width={13} height={13}/> {item.tag}
                  </div>
                )}
                <div className="top">
                  <img src={packageImage(item.id)} alt={item.name} loading="lazy"/>
                  <span className="top-em">
                    <MusicNoteIcon width={24} height={24}/>
                  </span>
                </div>
                <div className="body">
                  <div className="nm">{item.name}</div>
                  <div className="hrs">
                    {item.hours} <small>{t('checkout.hour')}</small>
                  </div>
                  <div className="price">฿{item.price.toLocaleString()}</div>
                  <div className="per">{item.note}</div>
                  <span className={`btn ${item.id === pkgId ? 'pink' : 'ghost'}`}>
                    {item.id === pkgId ? t('checkout.selected') : t('checkout.selectPackage')}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {links.length > 0 && (
            <Card title={t('paymentLinks.title')} style={{ marginBottom: 16 }}>
              {links.map((link) => (
                <div key={link.id} className="toggle-row">
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{link.title}</div>
                    <div className="muted" style={{ fontSize: 11 }}>
                      {link.hours} {t('offers.hours')} · ฿{Number(link.totalAmount).toLocaleString()}
                      {link.installmentCount > 1 && ` · ${link.installmentsPaid}/${link.installmentCount} ${t('paymentLinks.installments')}`}
                    </div>
                  </div>
                  <Button size="sm" pink disabled={busy || !link.nextAmount} onClick={() => openLink(link.id)}>
                    {link.nextInstallment
                      ? `${t('paymentLinks.payInstallment')} ${link.nextInstallment}/${link.installmentCount}`
                      : t('paymentLinks.payNow')}
                  </Button>
                </div>
              ))}
            </Card>
          )}

          {offers.length > 0 && (
            <Card title={t('offers.title')} style={{ marginBottom: 16 }}>
              {offers.map((offer) => (
                <div key={offer.id} className="toggle-row">
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{offer.title}</div>
                    <div className="muted" style={{ fontSize: 11 }}>
                      {offer.hours} {t('offers.hours')} · ฿{Number(offer.price).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Badge tone={offerTone(offer.status)}>{offerLabel(offer.status)}</Badge>
                    {offer.status === 'pending_payment' && (
                      <Button size="sm" pink disabled={busy} onClick={() => startCheckout({ offerId: offer.id })}>
                        {t('offers.payNow')}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </Card>
          )}

          <div className="termbox">
            <b>
              <PinIcon width={14} height={14}/> {t('checkout.termsTitle')}
            </b>{' '}
            {t('checkout.terms')}
          </div>
        </div>

        <Card title={t('checkout.payTitle')}>
          <Field label={t('checkout.voucher')}>
            <div className="voucher-row">
              <Input
                placeholder={t('checkout.voucherPlaceholder')}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        applyVoucher();
                    }
                }}
              />
              <Button ghost onClick={applyVoucher} disabled={busy || !code.trim()}>
                {t('checkout.applyCode')}
              </Button>
            </div>
            {voucher && (
              <div className="badge green" style={{ marginTop: 8 }}>
                <CheckIcon width={13} height={13}/> {t('checkout.valid')} · {language === 'en' ? 'Discount' : 'ลด'} ฿{discount.toLocaleString()}
              </div>
            )}
          </Field>

          <div className="sumpanel" style={{ margin: '16px 0' }}>
            <div className="sumrow">
              <span className="muted">{pkg?.name}</span>
              <b>฿{(pkg?.price ?? 0).toLocaleString()}</b>
            </div>
            {discount > 0 && (
              <div className="sumrow">
                <span className="muted">{t('checkout.voucherLabel')} {voucher}</span>
                <span className="disc">−฿{discount.toLocaleString()}</span>
              </div>
            )}
            <div className="sumrow total">
              <span>{t('checkout.total')}</span>
              <span className="accent">฿{total.toLocaleString()}</span>
            </div>
          </div>

          <div className="pay-methods">
            <div className="pay-opt on">
              <b><PhoneIcon width={17} height={17}/> {t('checkout.transferTitle')}</b>
              <small>{t('checkout.transferHint')}</small>
            </div>
          </div>

          <Button pink style={{ width: '100%', marginTop: 16 }} onClick={() => startCheckout()} disabled={busy || !pkg}>
            {busy ? t('checkout.paying') : `${t('checkout.payNow')} · ฿${total.toLocaleString()}`}
          </Button>
          <div className="termbox" style={{ marginTop: 12 }}>
            <PinIcon width={13} height={13}/> {t('checkout.shortTerms')}
          </div>
        </Card>
      </div>
    );
}
