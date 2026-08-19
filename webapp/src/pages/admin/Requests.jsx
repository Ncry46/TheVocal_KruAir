import { useEffect, useState } from 'react';
import { Badge, Button, Card, Spinner, Table } from '../../components/ui';
import { RefreshIcon } from '../../components/icons';
import { api } from '../../lib/api';
import { useApp } from '../../context/AppContext';
export default function Requests() {
    const { toast } = useApp();
    const [requests, setRequests] = useState(null);
    useEffect(() => {
        api.getMoveRequests().then(setRequests);
    }, []);
    const decide = async (r, approve) => {
        await api.decideMove(r.id, approve);
        setRequests((prev) => prev?.map((x) => (x.id === r.id ? { ...x, status: approve ? 'อนุมัติแล้ว' : 'ปฏิเสธ' } : x)) ?? null);
        toast(approve ? `อนุมัติเลื่อนนัดของ ${r.student} แล้ว · ส่งแจ้งเตือนให้นักเรียน (เว็บ + LINE)` : `ปฏิเสธคำขอของ ${r.student} · แจ้งนักเรียนแล้ว`, 'ok');
    };
    if (!requests)
        return <Spinner />;
    const pending = requests.filter((r) => r.status === 'รออนุมัติ').length;
    return (<>
      <div className="alertbar">
        <RefreshIcon width={16} height={16}/> <b>{pending} คำขอเลื่อนนัด</b> รอการตรวจสอบ — ระบบแจ้งเตือนนักเรียนอัตโนมัติเมื่ออนุมัติ/ปฏิเสธ
      </div>

      <Card title="คำขอเลื่อนนัด">
        <Table heads={['นักเรียน', 'นัดเดิม', 'ขอนัดใหม่', 'ขอเมื่อ', 'สถานะ', 'การดำเนินการ']} rows={requests.map((r) => [
            <b key="n">{r.student}</b>,
            r.from,
            <b key="to" className="accent">{r.to}</b>,
            r.at,
            r.status === 'รออนุมัติ' ? (<Badge key="st" tone="pink">รออนุมัติ</Badge>) : r.status === 'อนุมัติแล้ว' ? (<Badge key="st" tone="green">อนุมัติแล้ว</Badge>) : (<Badge key="st" tone="red">ปฏิเสธ</Badge>),
            r.status === 'รออนุมัติ' ? (<div key="a" style={{ display: 'flex', gap: 6 }}>
                <Button green size="sm" onClick={() => decide(r, true)}>อนุมัติ</Button>
                <Button danger size="sm" onClick={() => decide(r, false)}>ปฏิเสธ</Button>
              </div>) : (<Badge key="a" tone="blue">แจ้งนักเรียนแล้ว</Badge>),
        ])}/>
      </Card>
    </>);
}
