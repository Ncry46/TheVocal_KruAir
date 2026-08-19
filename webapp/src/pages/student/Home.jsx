import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge, Button, Card, Field, Kpi, Modal, Progress, Skeleton, Table } from '../../components/ui';
import { BellIcon, CalendarIcon, CartIcon, ChatIcon, ClockIcon, MusicNoteIcon } from '../../components/icons';
import { api } from '../../services/apiClient';
import { useApp } from '../../context/AppContext';
const plus1 = (t) => String(Number(t.split(':')[0]) + 1).padStart(2, '0') + ':00';
export default function Home() {
    const { user, toast } = useApp();
    const navigate = useNavigate();
    const [status, setStatus] = useState(null);
    const [hist, setHist] = useState(null);
    const [lessons, setLessons] = useState(null);
    const [confirming, setConfirming] = useState(false);
    const [moveOpen, setMoveOpen] = useState(false);
    const [moveDay, setMoveDay] = useState('');
    const [moveTime, setMoveTime] = useState('');
    const [moveBusy, setMoveBusy] = useState(false);
    const [days, setDays] = useState([]);
    const [slots, setSlots] = useState(null);
    useEffect(() => {
        api.getPackageStatus().then(setStatus);
        api.getHistory().then(setHist);
        api.getMyLessons().then(setLessons);
        api.getDays().then(setDays);
    }, []);
    useEffect(() => {
        if (!moveOpen)
            return;
        setSlots(null);
        setMoveTime('');
        if (moveDay)
            api.getSlots(moveDay).then(setSlots);
    }, [moveDay, moveOpen]);
    if (!status || !hist || !lessons)
        return <Skeleton />;
    const next = lessons.find((l) => l.status !== 'done');
    const confirmNext = async () => {
        if (!next || confirming)
            return;
        setConfirming(true);
        try {
            await api.confirmLesson(next.id);
            toast('ยืนยันการมาเรียนแล้ว — แล้วพบกันนะครับ', 'ok');
            setLessons(await api.getMyLessons());
        }
        finally {
            setConfirming(false);
        }
    };
    const openMove = () => {
        setMoveDay('');
        setMoveTime('');
        setMoveOpen(true);
    };
    const submitMove = async () => {
        if (!next || !moveDay || !moveTime || moveBusy)
            return;
        setMoveBusy(true);
        try {
            await api.requestMoveLesson(next.id, moveDay, moveTime);
            toast('ส่งคำขอเลื่อนนัดแล้ว — ครูแอร์จะยืนยันภายใน 24 ชม.', 'ok');
            setMoveOpen(false);
            setLessons(await api.getMyLessons());
        }
        finally {
            setMoveBusy(false);
        }
    };
    return (<>
      <div className="line-banner">
        <ChatIcon width={16} height={16}/>
        <div>
          <b>LINE เชื่อมต่อแล้ว (ฟีเจอร์เสริม)</b> — ระบบแจ้งเตือนนัด 1 วัน, ใบเสร็จ และเมนูลัดส่งให้ผ่าน LINE OA{' '}
          <span style={{ opacity: 0.75 }}>(ปิดได้ในตั้งค่า)</span>
        </div>
      </div>

      <div className="card hero-card">
        <div>
          <div className="greet">สวัสดีค่า น้อง{user?.nickname}</div>
          <div className="muted">
            ชั่วโมงคงเหลือ <b className="gold">{status.left} ชม.</b>
            {next && (<>
                {' '}
                · นัดถัดไป: <b>{next.date} {next.time}</b>{' '}
                <Badge tone={next.status === 'confirmed' ? 'green' : next.status === 'moved' ? 'blue' : 'pink'}>
                  {next.status === 'confirmed' ? 'ยืนยันแล้ว' : next.status === 'moved' ? 'รอเลื่อนนัด' : 'รอคอนเฟิร์ม'}
                </Badge>
              </>)}
          </div>
        </div>
        <div className="hero-actions">
          {next && next.status === 'pending' && (<Button green onClick={confirmNext} disabled={confirming}>
              {confirming ? 'กำลังยืนยัน…' : 'ยืนยันการมาเรียน'}
            </Button>)}
          {next && next.status !== 'moved' && (<Button ghost onClick={openMove}>ขอเลื่อนนัด</Button>)}
          <Button green onClick={() => navigate('/app/booking')}>
            <CalendarIcon width={16} height={16}/> จองเวลาเรียน
          </Button>
          <Button ghost onClick={() => navigate('/app/packages')}>
            <CartIcon width={16} height={16}/> ซื้อแพ็กเกจ
          </Button>
        </div>
      </div>

      <div className="grid cols-3" style={{ marginBottom: 18 }}>
        <Kpi tone="green" icon={<ClockIcon width={19} height={19}/>} value={String(status.left)} label="ชั่วโมงคงเหลือ" sub={`${status.name} · หมดอายุ ${status.expiresAt}`}/>
        <Kpi tone="pink" icon={<MusicNoteIcon width={19} height={19}/>} value="12" label="เรียนแล้ว" sub="ทั้งหมด 12 คลาส"/>
        <Kpi tone="blue" icon={<BellIcon width={19} height={19}/>} value={next ? '1' : '0'} label="นัดถัดไป" sub={next ? `${next.date} ${next.time}` : 'ยังไม่มีนัด'}/>
      </div>

      <Modal open={moveOpen} onClose={() => setMoveOpen(false)} title="ขอเลื่อนนัด">
        <p className="muted" style={{ marginBottom: 16, fontSize: 13.5 }}>
          เลือกวัน-เวลาใหม่สำหรับคลาส <b style={{ color: 'var(--ink)' }}>{next?.date} {next?.time}</b> — ครูแอร์จะยืนยันคำขอภายใน 24 ชม.
        </p>
        <Field label="เลือกวันใหม่">
          <div className="chip-row">
            {days.map((d) => (<button key={d} className={`dchip ${moveDay === d ? 'on' : ''}`} onClick={() => setMoveDay(d)}>
                {d}
              </button>))}
          </div>
        </Field>
        {moveDay && (<Field label="เลือกเวลาใหม่">
            {slots === null ? (<Skeleton />) : (<div className="slots-grid">
                {slots.map((s) => (<button key={s.time} disabled={s.status === 'เต็ม'} className={`slot-btn ${moveTime === s.time ? 'on' : ''}`} onClick={() => setMoveTime(s.time)}>
                    {s.time}–{plus1(s.time)} น.{s.status === 'เต็ม' ? ' (เต็ม)' : ''}
                  </button>))}
              </div>)}
          </Field>)}
        <Button pink style={{ width: '100%', marginTop: 8 }} disabled={!moveDay || !moveTime || moveBusy} onClick={submitMove}>
          {moveBusy ? 'กำลังส่งคำขอ…' : 'ส่งคำขอเลื่อนนัด'}
        </Button>
      </Modal>

      <div className="grid cols-2">
        <Card title="ประวัติล่าสุด" action={<Link to="/app/history" className="link">ดูทั้งหมด →</Link>}>
          <Table heads={['วันที่', 'คลาส', 'บันทึกครู']} rows={hist.slice(0, 3).map((h) => [
            <b key="d">{h.date} {h.time}</b>,
            <b key="l">{h.lesson}</b>,
            h.note === '—' ? <span key="n" className="muted">—</span> : h.note,
        ])}/>
        </Card>

        <Card title="แพ็กเกจของฉัน" action={<Link to="/app/packages" className="link">ซื้อเพิ่ม →</Link>}>
          <div className="pkg-name">{status.name} · {status.hours} ชั่วโมง</div>
          <Progress value={status.used} max={status.hours}/>
          <div className="prog-labels">
            <span>ใช้แล้ว {status.used} ชม.</span>
            <span>คงเหลือ <b className="accent">{status.left} ชม.</b></span>
          </div>
          <div className="pagetip">หักชั่วโมงเมื่อเรียนจริง 1 ชม./ครั้ง · แพ็กเกจหมดอายุ 6 เดือน</div>
          <Badge tone="blue">LINE Push: เปิด</Badge>
        </Card>
      </div>
    </>);
}
