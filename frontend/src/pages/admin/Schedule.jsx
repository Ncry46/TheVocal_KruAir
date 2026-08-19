import { useEffect, useState } from 'react';
import { Button, Card, Field, Modal, Spinner } from '@components/ui';
import { BellIcon, CheckIcon } from '@components/icons';
import { api } from '@app/services/apiClient';
import { useApp } from '@app/context/AppContext';

const plus1 = (t) => String(Number(t.split(':')[0]) + 1).padStart(2, '0') + ':00';

export default function Schedule() {
    const { toast } = useApp();
    const [week, setWeek] = useState(null);
    const [selected, setSelected] = useState(null);
    const [logOpen, setLogOpen] = useState(false);
    const [logNote, setLogNote] = useState('');
    const [logBusy, setLogBusy] = useState(false);

    const load = () => api.getTeacherSchedule().then(setWeek);

    useEffect(() => {
        load();
    }, []);

    if (!week) {
        return <Spinner />;
    }

    const handleCellClick = (dayKey, time) => {
        const data = week.cells[`${dayKey}|${time}`];
        if (!data) {
            setSelected(null);
            return;
        }
        setSelected({ day: dayKey, time, data });
    };

    const submitLog = async (outcome = 'done') => {
        if (!selected?.data?.bookingId || logBusy) {
            return;
        }
        setLogBusy(true);
        try {
            await api.recordLesson(selected.data.bookingId, outcome, logNote);
            toast(outcome === 'no_show'
                ? `บันทึก no-show ${selected.day} ${selected.time}`
                : `บันทึกผลการสอน ${selected.day} ${selected.time} แล้ว · หัก 1 ชม.`, 'ok');
            setLogOpen(false);
            setSelected(null);
            await load();
        }
        catch (err) {
            toast(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
        }
        finally {
            setLogBusy(false);
        }
    };

    return (<>
      <div className="alertbar">
        <BellIcon width={16} height={16}/> <b>{week.pendingCount} นัดยังไม่คอนเฟิร์ม</b>
      </div>

      <Card title={week.title}>
        <div className="cal-wrap">
          <div className="cal-corner"><span className="cal-corner-label">เวลา</span></div>

          {week.days.map((day) => {
            const count = week.times.filter((time) => week.cells[`${day.key}|${time}`]).length;
            const todayIso = new Date().toISOString().slice(0, 10);
            return (<div key={day.iso} className={`cal-day-head ${day.iso === todayIso ? 'today' : ''}`}>
                <span className="cdh-day">{day.key}</span>
                <span className="cdh-date">{day.date}</span>
                {count > 0 && <span className="cdh-count">{count}</span>}
              </div>);
        })}

          {week.times.map((time) => (<div key={time} className="cal-row">
              <div className="cal-time"><span className="ct-hour">{time}</span></div>
              {week.days.map((day) => {
                const slotData = week.cells[`${day.key}|${time}`];
                const isActive = selected?.day === day.key && selected?.time === time;
                return (<div key={day.iso} className={`cal-cell ${slotData ? 'has-data' : ''} ${isActive ? 'selected' : ''}`} onClick={() => handleCellClick(day.key, time)}>
                    {slotData ? (<div className={`cal-chip ${slotData.status}`}>
                        {slotData.student.replace('น้อง', '')}
                      </div>) : null}
                  </div>);
            })}
            </div>))}
        </div>

        <div className="cal-legend">
          <span className="cl-item"><span className="cl-chip confirmed"/> มีสอน</span>
          <span className="cl-item"><span className="cl-chip pending"/> รออนุมัติ</span>
          <span className="cl-item"><span className="cl-dot" style={{ background: 'var(--line)' }}/> ว่าง</span>
        </div>
      </Card>

      {selected && (<Card className="mt-16 detail-panel">
          <div className="dp-header">
            <div className="dp-info">
              <div className="dp-title">{selected.data.student}</div>
              <div className="dp-sub">{selected.day} {selected.time}–{plus1(selected.time)} · {selected.data.lesson}</div>
            </div>
            <span className={`dp-badge ${selected.data.status}`}>
              {selected.data.status === 'confirmed' ? 'ยืนยันแล้ว' : 'รอคอนเฟิร์ม'}
            </span>
          </div>

          <div className="dp-actions">
            {selected.data.status === 'confirmed' ? (<>
                <Button green onClick={() => { setLogNote(''); setLogOpen(true); }}>
                  <CheckIcon width={14} height={14}/> บันทึกผลการสอน
                </Button>
                <Button danger onClick={() => submitLog('no_show')} disabled={logBusy}>
                  No-show
                </Button>
              </>) : (<Button ghost onClick={() => { toast('ทวงถามอีกครั้ง', 'ok'); }}>
                ทวงถาม
              </Button>)}
            <Button ghost onClick={() => setSelected(null)}>ปิด</Button>
          </div>
        </Card>)}

      <Modal open={logOpen} onClose={() => setLogOpen(false)} title="บันทึกผลการสอน">
        <div style={{ marginBottom: 16 }}>
          <div className="sumrow">
            <span className="muted">วัน-เวลา</span>
            <b>{selected?.day} {selected?.time}–{selected ? plus1(selected.time) : ''}</b>
          </div>
          <div className="sumrow">
            <span className="muted">นักเรียน</span>
            <b>{selected?.data.student}</b>
          </div>
          <div className="sumrow">
            <span className="muted">บทเรียน</span>
            <b>{selected?.data.lesson}</b>
          </div>
          <div className="sumrow">
            <span className="muted">หักชั่วโมง</span>
            <span className="disc">−1 ชม.</span>
          </div>
        </div>
        <Field label="บันทึกผลการสอน">
          <textarea className="classlog-input" placeholder="เช่น เทคนิคการหายใจ, ฝึก C3–C5..." value={logNote} onChange={(e) => setLogNote(e.target.value)}/>
        </Field>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button green style={{ flex: 1 }} onClick={() => submitLog('done')} disabled={logBusy}>
            {logBusy ? 'กำลังบันทึก…' : 'บันทึกผลการสอน'}
          </Button>
          <Button ghost onClick={() => setLogOpen(false)}>ยกเลิก</Button>
        </div>
      </Modal>
    </>);
}
