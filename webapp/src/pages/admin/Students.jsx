import { useEffect, useState } from 'react';
import { Badge, Card, Input, Spinner, Table } from '../../components/ui';
import { api } from '../../lib/api';
export default function Students() {
    const [rows, setRows] = useState(null);
    const [q, setQ] = useState('');
    useEffect(() => {
        api.getStudents().then(setRows);
    }, []);
    if (!rows)
        return <Spinner />;
    const filtered = rows.filter((r) => r.name.includes(q) || r.pkg.includes(q));
    return (<Card title="นักเรียนทั้งหมด" action={<Input placeholder="ค้นหาชื่อ…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 230 }}/>}>
      <Table heads={['นักเรียน', 'อายุ · การศึกษา', 'แพ็กเกจ', 'ชั่วโมงคงเหลือ', 'เรียนแล้ว', 'สถานะ']} rows={filtered.map((s) => [
            <b key="n">{s.name}</b>,
            s.info,
            s.pkg === '—' ? <span key="p" className="muted">—</span> : s.pkg,
            s.left > 0 ? <b key="l" className="accent">{s.left} ชม.</b> : <span key="l" className="muted">0</span>,
            `${s.done} คลาส`,
            s.state === 'active' ? (<Badge key="st" tone="green">ใช้งาน</Badge>) : s.state === 'new' ? (<Badge key="st" tone="blue">ใหม่</Badge>) : (<Badge key="st" tone="gray">แพ็กเกจหมดอายุ</Badge>),
        ])}/>
    </Card>);
}
