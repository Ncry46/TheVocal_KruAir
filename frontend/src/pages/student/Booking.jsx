import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Input, Spinner } from '@components/ui';
import { api } from '@app/services/apiClient';
import { useApp } from '@app/context/AppContext';

const plus1 = (t) => String(Number(t.split(':')[0]) + 1).padStart(2, '0') + ':00';
const THAI_DAYS = ['อา', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/** Normalize typed time like 11, 1100, 11.00 → 11:00 */
function normalizeSlotTime(value) {
    const raw = String(value || '').trim();
    if (!raw) {
        return '';
    }
    const digits = raw.replace(/\D/g, '');
    if (/^\d{3,4}$/.test(digits) && !raw.includes(':') && !raw.includes('.')) {
        const padded = digits.padStart(4, '0');
        const hour = Number(padded.slice(0, 2));
        const minute = Number(padded.slice(2));
        if (hour <= 23 && minute <= 59) {
            return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        }
    }
    const match = raw.match(/^(\d{1,2})(?::|\.)?(\d{2})?$/);
    if (!match) {
        return raw;
    }
    const hour = Number(match[1]);
    const minute = match[2] == null || match[2] === '' ? 0 : Number(match[2]);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) {
        return raw;
    }
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Group selected slot times into consecutive booking blocks. */
function groupConsecutiveTimes(times, orderedSlots) {
    const order = orderedSlots.length ? orderedSlots : [...times].sort();
    const selected = [...new Set(times)].filter((time) => order.includes(time));
    selected.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    const blocks = [];
    for (const time of selected) {
        const index = order.indexOf(time);
        const last = blocks[blocks.length - 1];
        if (last && order.indexOf(last.start) + last.hours === index) {
            last.hours += 1;
            last.end = plus1(time);
        }
        else {
            blocks.push({ start: time, hours: 1, end: plus1(time) });
        }
    }
    return blocks;
}

function formatTimeBlocks(blocks) {
    return blocks.map((block) => (
        block.hours > 1
            ? `${block.start}–${block.end} (${block.hours})`
            : `${block.start}–${block.end}`
    )).join(' · ');
}

/** Keep digits only and format as HH:MM while typing (e.g. 1100 → 11:00). */
function digitsTimeMask(value) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 4);
    if (!digits) {
        return '';
    }
    if (digits.length <= 2) {
        return digits;
    }
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

/** On blur, force full HH:MM (11 → 11:00). */
function finalizeTimeMask(value) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 4);
    if (!digits) {
        return '';
    }
    if (digits.length <= 2) {
        const hour = Number(digits);
        if (!Number.isInteger(hour) || hour > 23) {
            return digits;
        }
        return `${String(hour).padStart(2, '0')}:00`;
    }
    const hour = Number(digits.slice(0, 2));
    const minute = Number(digits.slice(2).padEnd(2, '0'));
    if (hour > 23 || minute > 59) {
        return digitsTimeMask(value);
    }
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

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
    const [selectedTimes, setSelectedTimes] = useState([]);
    const [startDraft, setStartDraft] = useState('');
    const [endDraft, setEndDraft] = useState('');
    const [mode, setMode] = useState('studio');
    const [summary, setSummary] = useState(null);
    const [busy, setBusy] = useState(false);
    const [teachers, setTeachers] = useState([]);
    const [teacherId, setTeacherId] = useState('');

    const loadDays = (id = teacherId) => api.getDays(id).then(setDays);

    useEffect(() => {
        loadDays();
        api.getTeachers().then((rows) => {
            setTeachers(rows);
            if (rows.length && !teacherId) {
                setTeacherId(String(rows[0].id));
            }
        }).catch(() => setTeachers([]));
        api.getPackageStatus().then(setPkg).catch(() => setPkg(null));
    }, [language]);

    useEffect(() => {
        loadDays(teacherId);
    }, [teacherId, language]);

    const selectedDayStr = selectedDay !== null ? toIsoDate(selectedDay, calMonth, calYear) : null;
    const slotTimes = useMemo(() => (slots || []).map((slot) => slot.time), [slots]);
    const bookBlocks = useMemo(
        () => groupConsecutiveTimes(selectedTimes, slotTimes),
        [selectedTimes, slotTimes],
    );
    const bookHoursTotal = bookBlocks.reduce((sum, block) => sum + block.hours, 0);
    const primaryBlock = bookBlocks[0] || null;

    useEffect(() => {
        if (!selectedDayStr) {
            setSlots(null);
            return;
        }
        setSlots(null);
        setSelectedTimes([]);
        setStartDraft('');
        setEndDraft('');
        setSummary(null);
        api.getSlots(selectedDayStr, teacherId).then(setSlots);
    }, [selectedDayStr, teacherId, language]);

    useEffect(() => {
        if (!selectedDayStr || !primaryBlock) {
            setSummary(null);
            return;
        }
        api.getBookingSummary(selectedDayStr, primaryBlock.start, teacherId, bookHoursTotal).then(setSummary);
    }, [selectedDayStr, primaryBlock?.start, bookHoursTotal, teacherId, language]);

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
    const canBook = hoursLeft > 0 && bookHoursTotal > 0 && hoursLeft >= bookHoursTotal;
    const selectedTeacher = teachers.find((row) => String(row.id) === String(teacherId));
    const hasSelection = bookBlocks.length > 0;

    const toggleTime = (time) => {
        setSelectedTimes((current) => (
            current.includes(time)
                ? current.filter((item) => item !== time)
                : [...current, time]
        ));
    };

    const applyTimeRangeFromDrafts = (nextStart, nextEnd, currentTimes) => {
        const startRaw = finalizeTimeMask(nextStart);
        const endRaw = finalizeTimeMask(nextEnd);
        const startDigits = startRaw.replace(/\D/g, '');
        const endDigits = endRaw.replace(/\D/g, '');
        if (!startRaw && !endRaw) {
            return { startDraft: '', endDraft: '', times: currentTimes, toast: null };
        }
        if (startDigits.length < 3 || endDigits.length < 3) {
            return { startDraft: startRaw, endDraft: endRaw, times: currentTimes, toast: null };
        }
        const start = normalizeSlotTime(startRaw);
        const end = normalizeSlotTime(endRaw);
        if (!start || !end) {
            return { startDraft: startRaw, endDraft: endRaw, times: currentTimes, toast: 'needStartEnd' };
        }
        if (!slotTimes.includes(start)) {
            return { startDraft: start, endDraft: endRaw, times: currentTimes, toast: 'badTime' };
        }
        if (start >= end) {
            return { startDraft: start, endDraft: end, times: currentTimes, toast: 'endAfterStart' };
        }
        const range = slotTimes.filter((time) => time >= start && time < end);
        if (!range.length) {
            return { startDraft: start, endDraft: end, times: currentTimes, toast: 'badTime' };
        }
        const openRange = range.filter((time) => {
            const slot = (slots || []).find((row) => row.time === time);
            return slot && !slot.full;
        });
        if (!openRange.length) {
            return { startDraft: start, endDraft: end, times: currentTimes, toast: 'timeFull' };
        }
        return {
            startDraft: start,
            endDraft: end,
            times: [...new Set([...currentTimes, ...openRange])],
            toast: null,
        };
    };

    const blurTimeDraft = (field) => {
        const nextStart = field === 'startDraft' ? finalizeTimeMask(startDraft) : startDraft;
        const nextEnd = field === 'endDraft' ? finalizeTimeMask(endDraft) : endDraft;
        const next = applyTimeRangeFromDrafts(nextStart, nextEnd, selectedTimes);
        setStartDraft(next.startDraft);
        setEndDraft(next.endDraft);
        setSelectedTimes(next.times);
        if (next.toast === 'needStartEnd') {
            toast(t('booking.needStartEnd'));
        }
        else if (next.toast === 'badTime') {
            toast(t('booking.badTime'));
        }
        else if (next.toast === 'endAfterStart') {
            toast(t('booking.endAfterStart'));
        }
        else if (next.toast === 'timeFull') {
            toast(t('booking.timeFull'));
        }
    };

    const confirm = async () => {
        if (!selectedDayStr || !bookBlocks.length || busy) {
            return;
        }
        if (hoursLeft < bookHoursTotal) {
            toast(t('booking.notEnoughHours').replace('{n}', String(bookHoursTotal)));
            return;
        }
        if (!canBook) {
            toast(t('booking.noHours'));
            return;
        }
        setBusy(true);
        try {
            for (const block of bookBlocks) {
                await api.createBooking(selectedDayStr, block.start, mode, teacherId, block.hours);
            }
            toast(
                bookBlocks.length > 1
                    ? t('booking.successMany').replace('{n}', String(bookBlocks.length))
                    : t('booking.success'),
                'ok',
            );
            navigate('/app');
        }
        catch (err) {
            toast(err instanceof Error ? err.message : t('booking.failed'));
            api.getSlots(selectedDayStr, teacherId).then(setSlots);
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
                      setSelectedTimes([]);
                      setStartDraft('');
                      setEndDraft('');
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
          <li className={`booking-step${hasSelection ? ' done' : selectedDay !== null ? ' active' : ''}`}>
            <span className="num">2</span>
            <span>{t('booking.pickTimes')}</span>
          </li>
          <li className={`booking-step${hasSelection ? ' active' : ''}`}>
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
                  <h3>{t('booking.empty')}</h3>
                  <p className="muted">{t('booking.tip')}</p>
                </div>
              </Card>
            ) : (
              <Card
                className="booking-side-card"
                title={t('booking.pickTimes')}
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
                  <>
                    <div className="time-slots-grid book-time-grid">
                      {slots.map((slot) => {
                          const selected = selectedTimes.includes(slot.time);
                          return (
                            <button
                              key={slot.time}
                              type="button"
                              disabled={slot.full}
                              className={`time-slot${selected ? ' on' : ''}${slot.full ? ' full' : ''}`}
                              onClick={() => toggleTime(slot.time)}
                            >
                              <span className="ts-time">{slot.time}</span>
                              <span className="ts-end">–{plus1(slot.time)}</span>
                              {slot.full && <span className="ts-full">{t('booking.full')}</span>}
                              {selected && !slot.full && <span className="ts-full">{t('booking.timePicked')}</span>}
                            </button>
                          );
                      })}
                    </div>
                    <div className="book-time-type book-time-range">
                      <label className="book-time-field">
                        <span className="book-time-type-label">{t('booking.timeStart')}</span>
                        <Input
                          className="input book-time-input"
                          inputMode="numeric"
                          pattern="[0-9:]*"
                          value={startDraft}
                          placeholder={t('booking.timeStartPlaceholder')}
                          onChange={(e) => setStartDraft(digitsTimeMask(e.target.value))}
                          onBlur={() => blurTimeDraft('startDraft')}
                          onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                  e.preventDefault();
                                  blurTimeDraft('startDraft');
                              }
                          }}
                          autoComplete="off"
                        />
                      </label>
                      <span className="book-time-range-sep" aria-hidden="true">→</span>
                      <label className="book-time-field">
                        <span className="book-time-type-label">{t('booking.timeEnd')}</span>
                        <Input
                          className="input book-time-input"
                          inputMode="numeric"
                          pattern="[0-9:]*"
                          value={endDraft}
                          placeholder={t('booking.timeEndPlaceholder')}
                          onChange={(e) => setEndDraft(digitsTimeMask(e.target.value))}
                          onBlur={() => blurTimeDraft('endDraft')}
                          onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                  e.preventDefault();
                                  blurTimeDraft('endDraft');
                              }
                          }}
                          autoComplete="off"
                        />
                      </label>
                    </div>
                    <div className="muted book-time-hint">{t('booking.timeRangeHint')}</div>
                    {bookBlocks.length > 0 ? (
                      <div className="book-time-summary">
                        {t('booking.timeSummary')
                            .replace('{hours}', String(bookHoursTotal))
                            .replace('{ranges}', formatTimeBlocks(bookBlocks))}
                      </div>
                    ) : (
                      <div className="muted book-time-hint">{t('booking.timeHint')}</div>
                    )}
                  </>
                )}
              </Card>
            )}

            {hasSelection && (
              <Card className="booking-summary-card" title={t('booking.summary')}>
                <div className="booking-summary-panel">
                  <div className="sumrow">
                    <span className="muted">{t('booking.datetime')}</span>
                    <b>{formatDay(selectedDay, calMonth, calYear)} · {formatTimeBlocks(bookBlocks)}</b>
                  </div>
                  <div className="sumrow">
                    <span className="muted">{t('booking.duration')}</span>
                    <span>{bookHoursTotal} {t('booking.hoursUnit')}</span>
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
                    <span>
                      {bookHoursTotal > 1
                          ? t('booking.deductValueMulti').replace('{hours}', String(bookHoursTotal))
                          : t('booking.deductValue')}
                    </span>
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
