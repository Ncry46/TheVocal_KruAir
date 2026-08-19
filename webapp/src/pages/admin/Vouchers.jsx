import { useEffect, useState } from 'react';
import { Badge, Button, Card, Field, Input, Modal, Spinner, Table } from '../../components/ui';
import { api } from '../../lib/api';
import { useApp } from '../../context/AppContext';
export default function Vouchers() {
    const { toast } = useApp();
    const [rows, setRows] = useState(null);
    const [open, setOpen] = useState(false);
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        api.getVouchers().then(setRows);
    }, []);
    const create = async () => {
        if (!code.trim())
            return;
        setBusy(true);
        try {
            await api.createVoucher(code.trim());
            setRows((prev) => [
                { code: code.trim().toUpperCase(), type: 'บาท', expires: '—', used: '0 / —', state: 'draft' },
                ...(prev ?? []),
            ]);
            setOpen(false);
            toast('สร้างวอเชอร์แล้ว ส่งต่อให้นักเรียนได้เลย', 'ok');
        }
        finally {
            setBusy(false);
        }
    };
    if (!rows)
        return <Spinner />;
    return (<>
      <Card title="วอเชอร์ทั้งหมด" action={<Button pink size="sm" onClick={() => setOpen(true)}>
            ＋ สร้างวอเชอร์
          </Button>}>
        <Table heads={['โค้ด', 'ประเภท', 'ใช้ได้ถึง', 'ใช้แล้ว / ทั้งหมด', 'สถานะ', '']} rows={rows.map((v) => [
            <b key="c" className="mono">{v.code}</b>,
            v.type,
            v.expires,
            <b key="u">{v.used}</b>,
            v.state === 'active' ? <Badge key="st" tone="green">ใช้งาน</Badge> : <Badge key="st" tone="gray">ฉบับร่าง</Badge>,
            v.state === 'active' ? (<Button key="a" danger size="sm" onClick={() => toast(`ปิดวอเชอร์ ${v.code} แล้ว`, 'ok')}>ปิด</Button>) : (<Button key="a" ghost size="sm" onClick={() => toast('เปิดใช้งาน (จำลอง)', 'ok')}>เปิด</Button>),
        ])}/>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="สร้างวอเชอร์">
        <Field label="โค้ดวอเชอร์">
          <Input placeholder="เช่น SUMMER500" value={code} onChange={(e) => setCode(e.target.value)}/>
        </Field>
        <Field label="ประเภทส่วนลด">
          <select className="input">
            <option>ลดเป็นบาท</option>
            <option>ลดเป็น % (กำหนดเพดานได้)</option>
          </select>
        </Field>
        <Field label="มูลค่า / เปอร์เซ็นต์">
          <Input placeholder="เช่น 500 หรือ 10"/>
        </Field>
        <Field label="วันหมดอายุ">
          <Input placeholder="เช่น 31 ธ.ค. 2026"/>
        </Field>
        <Button pink style={{ width: '100%' }} onClick={create} disabled={busy}>
          {busy ? 'กำลังสร้าง…' : 'สร้างวอเชอร์'}
        </Button>
      </Modal>
    </>);
}
