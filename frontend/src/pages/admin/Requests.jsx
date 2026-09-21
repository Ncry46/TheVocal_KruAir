import { useEffect, useState } from 'react';
import { Badge, Button, Card, Spinner, Table } from '@components/ui';
import { RefreshIcon } from '@components/icons';
import { api } from '@app/services/apiClient';
import { useApp } from '@app/context/AppContext';

function isPendingRequest(row) {
    return row.statusKey === 'pending' || row.status === 'รออนุมัติ' || row.status === 'Pending';
}

/** Move-request inbox used on the schedule page (and legacy /teacher/requests redirect). */
export function MoveRequestsPanel({ embedded = false } = {}) {
    const { language, toast } = useApp();
    const [requests, setRequests] = useState(null);

    useEffect(() => {
        api.getMoveRequests().then(setRequests).catch(() => setRequests([]));
    }, [language]);

    const decide = async (row, approve) => {
        await api.decideMove(row.id, approve);
        setRequests((prev) => prev?.map((item) => (
            item.id === row.id
                ? {
                    ...item,
                    status: approve
                        ? (language === 'en' ? 'Approved' : 'อนุมัติแล้ว')
                        : (language === 'en' ? 'Rejected' : 'ปฏิเสธ'),
                    statusKey: approve ? 'approved' : 'rejected',
                }
                : item
        )) ?? null);
        toast(
            approve
                ? (language === 'en'
                    ? `Approved ${row.student}'s reschedule · student notified (web + LINE)`
                    : `อนุมัติเลื่อนนัดของ ${row.student} แล้ว · ส่งแจ้งเตือนให้นักเรียน (เว็บ + LINE)`)
                : (language === 'en'
                    ? `Rejected ${row.student}'s request · student notified`
                    : `ปฏิเสธคำขอของ ${row.student} · แจ้งนักเรียนแล้ว`),
            'ok',
        );
    };

    if (!requests) {
        return embedded ? <div className="empty">{language === 'en' ? 'Loading…' : 'กำลังโหลด…'}</div> : <Spinner />;
    }

    const pending = requests.filter(isPendingRequest).length;

    return (
      <div id="move-requests" className={embedded ? 'sched-move-requests' : undefined}>
        <div className="alertbar">
          <RefreshIcon width={16} height={16}/>
          {' '}
          <b>{pending} {language === 'en' ? 'move requests' : 'คำขอเลื่อนนัด'}</b>
          {' '}
          {language === 'en'
              ? 'pending review — students are notified automatically when you approve or reject'
              : 'รอการตรวจสอบ — ระบบแจ้งเตือนนักเรียนอัตโนมัติเมื่ออนุมัติ/ปฏิเสธ'}
        </div>

        <Card title={language === 'en' ? 'Move requests' : 'คำขอเลื่อนนัด'}>
          {requests.length === 0 ? (
            <div className="empty">{language === 'en' ? 'No move requests' : 'ยังไม่มีคำขอเลื่อนนัด'}</div>
          ) : (
            <Table
              heads={language === 'en'
                  ? ['Student', 'Original', 'Requested', 'Asked', 'Status', 'Action']
                  : ['นักเรียน', 'นัดเดิม', 'ขอนัดใหม่', 'ขอเมื่อ', 'สถานะ', 'การดำเนินการ']}
              rows={requests.map((row) => [
                <b key="n">{row.student}</b>,
                row.from,
                <b key="to" className="accent">{row.to}</b>,
                row.at,
                isPendingRequest(row)
                    ? (<Badge key="st" tone="pink">{row.status}</Badge>)
                    : row.statusKey === 'approved' || row.status === 'อนุมัติแล้ว' || row.status === 'Approved'
                        ? (<Badge key="st" tone="green">{row.status}</Badge>)
                        : (<Badge key="st" tone="red">{row.status}</Badge>),
                isPendingRequest(row)
                    ? (
                      <div key="a" style={{ display: 'flex', gap: 6 }}>
                        <Button green size="sm" onClick={() => decide(row, true)}>
                          {language === 'en' ? 'Approve' : 'อนุมัติ'}
                        </Button>
                        <Button danger size="sm" onClick={() => decide(row, false)}>
                          {language === 'en' ? 'Reject' : 'ปฏิเสธ'}
                        </Button>
                      </div>
                    )
                    : (<Badge key="a" tone="blue">{language === 'en' ? 'Student notified' : 'แจ้งนักเรียนแล้ว'}</Badge>),
              ])}
            />
          )}
        </Card>
      </div>
    );
}

export default function Requests() {
    return <MoveRequestsPanel />;
}
