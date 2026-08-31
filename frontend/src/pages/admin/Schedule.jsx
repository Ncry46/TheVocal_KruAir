import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Field, Input, Modal, Spinner } from '@components/ui';
import { BellIcon, CheckIcon } from '@components/icons';
import { api } from '@app/services/apiClient';
import { useApp } from '@app/context/AppContext';

const plus1 = (t) => String(Number(t.split(':')[0]) + 1).padStart(2, '0') + ':00';
const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TH_WEEKDAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const EN_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toIso(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatLongDate(iso, language) {
    const [year, month, day] = iso.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    if (language === 'en') {
        return `${EN_WEEKDAYS[date.getDay()]} ${day} ${EN_MONTHS[month - 1]} ${year}`;
    }
    return `${TH_WEEKDAYS[date.getDay()]} ${day} ${TH_MONTHS[month - 1]} ${year}`;
}

export default function Schedule() {
    const { language, t, toast } = useApp();
    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth());
    const [week, setWeek] = useState(null);
    const [selectedIso, setSelectedIso] = useState(toIso(today.getFullYear(), today.getMonth(), today.getDate()));
    const [selectedLesson, setSelectedLesson] = useState(null);
    const [logOpen, setLogOpen] = useState(false);
    const [logNote, setLogNote] = useState('');
    const [logAudioUrl, setLogAudioUrl] = useState('');
    const [logBusy, setLogBusy] = useState(false);
    const [slotBusy, setSlotBusy] = useState(false);
    const [addTime, setAddTime] = useState('');
    const [bulkOpen, setBulkOpen] = useState(false);
    const [bulkFrom, setBulkFrom] = useState('');
    const [bulkTo, setBulkTo] = useState('');
    const [bookOpen, setBookOpen] = useState(false);
    const [students, setStudents] = useState([]);
    const [bookForm, setBookForm] = useState({ studentId: '', time: '', hours: '1', topic: '' });
    const [bookBusy, setBookBusy] = useState(false);

    const load = () => api.getTeacherSchedule(year, month + 1).then(setWeek);

    useEffect(() => {
        const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
        if (!selectedIso.startsWith(monthPrefix)) {
            const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
            setSelectedIso(isCurrentMonth
                ? toIso(today.getFullYear(), today.getMonth(), today.getDate())
                : toIso(year, month, 1));
        }
    }, [year, month]);

    useEffect(() => {
        load();
    }, [language, year, month]);

    useEffect(() => {
        const lessons = week?.lessonsByDate?.[selectedIso] ?? [];
        setSelectedLesson((current) => {
            if (!lessons.length) {
                return null;
            }
            const match = current && lessons.find((lesson) => lesson.bookingId === current.bookingId);
            return match || lessons[0];
        });
    }, [week, selectedIso]);

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstWeekday = new Date(year, month, 1).getDay();
    const monthLabel = language === 'en'
        ? `${EN_MONTHS[month]} ${year}`
        : `${TH_MONTHS[month]} ${year}`;
    const weekdays = language === 'en' ? EN_WEEKDAYS : TH_WEEKDAYS;
    const todayIso = toIso(today.getFullYear(), today.getMonth(), today.getDate());
    const lessonsByDate = week?.lessonsByDate ?? {};
    const slotsByDate = week?.slotsByDate ?? {};
    const slotTimes = week?.slotTimes ?? [];
    const dayLessons = useMemo(() => lessonsByDate[selectedIso] ?? [], [lessonsByDate, selectedIso]);
    const daySlots = useMemo(() => slotsByDate[selectedIso] ?? [], [slotsByDate, selectedIso]);
    const displaySlots = useMemo(() => daySlots.filter((slot) => {
        if (slot.status !== 'booked' || !slot.bookingId) {
            return true;
        }
        return dayLessons.some((lesson) => lesson.bookingId === slot.bookingId && lesson.slotId === slot.id);
    }), [daySlots, dayLessons]);
    const unusedTimes = slotTimes.filter((time) => !daySlots.some((slot) => slot.time === time));
    const openTimes = slotTimes.filter((time) => {
        const slot = daySlots.find((item) => item.time === time);
        return !slot || slot.status === 'open';
    });

    const prevMonth = () => {
        if (month === 0) {
            setMonth(11);
            setYear((current) => current - 1);
            return;
        }
        setMonth((current) => current - 1);
    };
    const nextMonth = () => {
        if (month === 11) {
            setMonth(0);
            setYear((current) => current + 1);
            return;
        }
        setMonth((current) => current + 1);
    };

    const submitLog = async (outcome = 'done') => {
        if (!selectedLesson?.bookingId || logBusy) {
            return;
        }
        setLogBusy(true);
        try {
            await api.recordLesson(selectedLesson.bookingId, outcome, logNote, logAudioUrl);
            toast(outcome === 'no_show'
                ? t('schedule.noShowOk')
                : t('schedule.logOk'), 'ok');
            setLogOpen(false);
            setSelectedLesson(null);
            await load();
        }
        catch (err) {
            toast(err instanceof Error ? err.message : t('schedule.logFailed'));
        }
        finally {
            setLogBusy(false);
        }
    };

    const setSlot = async (slot, action) => {
        if (!slot?.id || slotBusy) {
            return;
        }
        if (action === 'close' && slot.status === 'booked') {
            if (!window.confirm(t('schedule.closeBookedConfirm'))) {
                return;
            }
        }
        setSlotBusy(true);
        try {
            await api.setTeacherSlot(slot.id, action);
            toast(action === 'open' ? t('schedule.opened') : t('schedule.closedOk'), 'ok');
            await load();
        }
        catch (err) {
            toast(err instanceof Error ? err.message : t('schedule.slotFailed'));
        }
        finally {
            setSlotBusy(false);
        }
    };

    const addSlot = async () => {
        if (!addTime || slotBusy) {
            return;
        }
        setSlotBusy(true);
        try {
            await api.createTeacherSlot(selectedIso, addTime);
            toast(t('schedule.added'), 'ok');
            setAddTime('');
            await load();
        }
        catch (err) {
            toast(err instanceof Error ? err.message : t('schedule.slotFailed'));
        }
        finally {
            setSlotBusy(false);
        }
    };

    const bulkClose = async () => {
        if (!bulkFrom || !bulkTo || slotBusy) {
            return;
        }
        setSlotBusy(true);
        try {
            const result = await api.bulkCloseSlots(bulkFrom, bulkTo);
            toast(t('schedule.bulkOk').replace('{closed}', String(result.closed)).replace('{skipped}', String(result.skippedBooked)), 'ok');
            setBulkOpen(false);
            await load();
        }
        catch (err) {
            toast(err instanceof Error ? err.message : t('schedule.slotFailed'));
        }
        finally {
            setSlotBusy(false);
        }
    };

    const remind = async () => {
        if (!selectedLesson?.bookingId || slotBusy) {
            return;
        }
        setSlotBusy(true);
        try {
            await api.remindLesson(selectedLesson.bookingId);
            toast(t('schedule.reminded'), 'ok');
        }
        catch (err) {
            toast(err instanceof Error ? err.message : t('schedule.slotFailed'));
        }
        finally {
            setSlotBusy(false);
        }
    };

    const cancelLesson = async () => {
        if (!selectedLesson?.bookingId || slotBusy) {
            return;
        }
        if (!window.confirm(t('schedule.cancelConfirm'))) {
            return;
        }
        setSlotBusy(true);
        try {
            await api.cancelTeacherLesson(selectedLesson.bookingId);
            toast(t('schedule.cancelOk'), 'ok');
            setSelectedLesson(null);
            await load();
        }
        catch (err) {
            toast(err instanceof Error ? err.message : t('schedule.slotFailed'));
        }
        finally {
            setSlotBusy(false);
        }
    };

    const openBookModal = async () => {
        setBookForm({ studentId: '', time: openTimes[0] || '', hours: '1', topic: '' });
        setBookOpen(true);
        try {
            const rows = await api.getStudents();
            setStudents(rows);
        }
        catch {
            setStudents([]);
        }
    };

    const submitBook = async () => {
        if (!bookForm.studentId || !bookForm.time) {
            toast(t('schedule.needStudent'));
            return;
        }
        setBookBusy(true);
        try {
            await api.createTeacherBooking({
                studentId: Number(bookForm.studentId),
                day: selectedIso,
                time: bookForm.time,
                hours: Number(bookForm.hours) || 1,
                topic: bookForm.topic.trim() || undefined,
            });
            toast(t('schedule.bookOk'), 'ok');
            setBookOpen(false);
            await load();
        }
        catch (err) {
            toast(err instanceof Error ? err.message : t('schedule.bookFailed'));
        }
        finally {
            setBookBusy(false);
        }
    };

    if (!week) {
        return <Spinner />;
    }

    return (<>
      <div className="alertbar">
        <BellIcon width={16} height={16}/> <b>{week.pendingCount} {t('schedule.pending')}</b>
      </div>

      <div className="sched-layout">
        <Card>
          <div className="cal-header">
            <button type="button" className="cal-nav" onClick={prevMonth} aria-label={t('schedule.prev')}>‹</button>
            <div className="cal-title">{week.title || monthLabel}</div>
            <button type="button" className="cal-nav" onClick={nextMonth} aria-label={t('schedule.next')}>›</button>
          </div>
          <div className="cal-weekdays">
            {weekdays.map((label) => <div key={label} className="cal-wd">{label}</div>)}
          </div>
          <div className="cal-grid">
            {Array.from({ length: firstWeekday }).map((_, index) => <div key={`e${index}`} className="cal-empty"/>)}
            {Array.from({ length: daysInMonth }).map((_, index) => {
                const day = index + 1;
                const iso = toIso(year, month, day);
                const count = lessonsByDate[iso]?.length ?? 0;
                const closed = (slotsByDate[iso] ?? []).some((slot) => slot.status === 'closed');
                const isToday = iso === todayIso;
                const isSelected = iso === selectedIso;
                return (
                  <button
                    key={iso}
                    type="button"
                    className={`cal-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${count > 0 ? 'available' : ''} ${closed && count === 0 ? 'closed-day' : ''}`}
                    onClick={() => {
                        setSelectedIso(iso);
                        setSelectedLesson(lessonsByDate[iso]?.[0] ?? null);
                    }}
                  >
                    {day}
                    {count > 0 && <span className="cal-dot"/>}
                    {count > 1 && <span className="sched-count">{count}</span>}
                  </button>
                );
            })}
          </div>
          <div className="cal-legend">
            <span><span className="cal-dot-legend available"/> {t('schedule.hasClass')}</span>
            <span><span className="cal-dot-legend today"/> {t('schedule.today')}</span>
            <span><span className="cal-dot-legend selected"/> {t('schedule.selected')}</span>
            <span><span className="cal-dot-legend closed"/> {t('schedule.closed')}</span>
          </div>
          <div className="dp-actions" style={{ marginTop: 14 }}>
            <Button ghost onClick={() => { setBulkFrom(selectedIso); setBulkTo(selectedIso); setBulkOpen(true); }}>
              {t('schedule.bulkClose')}
            </Button>
          </div>
        </Card>

        <Card
          title={selectedIso ? formatLongDate(selectedIso, language) : t('schedule.pickDay')}
          action={<Button pink size="sm" onClick={openBookModal}>{t('schedule.bookStudent')}</Button>}
        >
          {displaySlots.length === 0 ? (
            <div className="empty">{t('schedule.emptySlots')}</div>
          ) : (
            <div className="sched-list">
              {displaySlots.map((slot) => {
                  const lesson = dayLessons.find((item) => item.bookingId === slot.bookingId);
                  const active = selectedLesson?.bookingId && selectedLesson.bookingId === slot.bookingId;
                  const timeLabel = lesson?.timeRange
                      || `${slot.time}–${plus1(slot.time)}${language === 'en' ? '' : ' น.'}`;
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      className={`sched-lesson ${slot.status} ${active ? 'on' : ''}`}
                      onClick={() => setSelectedLesson(lesson || null)}
                    >
                      <div className="sched-time">{timeLabel}</div>
                      <div className="sched-meta">
                        <b>{lesson ? `${lesson.student}${lesson.hours > 1 ? ` · ${lesson.hours} ${language === 'en' ? 'hrs' : 'ชม.'}` : ''}` : (slot.status === 'closed' ? t('schedule.slotClosed') : t('schedule.slotOpen'))}</b>
                        <span>{lesson ? lesson.lesson : t('schedule.noStudent')}</span>
                      </div>
                      <span className={`dp-badge ${slot.status === 'booked' ? (lesson?.status || 'pending') : slot.status}`}>
                        {slot.status === 'booked'
                            ? (lesson?.status === 'confirmed' ? t('schedule.confirmed') : t('schedule.awaiting'))
                            : slot.status === 'closed' ? t('schedule.closed') : t('schedule.open')}
                      </span>
                    </button>
                  );
              })}
            </div>
          )}

          <div className="slot-add">
            <select className="input" value={addTime} onChange={(event) => setAddTime(event.target.value)}>
              <option value="">{t('schedule.pickTime')}</option>
              {unusedTimes.map((time) => <option key={time} value={time}>{time}</option>)}
            </select>
            <Button ghost onClick={addSlot} disabled={!addTime || slotBusy}>{t('schedule.addSlot')}</Button>
          </div>

          {selectedLesson && (
            <div className="dp-actions" style={{ marginTop: 16 }}>
              {selectedLesson.status === 'confirmed' ? (<>
                  <Button green onClick={() => { setLogNote(''); setLogAudioUrl(''); setLogOpen(true); }}>
                    <CheckIcon width={14} height={14}/> {t('schedule.log')}
                  </Button>
                  <Button danger onClick={() => submitLog('no_show')} disabled={logBusy}>
                    {t('schedule.noShow')}
                  </Button>
                </>) : (
                <Button ghost onClick={remind} disabled={slotBusy}>
                  {t('schedule.remind')}
                </Button>
              )}
              <Button danger onClick={cancelLesson} disabled={slotBusy}>{t('schedule.cancelLesson')}</Button>
            </div>
          )}

          {daySlots.filter((slot) => slot.status === 'open' || slot.status === 'closed').length > 0 && (
            <div className="slot-toggles">
              {daySlots.filter((slot) => slot.status !== 'booked').map((slot) => (
                <button
                  key={`t${slot.id}`}
                  type="button"
                  className={`slot-toggle ${slot.status}`}
                  disabled={slotBusy}
                  onClick={() => setSlot(slot, slot.status === 'closed' ? 'open' : 'close')}
                >
                  {slot.time} · {slot.status === 'closed' ? t('schedule.open') : t('schedule.close')}
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Modal open={logOpen} onClose={() => setLogOpen(false)} title={t('schedule.log')}>
        <div style={{ marginBottom: 16 }}>
          <div className="sumrow">
            <span className="muted">{t('schedule.when')}</span>
            <b>{selectedLesson?.timeRange || (selectedLesson ? `${selectedLesson.time}–${plus1(selectedLesson.time)}` : '')}</b>
          </div>
          <div className="sumrow">
            <span className="muted">{t('schedule.student')}</span>
            <b>{selectedLesson?.student}</b>
          </div>
          <div className="sumrow">
            <span className="muted">{t('schedule.lesson')}</span>
            <b>{selectedLesson?.lesson}</b>
          </div>
          <div className="sumrow">
            <span className="muted">{t('schedule.hours')}</span>
            <span className="disc">−{selectedLesson?.hours || 1} {language === 'en' ? 'hr' : 'ชม.'}</span>
          </div>
        </div>
        <Field label={t('schedule.note')}>
          <textarea className="classlog-input" placeholder={t('schedule.notePlaceholder')} value={logNote} onChange={(e) => setLogNote(e.target.value)}/>
        </Field>
        <Field label={t('schedule.audioUrl')}>
          <Input type="url" placeholder={t('schedule.audioUrlPlaceholder')} value={logAudioUrl} onChange={(e) => setLogAudioUrl(e.target.value)}/>
        </Field>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button green style={{ flex: 1 }} onClick={() => submitLog('done')} disabled={logBusy}>
            {logBusy ? t('schedule.saving') : t('schedule.log')}
          </Button>
          <Button ghost onClick={() => setLogOpen(false)}>{t('schedule.cancel')}</Button>
        </div>
      </Modal>
      <Modal open={bulkOpen} onClose={() => setBulkOpen(false)} title={t('schedule.bulkClose')}>
        <p className="muted" style={{ marginBottom: 14, fontSize: 13.5 }}>{t('schedule.bulkHelp')}</p>
        <Field label={t('schedule.bulkFrom')}>
          <Input type="date" value={bulkFrom} onChange={(event) => setBulkFrom(event.target.value)}/>
        </Field>
        <Field label={t('schedule.bulkTo')}>
          <Input type="date" value={bulkTo} onChange={(event) => setBulkTo(event.target.value)}/>
        </Field>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button pink style={{ flex: 1 }} onClick={bulkClose} disabled={!bulkFrom || !bulkTo || slotBusy}>
            {t('schedule.bulkClose')}
          </Button>
          <Button ghost onClick={() => setBulkOpen(false)}>{t('schedule.cancel')}</Button>
        </div>
      </Modal>

      <Modal open={bookOpen} onClose={() => setBookOpen(false)} title={t('schedule.bookTitle')}>
        <Field label={t('schedule.pickStudent')} required>
          <select
            className="input"
            value={bookForm.studentId}
            onChange={(e) => setBookForm((current) => ({ ...current, studentId: e.target.value }))}
          >
            <option value="">{t('schedule.pickStudent')}</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name} · {student.left} {language === 'en' ? 'hrs left' : 'ชม. เหลือ'}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('schedule.pickTime')} required>
          <select
            className="input"
            value={bookForm.time}
            onChange={(e) => setBookForm((current) => ({ ...current, time: e.target.value }))}
          >
            <option value="">{t('schedule.pickTime')}</option>
            {openTimes.map((time) => <option key={time} value={time}>{time}</option>)}
          </select>
        </Field>
        <Field label={t('schedule.bookHours')} required>
          <Input
            type="number"
            min="1"
            max="10"
            value={bookForm.hours}
            onChange={(e) => setBookForm((current) => ({ ...current, hours: e.target.value }))}
          />
        </Field>
        <Field label={t('schedule.bookTopic')}>
          <Input value={bookForm.topic} onChange={(e) => setBookForm((current) => ({ ...current, topic: e.target.value }))}/>
        </Field>
        <Button pink style={{ width: '100%' }} onClick={submitBook} disabled={bookBusy}>
          {bookBusy ? t('schedule.booking') : t('schedule.bookSubmit')}
        </Button>
      </Modal>
    </>);
}
