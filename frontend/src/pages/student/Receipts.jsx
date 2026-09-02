import { useEffect, useState } from 'react';
import { Badge, Button, Card, Modal, Spinner, Table } from '@components/ui';
import { BrandLogo } from '@components/BrandLogo';
import { api } from '@app/services/apiClient';
import { useApp } from '@app/context/AppContext';
export default function Receipts() {
    const { language, toast } = useApp();
    const [receipts, setReceipts] = useState(null);
    const [selected, setSelected] = useState(null);
    useEffect(() => {
        api.getReceipts().then(setReceipts);
    }, [language]);
    if (!receipts)
        return <Spinner />;
    return (<>
      <Card title="ประวัติการซื้อ / ใบเสร็จ" action={<Badge tone="green">ทั้งหมด {receipts.length} รายการ</Badge>}>
        <Table heads={['วันที่ซื้อ', 'แพ็กเกจ', 'วอเชอร์', 'ยอดชำระ', 'ช่องทาง', 'สถานะ', '']} rows={receipts.map((r) => [
            r.date,
            <b key="p">{r.pkg}</b>,
            r.voucher === '—' ? <span key="v" className="muted">—</span> : r.voucher,
            <b key="a">฿{r.amount.toLocaleString()}</b>,
            r.method,
            <Badge key="s" tone="green">{r.status}</Badge>,
            <Button key="b" ghost size="sm" onClick={() => setSelected(r)}>ดูใบเสร็จ</Button>,
        ])}/>
      </Card>

      <Modal open={selected !== null} onClose={() => setSelected(null)} title="ใบเสร็จอิเล็กทรอนิกส์">
        {selected && (<>
            <div style={{ textAlign: 'center' }}>
              <BrandLogo stacked size={64} style={{ margin: '0 auto 10px' }}/>
              <div className="muted" style={{ fontSize: 11.5 }}>ใบเสร็จรับเงิน · เลขที่ {selected.id}</div>
            </div>
            <div className="receipt-body">
              {[
                ['วันที่', selected.date],
                ['รายการ', selected.pkg],
                ['วอเชอร์', selected.voucher],
                ['ช่องทาง', selected.method],
            ].map(([k, v]) => (<div className="sumrow" key={k}>
                  <span className="muted">{k}</span>
                  <b>{v}</b>
                </div>))}
              <div className="sumrow total">
                <span>ยอดชำระ</span>
                <span className="accent">฿{selected.amount.toLocaleString()}</span>
              </div>
            </div>
            <Button pink style={{ width: '100%' }} onClick={() => toast('ดาวน์โหลด PDF แล้ว', 'ok')}>
              ดาวน์โหลด PDF
            </Button>
          </>)}
      </Modal>
    </>);
}
