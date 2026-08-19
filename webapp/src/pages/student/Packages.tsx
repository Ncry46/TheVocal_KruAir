import { useEffect, useState } from 'react'
import { Button, Field, Input, Modal, Spinner } from '../../components/ui'
import { BankIcon, CardIcon, CheckIcon, CrownIcon, MusicNoteIcon, PinIcon } from '../../components/icons'
import { api } from '../../lib/api'
import type { PackageId, PackagePlan } from '../../lib/types'
import { useApp } from '../../context/AppContext'

const PKG_IMG: Record<string, string> = {
  beginner: '/img/pkg-desk.jpg',
  pro: '/img/pkg-stage.jpg',
  master: '/img/pkg-studio.jpg',
}

interface BuyState {
  pkg: PackageId
  voucher: string
  discount: number
  method: string
}

export default function Packages() {
  const { toast } = useApp()
  const [pkgs, setPkgs] = useState<PackagePlan[] | null>(null)
  const [open, setOpen] = useState(false)
  const [buy, setBuy] = useState<BuyState>({ pkg: 'pro', voucher: '', discount: 0, method: '' })
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.getPackages().then(setPkgs).catch(() => setPkgs([]))
  }, [])

  const pkg = pkgs?.find((p) => p.id === buy.pkg)
  const total = pkg ? pkg.price - buy.discount : 0

  const openBuy = (id: PackageId) => {
    setBuy({ pkg: id, voucher: '', discount: 0, method: '' })
    setCode('')
    setOpen(true)
  }

  const applyVoucher = async () => {
    if (!pkg || !code.trim()) return
    setBusy(true)
    try {
      const discount = await api.validateVoucher(code.trim(), pkg.price)
      setBuy((b) => ({ ...b, voucher: code.trim().toUpperCase(), discount }))
      toast(`ใช้ได้ค่า! ลด ฿${discount.toLocaleString()}`, 'ok')
    } catch (err) {
      setBuy((b) => ({ ...b, voucher: '', discount: 0 }))
      toast(err instanceof Error ? err.message : 'วอเชอร์ไม่ถูกต้อง')
    } finally {
      setBusy(false)
    }
  }

  const pay = async (method: string) => {
    setBusy(true)
    try {
      await api.purchase(buy.pkg, buy.voucher, method)
      setOpen(false)
      toast(`ชำระผ่าน ${method} แล้ว · เพิ่มชั่วโมงเข้าบัญชี + ใบเสร็จ PDF`, 'ok')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'ชำระเงินไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  if (!pkgs) return <Spinner />

  return (
    <>
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        {pkgs.map((p) => (
          <div key={p.id} className={`pkg ${p.tag === 'ยอดนิยม' ? 'popular' : ''}`}>
            {p.tag && (
              <div className="crown">
                <CrownIcon width={13} height={13} /> {p.tag}
              </div>
            )}
            <div className="top">
              <img src={PKG_IMG[p.id]} alt={p.name} loading="lazy" />
              <span className="top-em">
                <MusicNoteIcon width={24} height={24} />
              </span>
            </div>
            <div className="body">
              <div className="nm">{p.name}</div>
              <div className="hrs">
                {p.hours} <small>ชั่วโมง</small>
              </div>
              <div className="price">฿{p.price.toLocaleString()}</div>
              <div className="per">{p.note}</div>
              <Button pink onClick={() => openBuy(p.id)}>
                เลือกแพ็กเกจ
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="termbox">
        <b>
          <PinIcon width={14} height={14} /> เงื่อนไขทุกแพ็กเกจ:
        </b>{' '}
        นับชั่วโมงเมื่อเข้ารับจริง 1 ชม./ครั้ง · แพ็กเกจมีอายุ <b>6 เดือน</b> นับจากวันที่ซื้อ ·
        ไม่สามารถโอนหรือคืนเงินได้ · ใช้ได้เฉพาะคอร์สของครูแอร์เท่านั้น
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="ซื้อแพ็กเกจ">
        <Field label="เลือกแพ็กเกจ">
          {pkgs.map((p) => (
            <div
              key={p.id}
              className={`opt ${buy.pkg === p.id ? 'on' : ''}`}
              onClick={() => setBuy((b) => ({ ...b, pkg: p.id, discount: 0, voucher: '' }))}
            >
              <div className="ic">
                <MusicNoteIcon width={19} height={19} />
              </div>
              <div>
                <div className="nm">{p.name}</div>
                <div className="ds">{p.note}</div>
              </div>
              <div className="pr">฿{p.price.toLocaleString()}</div>
            </div>
          ))}
        </Field>

        <Field label="วอเชอร์ส่วนลด (ถ้ามี)">
          <div className="voucher-row">
            <Input placeholder="ใส่รหัส เช่น SAVE1000" value={code} onChange={(e) => setCode(e.target.value)} />
            <Button ghost onClick={applyVoucher} disabled={busy}>
              ใช้โค้ด
            </Button>
          </div>
          {buy.voucher && (
            <div className="badge green" style={{ marginTop: 8 }}>
              <CheckIcon width={13} height={13} /> ใช้ได้ · ลด ฿{buy.discount.toLocaleString()}
            </div>
          )}
        </Field>

        <div className="sumpanel">
          <div className="sumrow">
            <span className="muted">{pkg?.name}</span>
            <b>฿{(pkg?.price ?? 0).toLocaleString()}</b>
          </div>
          {buy.discount > 0 && (
            <div className="sumrow">
              <span className="muted">วอเชอร์ {buy.voucher}</span>
              <span className="disc">−฿{buy.discount.toLocaleString()}</span>
            </div>
          )}
          <div className="sumrow total">
            <span>ยอดรวม</span>
            <span className="accent">฿{total.toLocaleString()}</span>
          </div>
        </div>

        <Field label="ช่องทางชำระเงิน">
          <div className="pay-methods">
            <Button ghost onClick={() => pay('บัตรเครดิต / เดบิต (3-D Secure)')} disabled={busy}>
              <CardIcon width={17} height={17} /> บัตรเครดิต
            </Button>
            <Button ghost onClick={() => pay('KBank (K+) · สแกน QR ยืนยันในแอป')} disabled={busy}>
              <BankIcon width={17} height={17} /> KBank
            </Button>
          </div>
        </Field>

        <div className="termbox" style={{ marginTop: 8 }}>
          <PinIcon width={13} height={13} /> นับชั่วโมงเมื่อเรียนจริง · อายุ 6 เดือน · ไม่โอน/คืนเงิน
        </div>
      </Modal>
    </>
  )
}
