import { useEffect, useState } from 'react';
import { Button, Card, Spinner } from '@components/ui';
import { api } from '@app/services/apiClient';
import { useApp } from '@app/context/AppContext';
const plus1 = (t) => String(Number(t.split(':')[0]) + 1).padStart(2, '0') + ':00';
const THAI_DAYS = ['อา', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year, month) {
    return new Date(year, month, 1).getDay();
}
function formatThaiDay(d, m, y) {
    const dayName = THAI_DAYS[new Date(y, m, d).getDay()];
    return `${dayName} ${d} ${THAI_MONTHS[m]}`;
}
function toIsoDate(d, m, y) {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
export default function Booking() {
    const { toast } = useApp();
    const [days, setDays] = useState([]);
    const today = new Date();
    const [calMonth, setCalMonth] = useState(today.getMonth());
    const [calYear, setCalYear] = useState(today.getFullYear());
    const [selectedDay, setSelectedDay] = useState(null);
    const [slots, setSlots] = useState(null);
    const [selectedTime, setSelectedTime] = useState('');
    const [summary, setSummary] = useState(null);
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        api.getDays().then(setDays);
    }, []);
    const selectedDayStr = selectedDay !== null ? toIsoDate(selectedDay, calMonth, calYear) : null;
    useEffect(() => {
        if (!selectedDayStr) {
            setSlots(null);
            return;
        }
        setSlots(null);
        setSelectedTime('');
        setSummary(null);
        api.getSlots(selectedDayStr).then(setSlots);
    }, [selectedDayStr]);
    useEffect(() => {
        if (!selectedDayStr || !selectedTime) {
            setSummary(null);
            return;
        }
        api.getBookingSummary(selectedDayStr, selectedTime).then(setSummary);
    }, [selectedDayStr, selectedTime]);
    const confirm = async () => {
        if (!selectedDayStr || !selectedTime)
            return;
        setBusy(true);
        try {
            await api.createBooking(selectedDayStr, selectedTime);
            toast('จองสำเร็จแล้ว! ระบบล็อกสล็อตไว้ให้แล้ว', 'ok');
        }
        finally {
            setBusy(false);
        }
    };
    const daysInMonth = getDaysInMonth(calYear, calMonth);
    const firstDay = getFirstDayOfMonth(calYear, calMonth);
    const todayDate = today.getDate();
    const todayMonth = today.getMonth();
    const todayYear = today.getFullYear();
    const prevMonth = () => {
        if (calMonth === 0) {
            setCalMonth(11);
            setCalYear(calYear - 1);
        }
        else {
            setCalMonth(calMonth - 1);
        }
    };
    const nextMonth = () => {
        if (calMonth === 11) {
            setCalMonth(0);
            setCalYear(calYear + 1);
        }
        else {
            setCalMonth(calMonth + 1);
        }
    };
    // Check if a date has available slots (match against days array)
    const hasSlots = (d) => {
        return days.includes(toIsoDate(d, calMonth, calYear));
    };
    return (<div className="booking-layout">
      {/* Calendar Card */}
      <Card title="📅 เลือกวันเรียน">
        <div className="cal-header">
          <button className="cal-nav" onClick={prevMonth}>‹</button>
          <span className="cal-title">{THAI_MONTHS[calMonth]} {calYear + 543}</span>
          <button className="cal-nav" onClick={nextMonth}>›</button>
        </div>

        <div className="cal-weekdays">
          {THAI_DAYS.map((d) => <div key={d} className="cal-wd">{d}</div>)}
        </div>

        <div className="cal-grid">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} className="cal-empty"/>)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d = i + 1;
            const isPast = calYear < todayYear || (calYear === todayYear && calMonth < todayMonth) || (calYear === todayYear && calMonth === todayMonth && d < todayDate);
            const isToday = calYear === todayYear && calMonth === todayMonth && d === todayDate;
            const available = hasSlots(d);
            const isSelected = selectedDay === d;
            return (<button key={d} className={`cal-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${available ? 'available' : ''} ${isPast ? 'past' : ''}`} disabled={isPast || !available} onClick={() => setSelectedDay(d)}>
                {d}
                {available && !isPast && <span className="cal-dot"/>}
              </button>);
        })}
        </div>

        <div className="cal-legend">
          <span><span className="cal-dot-legend available"/> มีเวลาว่าง</span>
          <span><span className="cal-dot-legend today"/> วันนี้</span>
          <span><span className="cal-dot-legend selected"/> เลือกแล้ว</span>
        </div>
      </Card>

      {/* Time Slots + Summary */}
      <div className="booking-right">
        {selectedDay === null ? (<Card>
            <div className="empty-state">
              <div style={{ fontSize: 48 }}>📆</div>
              <p>เลือกวันจากปฏิทินด้านซ้ายก่อน</p>
            </div>
          </Card>) : (<Card title={`⏰ เลือกเวลา — ${formatThaiDay(selectedDay, calMonth, calYear)}`}>
            {slots === null ? (<Spinner />) : (<div className="time-slots-grid">
                {slots.map((s) => (<button key={s.time} disabled={s.status === 'เต็ม'} className={`time-slot ${selectedTime === s.time ? 'on' : ''} ${s.status === 'เต็ม' ? 'full' : ''}`} onClick={() => setSelectedTime(s.time)}>
                    <span className="ts-time">{s.time}</span>
                    <span className="ts-end">–{plus1(s.time)}</span>
                    {s.status === 'เต็ม' && <span className="ts-full">เต็ม</span>}
                  </button>))}
              </div>)}
          </Card>)}

        {selectedTime && (<Card title="สรุปการจอง">
            <div className="sumrow">
              <span className="muted">วัน-เวลา</span>
              <b>{formatThaiDay(selectedDay, calMonth, calYear)} {selectedTime}–{plus1(selectedTime)} น.</b>
            </div>
            <div className="sumrow">
              <span className="muted">ครูผู้สอน</span>
              <span>ครูแอร์ (เรียนสด 1:1)</span>
            </div>
            <div className="sumrow">
              <span className="muted">การหักชั่วโมง</span>
              <span>หักเมื่อเรียนจบจริง (1 ชม./ครั้ง)</span>
            </div>
            <div className="sumrow total">
              <span>ชั่วโมงคงเหลือ</span>
              <span className="accent">{summary ? `${summary.leftHours} ชม.` : '…'}</span>
            </div>
            <Button green style={{ width: '100%', marginTop: 16 }} onClick={confirm} disabled={busy}>
              {busy ? 'กำลังจอง…' : '✅ ยืนยันการจอง'}
            </Button>
          </Card>)}

        <div className="pagetip">
          💡 ระบบจะล็อกสล็อตเมื่อจองสำเร็จ และส่งข้อความแจ้งเตือน + ปุ่มคอนเฟิร์มก่อนเรียน 1 วัน
        </div>
      </div>
    </div>);
}
