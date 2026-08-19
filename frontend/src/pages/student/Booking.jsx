import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
function toIsoDate(d, m, y) {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
export default function Booking() {
    const { language, t, toast } = useApp();
    const navigate = useNavigate();
    const [days, setDays] = useState([]);
    const [pkg, setPkg] = useState(null);
    const today = new Date();
    const [calMonth, setCalMonth] = useState(today.getMonth());
    const [calYear, setCalYear] = useState(today.getFullYear());
    const [selectedDay, setSelectedDay] = useState(null);
    const [slots, setSlots] = useState(null);
    const [selectedTime, setSelectedTime] = useState('');
    const [summary, setSummary] = useState(null);
    const [busy, setBusy] = useState(false);
    const loadDays = () => api.getDays().then(setDays);
    useEffect(() => {
        loadDays();
        api.getPackageStatus().then(setPkg).catch(() => setPkg(null));
    }, [language]);
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
    }, [selectedDayStr, language]);
    useEffect(() => {
        if (!selectedDayStr || !selectedTime) {
            setSummary(null);
            return;
        }
        api.getBookingSummary(selectedDayStr, selectedTime).then(setSummary);
    }, [selectedDayStr, selectedTime, language]);
    const months = language === 'en'
        ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        : THAI_MONTHS;
    const weekdays = language === 'en' ? ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] : THAI_DAYS;
    const yearLabel = language === 'en' ? calYear : calYear + 543;
    const formatDay = (d, m, y) => {
        const dayName = weekdays[new Date(y, m, d).getDay()];
        return `${dayName} ${d} ${months[m]}`;
    };
    const hoursLeft = summary?.leftHours ?? pkg?.left ?? 0;
    const canBook = hoursLeft > 0;
    const confirm = async () => {
        if (!selectedDayStr || !selectedTime || busy) {
            return;
        }
        if (!canBook) {
            toast(t('booking.noHours'));
            return;
        }
        setBusy(true);
        try {
            await api.createBooking(selectedDayStr, selectedTime);
            toast(t('booking.success'), 'ok');
            navigate('/app');
        }
        catch (err) {
            toast(err instanceof Error ? err.message : t('booking.failed'));
            api.getSlots(selectedDayStr).then(setSlots);
            loadDays();
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
    const hasSlots = (d) => days.includes(toIsoDate(d, calMonth, calYear));
    return (<div className="booking-layout">
      {pkg && (
        <div className="alertbar" style={{ gridColumn: '1 / -1' }}>
          <b>{pkg.name === '—' ? t('booking.noHours') : `${t('booking.hoursLeft')} ${pkg.left} ${t('booking.hoursUnit')}`}</b>
          {pkg.name !== '—' && <span className="muted"> · {pkg.name}</span>}
        </div>
      )}
      <Card title={`📅 ${t('booking.pickDay')}`}>
        <div className="cal-header">
          <button className="cal-nav" onClick={prevMonth}>‹</button>
          <span className="cal-title">{months[calMonth]} {yearLabel}</span>
          <button className="cal-nav" onClick={nextMonth}>›</button>
        </div>

        <div className="cal-weekdays">
          {weekdays.map((d) => <div key={d} className="cal-wd">{d}</div>)}
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
          <span><span className="cal-dot-legend available"/> {t('booking.available')}</span>
          <span><span className="cal-dot-legend today"/> {t('booking.today')}</span>
          <span><span className="cal-dot-legend selected"/> {t('booking.selected')}</span>
        </div>
      </Card>

      <div className="booking-right">
        {selectedDay === null ? (<Card>
            <div className="empty-state">
              <div style={{ fontSize: 48 }}>📆</div>
              <p>{t('booking.empty')}</p>
            </div>
          </Card>) : (<Card title={`⏰ ${t('booking.pickTime')} — ${formatDay(selectedDay, calMonth, calYear)}`}>
            {slots === null ? (<Spinner />) : slots.length === 0 ? (
              <div className="empty">{t('booking.empty')}</div>
            ) : (<div className="time-slots-grid">
                {slots.map((s) => (<button key={s.time} disabled={s.full} className={`time-slot ${selectedTime === s.time ? 'on' : ''} ${s.full ? 'full' : ''}`} onClick={() => setSelectedTime(s.time)}>
                    <span className="ts-time">{s.time}</span>
                    <span className="ts-end">–{plus1(s.time)}</span>
                    {s.full && <span className="ts-full">{t('booking.full')}</span>}
                  </button>))}
              </div>)}
          </Card>)}

        {selectedTime && (<Card title={t('booking.summary')}>
            <div className="sumrow">
              <span className="muted">{t('booking.datetime')}</span>
              <b>{formatDay(selectedDay, calMonth, calYear)} {selectedTime}–{plus1(selectedTime)}</b>
            </div>
            <div className="sumrow">
              <span className="muted">{t('booking.teacher')}</span>
              <span>{t('booking.teacherValue')}</span>
            </div>
            <div className="sumrow">
              <span className="muted">{t('booking.deduct')}</span>
              <span>{t('booking.deductValue')}</span>
            </div>
            <div className="sumrow total">
              <span>{t('booking.hoursLeft')}</span>
              <span className="accent">{summary ? `${summary.leftHours} ${t('booking.hoursUnit')}` : '…'}</span>
            </div>
            <Button green style={{ width: '100%', marginTop: 16 }} onClick={confirm} disabled={busy || !canBook}>
              {busy ? t('booking.booking') : t('booking.confirm')}
            </Button>
          </Card>)}

        <div className="pagetip">
          {t('booking.tip')}
        </div>
      </div>
    </div>);
}
