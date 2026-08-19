import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge, Button, Card, Field, Kpi, Modal, Progress, Skeleton, Table } from '../../components/ui';
import { BellIcon, CalendarIcon, CartIcon, ChatIcon, ClockIcon, MusicNoteIcon } from '../../components/icons';
import { api } from '../../services/apiClient';
import { useApp } from '../../context/AppContext';
const plus1 = (t) => String(Number(t.split(':')[0]) + 1).padStart(2, '0') + ':00';
export default function Home() {
    const { language, user, toast } = useApp();
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
    const copy = language === 'en'
        ? {
            lineTitle: 'LINE connected (optional)',
            lineBody: 'Lesson reminders, receipts, and shortcuts are sent through LINE OA',
            lineHint: '(can be disabled in settings)',
            greeting: `Hello, ${user?.nickname ?? ''}`,
            hoursLeft: 'Hours left',
            nextLesson: 'Next lesson',
            confirmed: 'Confirmed',
            moving: 'Move requested',
            pending: 'Awaiting confirmation',
            confirming: 'Confirming...',
            confirm: 'Confirm attendance',
            move: 'Request move',
            booking: 'Book a lesson',
            buy: 'Buy package',
            studied: 'Completed',
            classes: '12 classes total',
            upcoming: 'Upcoming',
            none: 'No booking yet',
            latestHistory: 'Latest history',
            seeAll: 'View all ->',
            date: 'Date',
            lesson: 'Lesson',
            note: 'Teacher note',
            myPackage: 'My package',
            buyMore: 'Buy more ->',
            used: 'Used',
            remaining: 'Remaining',
            packageTip: 'Hours are deducted after attendance · packages expire in 6 months',
            linePush: 'LINE Push: On',
            moveTitle: 'Request lesson move',
            moveHelp: 'Choose a new date and time. Kru Air will confirm within 24 hours.',
            chooseDay: 'Choose new day',
            chooseTime: 'Choose new time',
            full: 'Full',
            sending: 'Sending...',
            sendMove: 'Send move request',
            moveToast: 'Move request sent — Kru Air will confirm within 24 hours.',
            confirmToast: 'Attendance confirmed — see you soon.',
        }
        : {
            lineTitle: 'LINE เชื่อมต่อแล้ว (ฟีเจอร์เสริม)',
            lineBody: 'ระบบแจ้งเตือนนัด 1 วัน, ใบเสร็จ และเมนูลัดส่งให้ผ่าน LINE OA',
            lineHint: '(ปิดได้ในตั้งค่า)',
            greeting: `สวัสดีค่า น้อง${user?.nickname ?? ''}`,
            hoursLeft: 'ชั่วโมงคงเหลือ',
            nextLesson: 'นัดถัดไป',
            confirmed: 'ยืนยันแล้ว',
            moving: 'รอเลื่อนนัด',
            pending: 'รอคอนเฟิร์ม',
            confirming: 'กำลังยืนยัน…',
            confirm: 'ยืนยันการมาเรียน',
            move: 'ขอเลื่อนนัด',
            booking: 'จองเวลาเรียน',
            buy: 'ซื้อแพ็กเกจ',
            studied: 'เรียนแล้ว',
            classes: 'ทั้งหมด 12 คลาส',
            upcoming: 'นัดถัดไป',
            none: 'ยังไม่มีนัด',
            latestHistory: 'ประวัติล่าสุด',
            seeAll: 'ดูทั้งหมด →',
            date: 'วันที่',
            lesson: 'คลาส',
            note: 'บันทึกครู',
            myPackage: 'แพ็กเกจของฉัน',
            buyMore: 'ซื้อเพิ่ม →',
            used: 'ใช้แล้ว',
            remaining: 'คงเหลือ',
            packageTip: 'หักชั่วโมงเมื่อเรียนจริง 1 ชม./ครั้ง · แพ็กเกจหมดอายุ 6 เดือน',
            linePush: 'LINE Push: เปิด',
            moveTitle: 'ขอเลื่อนนัด',
            moveHelp: 'เลือกวัน-เวลาใหม่ — ครูแอร์จะยืนยันคำขอภายใน 24 ชม.',
            chooseDay: 'เลือกวันใหม่',
            chooseTime: 'เลือกเวลาใหม่',
            full: 'เต็ม',
            sending: 'กำลังส่งคำขอ…',
            sendMove: 'ส่งคำขอเลื่อนนัด',
            moveToast: 'ส่งคำขอเลื่อนนัดแล้ว — ครูแอร์จะยืนยันภายใน 24 ชม.',
            confirmToast: 'ยืนยันการมาเรียนแล้ว — แล้วพบกันนะครับ',
        };
    const next = lessons.find((l) => l.status !== 'done');
    const confirmNext = async () => {
        if (!next || confirming)
            return;
        setConfirming(true);
        try {
            await api.confirmLesson(next.id);
            toast(copy.confirmToast, 'ok');
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
            toast(copy.moveToast, 'ok');
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
          <b>{copy.lineTitle}</b> — {copy.lineBody}{' '}
          <span style={{ opacity: 0.75 }}>{copy.lineHint}</span>
        </div>
      </div>

      <div className="card hero-card">
        <div>
          <div className="greet">{copy.greeting}</div>
          <div className="muted">
            {copy.hoursLeft} <b className="gold">{status.left} {language === 'en' ? 'hrs' : 'ชม.'}</b>
            {next && (<>
                {' '}
                · {copy.nextLesson}: <b>{next.date} {next.time}</b>{' '}
                <Badge tone={next.status === 'confirmed' ? 'green' : next.status === 'moved' ? 'blue' : 'pink'}>
                  {next.status === 'confirmed' ? copy.confirmed : next.status === 'moved' ? copy.moving : copy.pending}
                </Badge>
              </>)}
          </div>
        </div>
        <div className="hero-actions">
          {next && next.status === 'pending' && (<Button green onClick={confirmNext} disabled={confirming}>
              {confirming ? copy.confirming : copy.confirm}
            </Button>)}
          {next && next.status !== 'moved' && (<Button ghost onClick={openMove}>{copy.move}</Button>)}
          <Button green onClick={() => navigate('/app/booking')}>
            <CalendarIcon width={16} height={16}/> {copy.booking}
          </Button>
          <Button ghost onClick={() => navigate('/app/packages')}>
            <CartIcon width={16} height={16}/> {copy.buy}
          </Button>
        </div>
      </div>

      <div className="grid cols-3" style={{ marginBottom: 18 }}>
        <Kpi tone="green" icon={<ClockIcon width={19} height={19}/>} value={String(status.left)} label={copy.hoursLeft} sub={`${status.name} · ${language === 'en' ? 'expires' : 'หมดอายุ'} ${status.expiresAt}`}/>
        <Kpi tone="pink" icon={<MusicNoteIcon width={19} height={19}/>} value="12" label={copy.studied} sub={copy.classes}/>
        <Kpi tone="blue" icon={<BellIcon width={19} height={19}/>} value={next ? '1' : '0'} label={copy.upcoming} sub={next ? `${next.date} ${next.time}` : copy.none}/>
      </div>

      <Modal open={moveOpen} onClose={() => setMoveOpen(false)} title={copy.moveTitle}>
        <p className="muted" style={{ marginBottom: 16, fontSize: 13.5 }}>
          {copy.moveHelp} <b style={{ color: 'var(--ink)' }}>{next?.date} {next?.time}</b>
        </p>
        <Field label={copy.chooseDay}>
          <div className="chip-row">
            {days.map((d) => (<button key={d} className={`dchip ${moveDay === d ? 'on' : ''}`} onClick={() => setMoveDay(d)}>
                {d}
              </button>))}
          </div>
        </Field>
        {moveDay && (<Field label={copy.chooseTime}>
            {slots === null ? (<Skeleton />) : (<div className="slots-grid">
                {slots.map((s) => (<button key={s.time} disabled={s.status === 'เต็ม'} className={`slot-btn ${moveTime === s.time ? 'on' : ''}`} onClick={() => setMoveTime(s.time)}>
                    {s.time}–{plus1(s.time)} {language === 'en' ? '' : 'น.'}{s.status === 'เต็ม' ? ` (${copy.full})` : ''}
                  </button>))}
              </div>)}
          </Field>)}
        <Button pink style={{ width: '100%', marginTop: 8 }} disabled={!moveDay || !moveTime || moveBusy} onClick={submitMove}>
          {moveBusy ? copy.sending : copy.sendMove}
        </Button>
      </Modal>

      <div className="grid cols-2">
        <Card title={copy.latestHistory} action={<Link to="/app/history" className="link">{copy.seeAll}</Link>}>
          <Table heads={[copy.date, copy.lesson, copy.note]} rows={hist.slice(0, 3).map((h) => [
            <b key="d">{h.date} {h.time}</b>,
            <b key="l">{h.lesson}</b>,
            h.note === '—' ? <span key="n" className="muted">—</span> : h.note,
        ])}/>
        </Card>

        <Card title={copy.myPackage} action={<Link to="/app/packages" className="link">{copy.buyMore}</Link>}>
          <div className="pkg-name">{status.name} · {status.hours} {language === 'en' ? 'hours' : 'ชั่วโมง'}</div>
          <Progress value={status.used} max={status.hours}/>
          <div className="prog-labels">
            <span>{copy.used} {status.used} {language === 'en' ? 'hrs' : 'ชม.'}</span>
            <span>{copy.remaining} <b className="accent">{status.left} {language === 'en' ? 'hrs' : 'ชม.'}</b></span>
          </div>
          <div className="pagetip">{copy.packageTip}</div>
          <Badge tone="blue">{copy.linePush}</Badge>
        </Card>
      </div>
    </>);
}
