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
    const [mode, setMode] = useState('studio');
    const [summary, setSummary] = useState(null);
    const [busy, setBusy] = useState(false);
    const [teachers, setTeachers] = useState([]);
    const [teacherId, setTeacherId] = useState('');

    const loadDays = () => api.getDays(teacherId).then(setDays);

    useEffect(() => {
        api.getTeachers().then((rows) => {
            setTeachers(rows);
            if (rows.length && !teacherId) {
                setTeacherId(String(rows[0].id));
            }
        }).catch(() => setTeachers([]));
        api.getPackageStatus().then(setPkg).catch(() => setPkg(null));
    }, [language]);

    useEffect(() => {
        if (!teacherId) {
            return;
        }
        loadDays();
    }, [teacherId, language]);

    const selectedDayStr = selectedDay !== null ? toIsoDate(selectedDay, calMonth, calYear) : null;

    useEffect(() => {
        if (!selectedDayStr) {
            setSlots(null);
            return;
        }
        setSlots(null);
        setSelectedTime('');
        setSummary(null);
        api.getSlots(selectedDayStr, teacherId).then(setSlots);
    }, [selectedDayStr, teacherId, language]);

    useEffect(() => {
        if (!selectedDayStr || !selectedTime || !teacherId) {
            setSummary(null);
            return;
        }
        api.getBookingSummary(selectedDayStr, selectedTime, teacherId).then(setSummary);
    }, [selectedDayStr, selectedTime, teacherId, language]);

    const months = language === 'en'
        ? ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
        : THAI_MONTHS;
    const weekdays = language === 'en' ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : THAI_DAYS;
    const yearLabel = language === 'en' ? calYear : calYear + 543;

    const formatDay = (d, m, y) => {
        const dayName = weekdays[new Date(y, m, d).getDay()];
        return `${dayName} ${d} ${months[m]}`;
    };

    const hoursLeft = summary?.leftHours ?? pkg?.left ?? 0;
    const canBook = hoursLeft > 0;
    const selectedTeacher = teachers.find((row) => String(row.id) === String(teacherId));

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
            await api.createBooking(selectedDayStr, selectedTime, mode, teacherId);
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
    const openSlotCount = slots?.filter((slot) => !slot.full).length ?? 0;

    return (
      <div className="booking-page">
        <header className="booking-topbar">
          <div className="booking-topbar-main">
            <span className="booking-eyebrow">{t('nav.booking')}</span>
            <h2 className="booking-title">{t('booking.pickDay')}</h2>
          </div>
          <div className="booking-topbar-meta">
            {pkg && (
              <div className={`booking-hours-chip${pkg.name === '—' ? ' warn' : ''}`}>
                <span className="label">{t('booking.hoursLeft')}</span>
                <strong>{pkg.name === '—' ? '0' : pkg.left} {t('booking.hoursUnit')}</strong>
                {pkg.name !== '—' && <span className="sub">{pkg.name}</span>}
              </div>
            )}
            {teachers.length > 1 && (
              <label className="booking-teacher-pick">
                <span>{language === 'en' ? 'Teacher' : 'ครูผู้สอน'}</span>
                <select
                  className="input"
                  value={teacherId}
                  onChange={(e) => {
                      setTeacherId(e.target.value);
                      setSelectedDay(null);
                      setSelectedTime('');
                  }}
                >
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.nickname} · {teacher.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </header>

        <ol className="booking-steps" aria-label={t('nav.booking')}>
          <li className={`booking-step${selectedDay !== null ? ' done' : ' active'}`}>
            <span className="num">1</span>
            <span>{t('booking.pickDay')}</span>
          </li>
          <li className={`booking-step${selectedTime ? ' done' : selectedDay !== null ? ' active' : ''}`}>
            <span className="num">2</span>
            <span>{t('booking.pickTime')}</span>
          </li>
          <li className={`booking-step${selectedTime ? ' active' : ''}`}>
            <span className="num">3</span>
            <span>{t('booking.summary')}</span>
          </li>
        </ol>

        <div className="booking-layout">
          <section className="booking-calendar-panel">
            <Card className="booking-calendar-card">
              <div className="cal-shell">
                <div className="cal-header">
                  <button type="button" className="cal-nav" onClick={prevMonth} aria-label={language === 'en' ? 'Previous month' : 'เดือนก่อนหน้า'}>
                    ‹
                  </button>
                  <div className="cal-title-wrap">
                    <span className="cal-title">{months[calMonth]}</span>
                    <span className="cal-year">{yearLabel}</span>
                  </div>
                  <button type="button" className="cal-nav" onClick={nextMonth} aria-label={language === 'en' ? 'Next month' : 'เดือนถัดไป'}>
                    ›
                  </button>
                </div>

                <div className="cal-weekdays">
                  {weekdays.map((day, index) => (
                    <div key={day} className={`cal-wd${index === 0 || index === 6 ? ' weekend' : ''}`}>
                      {day}
                    </div>
                  ))}
                </div>

                <div className="cal-grid">
                  {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`e${i}`} className="cal-empty"/>
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const d = i + 1;
                    const dow = new Date(calYear, calMonth, d).getDay();
                    const isPast = calYear < todayYear
                        || (calYear === todayYear && calMonth < todayMonth)
                        || (calYear === todayYear && calMonth === todayMonth && d < todayDate);
                    const isToday = calYear === todayYear && calMonth === todayMonth && d === todayDate;
                    const available = hasSlots(d);
                    const isSelected = selectedDay === d;
                    return (
                      <button
                        key={d}
                        type="button"
                        className={[
                          'cal-day',
                          dow === 0 || dow === 6 ? 'weekend' : '',
                          isToday ? 'today' : '',
                          isSelected ? 'selected' : '',
                          available ? 'available' : '',
                          isPast ? 'past' : '',
                        ].filter(Boolean).join(' ')}
                        disabled={isPast || !available}
                        onClick={() => setSelectedDay(d)}
                      >
                        <span className="cal-day-num">{d}</span>
                        {available && !isPast && <span className="cal-dot" aria-hidden="true"/>}
                      </button>
                    );
                  })}
                </div>

                <div className="cal-legend">
                  <span><span className="cal-dot-legend available"/> {t('booking.available')}</span>
                  <span><span className="cal-dot-legend today"/> {t('booking.today')}</span>
                  <span><span className="cal-dot-legend selected"/> {t('booking.selected')}</span>
                </div>
              </div>
            </Card>
          </section>

          <aside className="booking-side">
            {selectedDay === null ? (
              <Card className="booking-side-card">
                <div className="booking-empty">
                  <div className="booking-empty-icon" aria-hidden="true">📆</div>
                  <h3>{t('booking.empty')}</h3>
                  <p className="muted">{t('booking.tip')}</p>
                </div>
              </Card>
            ) : (
              <Card
                className="booking-side-card"
                title={t('booking.pickTime')}
                action={slots ? <span className="badge blue">{openSlotCount} {language === 'en' ? 'open' : 'ว่าง'}</span> : null}
              >
                <p className="booking-selected-date">
                  {formatDay(selectedDay, calMonth, calYear)}
                </p>
                {slots === null ? (
                  <Spinner />
                ) : slots.length === 0 ? (
                  <div className="empty">{t('booking.empty')}</div>
                ) : (
                  <div className="time-slots-grid">
                    {slots.map((slot) => (
                      <button
                        key={slot.time}
                        type="button"
                        disabled={slot.full}
                        className={`time-slot ${selectedTime === slot.time ? 'on' : ''} ${slot.full ? 'full' : ''}`}
                        onClick={() => setSelectedTime(slot.time)}
                      >
                        <span className="ts-time">{slot.time}</span>
                        <span className="ts-end">–{plus1(slot.time)}</span>
                        {slot.full && <span className="ts-full">{t('booking.full')}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {selectedTime && (
              <Card className="booking-summary-card" title={t('booking.summary')}>
                <div className="booking-summary-panel">
                  <div className="sumrow">
                    <span className="muted">{t('booking.datetime')}</span>
                    <b>{formatDay(selectedDay, calMonth, calYear)} · {selectedTime}–{plus1(selectedTime)}</b>
                  </div>
                  <div className="sumrow">
                    <span className="muted">{t('booking.teacher')}</span>
                    <span>{selectedTeacher?.nickname || t('booking.teacherValue')}</span>
                  </div>
                  <div className="sumrow">
                    <span className="muted">{t('booking.mode')}</span>
                    <div className="booking-mode-row">
                      <button
                        type="button"
                        className={`booking-mode-btn${mode === 'studio' ? ' on' : ''}`}
                        onClick={() => setMode('studio')}
                      >
                        {t('booking.modeStudio')}
                      </button>
                      <button
                        type="button"
                        className={`booking-mode-btn${mode === 'online' ? ' on' : ''}`}
                        onClick={() => setMode('online')}
                      >
                        {t('booking.modeOnline')}
                      </button>
                    </div>
                  </div>
                  <div className="sumrow">
                    <span className="muted">{t('booking.deduct')}</span>
                    <span>{t('booking.deductValue')}</span>
                  </div>
                  <div className="sumrow total">
                    <span>{t('booking.hoursLeft')}</span>
                    <span className="accent">
                      {summary ? `${summary.leftHours} ${t('booking.hoursUnit')}` : '…'}
                    </span>
                  </div>
                  <Button green style={{ width: '100%', marginTop: 16 }} onClick={confirm} disabled={busy || !canBook}>
                    {busy ? t('booking.booking') : t('booking.confirm')}
                  </Button>
                </div>
              </Card>
            )}
          </aside>
        </div>
      </div>
    );
}
