import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Card, Field, Input, Spinner } from '@components/ui';
import { BankIcon, CardIcon, CheckIcon, CrownIcon, MusicNoteIcon, PhoneIcon, PinIcon } from '@components/icons';
import { api } from '@app/services/apiClient';
import { useApp } from '@app/context/AppContext';

const PKG_IMG = {
    beginner: '/img/pkg-desk.jpg',
    pro: '/img/pkg-stage.jpg',
    master: '/img/pkg-studio.jpg',
};

const PAY_METHODS = [
    {
        id: 'card',
        icon: CardIcon,
        method: 'บัตรเครดิต',
        label: 'checkout.creditCard',
        hint: 'checkout.creditHint',
    },
    {
        id: 'kbank',
        icon: BankIcon,
        method: 'KBank',
        label: 'checkout.kbank',
        hint: 'checkout.kbankHint',
    },
    {
        id: 'promptpay',
        icon: PhoneIcon,
        method: 'พร้อมเพย์',
        label: 'checkout.promptpay',
        hint: 'checkout.promptpayHint',
    },
];

export default function Packages() {
    const { language, t, toast } = useApp();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const [pkgs, setPkgs] = useState(null);
    const [pkgId, setPkgId] = useState(params.get('pkg') || 'pro');
    const [code, setCode] = useState('');
    const [voucher, setVoucher] = useState('');
    const [discount, setDiscount] = useState(0);
    const [methodId, setMethodId] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        api.getPackages().then(setPkgs).catch(() => setPkgs([]));
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
    const selectedMethod = PAY_METHODS.find((item) => item.id === methodId);

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

    const pay = async () => {
        if (!pkg || busy) {
            return;
        }
        if (!selectedMethod) {
            toast(t('checkout.pickMethod'));
            return;
        }
        setBusy(true);
        try {
            await api.purchase(pkg.id, voucher, selectedMethod.method);
            toast(`${t('checkout.paid')} · ${selectedMethod.method}`, 'ok');
            navigate('/app/receipts');
        }
        catch (err) {
            toast(err instanceof Error ? err.message : t('checkout.paymentError'));
        }
        finally {
            setBusy(false);
        }
    };

    if (!pkgs) {
        return <Spinner />;
    }

    return (
      <div className="checkout-layout">
        <div>
          <div className="grid cols-3" style={{ marginBottom: 16 }}>
            {pkgs.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`pkg ${item.id === 'pro' ? 'popular' : ''} ${item.id === pkgId ? 'on' : ''}`}
                onClick={() => selectPackage(item.id)}
              >
                {item.tag && (
                  <div className="crown">
                    <CrownIcon width={13} height={13}/> {item.tag}
                  </div>
                )}
                <div className="top">
                  <img src={PKG_IMG[item.id]} alt={item.name} loading="lazy"/>
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

          <Field label={t('checkout.payment')}>
            <div className="pay-methods">
              {PAY_METHODS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`pay-opt ${methodId === item.id ? 'on' : ''}`}
                      onClick={() => setMethodId(item.id)}
                    >
                      <b>
                        <Icon width={17} height={17}/> {t(item.label)}
                      </b>
                      <small>{t(item.hint)}</small>
                    </button>
                  );
              })}
            </div>
          </Field>

          <Button pink style={{ width: '100%', marginTop: 16 }} onClick={pay} disabled={busy}>
            {busy ? t('checkout.paying') : `${t('checkout.payNow')} · ฿${total.toLocaleString()}`}
          </Button>
          <div className="termbox" style={{ marginTop: 12 }}>
            <PinIcon width={13} height={13}/> {t('checkout.shortTerms')}
          </div>
        </Card>
      </div>
    );
}
