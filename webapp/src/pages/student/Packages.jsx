import { useEffect, useState } from 'react';
import { Button, Field, Input, Modal, Spinner } from '../../components/ui';
import { BankIcon, CardIcon, CheckIcon, CrownIcon, MusicNoteIcon, PinIcon } from '../../components/icons';
import { api } from '../../services/apiClient';
import { useApp } from '../../context/AppContext';
const PKG_IMG = {
    beginner: '/img/pkg-desk.jpg',
    pro: '/img/pkg-stage.jpg',
    master: '/img/pkg-studio.jpg',
};
export default function Packages() {
    const { language, toast } = useApp();
    const [pkgs, setPkgs] = useState(null);
    const [open, setOpen] = useState(false);
    const [buy, setBuy] = useState({ pkg: 'pro', voucher: '', discount: 0, method: '' });
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const copy = language === 'en'
        ? {
            hour: 'hours',
            selectPackage: 'Choose package',
            termsTitle: 'Terms for every package:',
            terms: 'Hours are counted only after attendance · packages expire 6 months after purchase · non-transferable and non-refundable · valid only for Kru Air courses',
            modalTitle: 'Buy package',
            choosePackage: 'Choose package',
            voucher: 'Discount voucher (optional)',
            voucherPlaceholder: 'Enter code e.g. SAVE1000',
            applyCode: 'Apply',
            valid: 'Applied',
            packageLabel: 'Package',
            voucherLabel: 'Voucher',
            total: 'Total',
            payment: 'Payment method',
            creditCard: 'Credit card',
            kbank: 'KBank',
            shortTerms: 'Hours counted after attendance · 6-month validity · no transfer/refund',
            voucherOk: 'Code applied!',
            voucherError: 'Invalid voucher',
            paid: 'Payment completed',
            paymentError: 'Payment failed',
        }
        : {
            hour: 'ชั่วโมง',
            selectPackage: 'เลือกแพ็กเกจ',
            termsTitle: 'เงื่อนไขทุกแพ็กเกจ:',
            terms: 'นับชั่วโมงเมื่อเข้ารับจริง 1 ชม./ครั้ง · แพ็กเกจมีอายุ 6 เดือน นับจากวันที่ซื้อ · ไม่สามารถโอนหรือคืนเงินได้ · ใช้ได้เฉพาะคอร์สของครูแอร์เท่านั้น',
            modalTitle: 'ซื้อแพ็กเกจ',
            choosePackage: 'เลือกแพ็กเกจ',
            voucher: 'วอเชอร์ส่วนลด (ถ้ามี)',
            voucherPlaceholder: 'ใส่รหัส เช่น SAVE1000',
            applyCode: 'ใช้โค้ด',
            valid: 'ใช้ได้',
            packageLabel: 'แพ็กเกจ',
            voucherLabel: 'วอเชอร์',
            total: 'ยอดรวม',
            payment: 'ช่องทางชำระเงิน',
            creditCard: 'บัตรเครดิต',
            kbank: 'KBank',
            shortTerms: 'นับชั่วโมงเมื่อเรียนจริง · อายุ 6 เดือน · ไม่โอน/คืนเงิน',
            voucherOk: 'ใช้ได้ค่า!',
            voucherError: 'วอเชอร์ไม่ถูกต้อง',
            paid: 'ชำระแล้ว',
            paymentError: 'ชำระเงินไม่สำเร็จ',
        };
    useEffect(() => {
        api.getPackages().then(setPkgs).catch(() => setPkgs([]));
    }, []);
    const pkg = pkgs?.find((p) => p.id === buy.pkg);
    const total = pkg ? pkg.price - buy.discount : 0;
    const openBuy = (id) => {
        setBuy({ pkg: id, voucher: '', discount: 0, method: '' });
        setCode('');
        setOpen(true);
    };
    const applyVoucher = async () => {
        if (!pkg || !code.trim())
            return;
        setBusy(true);
        try {
            const discount = await api.validateVoucher(code.trim(), pkg.price);
            setBuy((b) => ({ ...b, voucher: code.trim().toUpperCase(), discount }));
            toast(`${copy.voucherOk} ${language === 'en' ? 'Discount' : 'ลด'} ฿${discount.toLocaleString()}`, 'ok');
        }
        catch (err) {
            setBuy((b) => ({ ...b, voucher: '', discount: 0 }));
            toast(err instanceof Error ? err.message : copy.voucherError);
        }
        finally {
            setBusy(false);
        }
    };
    const pay = async (method) => {
        setBusy(true);
        try {
            await api.purchase(buy.pkg, buy.voucher, method);
            setOpen(false);
            toast(`${copy.paid}: ${method} · ${language === 'en' ? 'hours added + receipt PDF' : 'เพิ่มชั่วโมงเข้าบัญชี + ใบเสร็จ PDF'}`, 'ok');
        }
        catch (err) {
            toast(err instanceof Error ? err.message : copy.paymentError);
        }
        finally {
            setBusy(false);
        }
    };
    if (!pkgs)
        return <Spinner />;
    return (<>
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        {pkgs.map((p) => (<div key={p.id} className={`pkg ${p.tag === 'ยอดนิยม' ? 'popular' : ''}`}>
            {p.tag && (<div className="crown">
                <CrownIcon width={13} height={13}/> {p.tag}
              </div>)}
            <div className="top">
              <img src={PKG_IMG[p.id]} alt={p.name} loading="lazy"/>
              <span className="top-em">
                <MusicNoteIcon width={24} height={24}/>
              </span>
            </div>
            <div className="body">
              <div className="nm">{p.name}</div>
              <div className="hrs">
                {p.hours} <small>{copy.hour}</small>
              </div>
              <div className="price">฿{p.price.toLocaleString()}</div>
              <div className="per">{p.note}</div>
              <Button pink onClick={() => openBuy(p.id)}>
                {copy.selectPackage}
              </Button>
            </div>
          </div>))}
      </div>

      <div className="termbox">
        <b>
          <PinIcon width={14} height={14}/> {copy.termsTitle}
        </b>{' '}
        {copy.terms}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={copy.modalTitle}>
        <Field label={copy.choosePackage}>
          {pkgs.map((p) => (<div key={p.id} className={`opt ${buy.pkg === p.id ? 'on' : ''}`} onClick={() => setBuy((b) => ({ ...b, pkg: p.id, discount: 0, voucher: '' }))}>
              <div className="ic">
                <MusicNoteIcon width={19} height={19}/>
              </div>
              <div>
                <div className="nm">{p.name}</div>
                <div className="ds">{p.note}</div>
              </div>
              <div className="pr">฿{p.price.toLocaleString()}</div>
            </div>))}
        </Field>

        <Field label={copy.voucher}>
          <div className="voucher-row">
            <Input placeholder={copy.voucherPlaceholder} value={code} onChange={(e) => setCode(e.target.value)}/>
            <Button ghost onClick={applyVoucher} disabled={busy}>
              {copy.applyCode}
            </Button>
          </div>
          {buy.voucher && (<div className="badge green" style={{ marginTop: 8 }}>
              <CheckIcon width={13} height={13}/> {copy.valid} · {language === 'en' ? 'Discount' : 'ลด'} ฿{buy.discount.toLocaleString()}
            </div>)}
        </Field>

        <div className="sumpanel">
          <div className="sumrow">
            <span className="muted">{pkg?.name}</span>
            <b>฿{(pkg?.price ?? 0).toLocaleString()}</b>
          </div>
          {buy.discount > 0 && (<div className="sumrow">
              <span className="muted">{copy.voucherLabel} {buy.voucher}</span>
              <span className="disc">−฿{buy.discount.toLocaleString()}</span>
            </div>)}
          <div className="sumrow total">
            <span>{copy.total}</span>
            <span className="accent">฿{total.toLocaleString()}</span>
          </div>
        </div>

        <Field label={copy.payment}>
          <div className="pay-methods">
            <Button ghost onClick={() => pay('บัตรเครดิต / เดบิต (3-D Secure)')} disabled={busy}>
              <CardIcon width={17} height={17}/> {copy.creditCard}
            </Button>
            <Button ghost onClick={() => pay('KBank (K+) · สแกน QR ยืนยันในแอป')} disabled={busy}>
              <BankIcon width={17} height={17}/> {copy.kbank}
            </Button>
          </div>
        </Field>

        <div className="termbox" style={{ marginTop: 8 }}>
          <PinIcon width={13} height={13}/> {copy.shortTerms}
        </div>
      </Modal>
    </>);
}
