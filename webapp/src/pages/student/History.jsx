import { useEffect, useState } from 'react';
import { Badge, Card, Spinner, Table } from '../../components/ui';
import { api } from '../../services/apiClient';
export default function History() {
    const [hist, setHist] = useState(null);
    useEffect(() => {
        api.getHistory().then(setHist);
    }, []);
    if (!hist)
        return <Spinner />;
    return (<Card title="ประวัติการเรียน" action={<Badge tone="green">เรียนแล้ว 12 คลาส · ใช้ไป 12 ชม.</Badge>}>
      <Table heads={['วันที่', 'เวลา', 'บทเรียน', 'บันทึกครูแอร์', 'ชั่วโมง']} rows={hist.map((h) => [
            <b key="d">{h.date}</b>,
            h.time,
            h.lesson,
            h.note,
            <Badge key="h" tone="blue">{h.usedHours} ชม.</Badge>,
        ])}/>
    </Card>);
}
