import { useEffect, useState } from 'react';
import { Badge, Button, Card, Spinner, Table } from '@components/ui';
import { RefreshIcon } from '@components/icons';
import { api } from '@app/services/apiClient';
import { useApp } from '@app/context/AppContext';
export default function Requests() {
    const { language, toast } = useApp();
    const [requests, setRequests] = useState(null);
    useEffect(() => {
        api.getMoveRequests().then(setRequests);
    }, [language]);
    const decide = async (r, approve) => {
        await api.decideMove(r.id, approve);
        setRequests((prev) => prev?.map((x) => (x.id === r.id ? { ...x, status: approve ? (language === 'en' ? 'Approved' : 'อนุมัติแล้ว') : (language === 'en' ? 'Rejected' : 'ปฏิเสธ'), statusKey: approve ? 'approved' : 'rejected' } : x)) ?? null);
        toast(approve ? `อนุมัติเลื่อนนัดของ ${r.student} แล้ว · ส่งแจ้งเตือนให้นักเรียน (เว็บ + LINE)` : `ปฏิเสธคำขอของ ${r.student} · แจ้งนักเรียนแล้ว`, 'ok');
    };
    if (!requests)
        return <Spinner />;
    const isPending = (r) => r.statusKey === 'pending' || r.status === 'รออนุมัติ' || r.status === 'Pending';
    const pending = requests.filter(isPending).length;
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
            isPending(r) ? (<Badge key="st" tone="pink">{r.status}</Badge>) : r.statusKey === 'approved' || r.status === 'อนุมัติแล้ว' || r.status === 'Approved' ? (<Badge key="st" tone="green">{r.status}</Badge>) : (<Badge key="st" tone="red">{r.status}</Badge>),
            isPending(r) ? (<div key="a" style={{ display: 'flex', gap: 6 }}>
                <Button green size="sm" onClick={() => decide(r, true)}>อนุมัติ</Button>
                <Button danger size="sm" onClick={() => decide(r, false)}>ปฏิเสธ</Button>
              </div>) : (<Badge key="a" tone="blue">แจ้งนักเรียนแล้ว</Badge>),
        ])}/>
      </Card>
    </>);
}
