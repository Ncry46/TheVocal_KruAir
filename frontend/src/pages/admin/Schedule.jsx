import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Field, Modal, Spinner } from '@components/ui';
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
    const [logBusy, setLogBusy] = useState(false);

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
    const dayLessons = useMemo(() => lessonsByDate[selectedIso] ?? [], [lessonsByDate, selectedIso]);

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
            await api.recordLesson(selectedLesson.bookingId, outcome, logNote);
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
                const isToday = iso === todayIso;
                const isSelected = iso === selectedIso;
                return (
                  <button
                    key={iso}
                    type="button"
                    className={`cal-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${count > 0 ? 'available' : ''}`}
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
          </div>
        </Card>

        <Card title={selectedIso ? formatLongDate(selectedIso, language) : t('schedule.pickDay')}>
          {dayLessons.length === 0 ? (
            <div className="empty">{t('schedule.emptyDay')}</div>
          ) : (
            <div className="sched-list">
              {dayLessons.map((lesson) => {
                  const active = selectedLesson?.bookingId === lesson.bookingId;
                  return (
                    <button
                      key={lesson.bookingId}
                      type="button"
                      className={`sched-lesson ${lesson.status} ${active ? 'on' : ''}`}
                      onClick={() => setSelectedLesson(lesson)}
                    >
                      <div className="sched-time">{lesson.time}–{plus1(lesson.time)}</div>
                      <div className="sched-meta">
                        <b>{lesson.student}</b>
                        <span>{lesson.lesson}</span>
                      </div>
                      <span className={`dp-badge ${lesson.status}`}>
                        {lesson.status === 'confirmed' ? t('schedule.confirmed') : t('schedule.awaiting')}
                      </span>
                    </button>
                  );
              })}
            </div>
          )}

          {selectedLesson && (
            <div className="dp-actions" style={{ marginTop: 16 }}>
              {selectedLesson.status === 'confirmed' ? (<>
                  <Button green onClick={() => { setLogNote(''); setLogOpen(true); }}>
                    <CheckIcon width={14} height={14}/> {t('schedule.log')}
                  </Button>
                  <Button danger onClick={() => submitLog('no_show')} disabled={logBusy}>
                    {t('schedule.noShow')}
                  </Button>
                </>) : (
                <Button ghost onClick={() => toast(t('schedule.reminded'), 'ok')}>
                  {t('schedule.remind')}
                </Button>
              )}
            </div>
          )}
        </Card>
      </div>

      <Modal open={logOpen} onClose={() => setLogOpen(false)} title={t('schedule.log')}>
        <div style={{ marginBottom: 16 }}>
          <div className="sumrow">
            <span className="muted">{t('schedule.when')}</span>
            <b>{selectedIso ? formatLongDate(selectedIso, language) : ''} {selectedLesson?.time}–{selectedLesson ? plus1(selectedLesson.time) : ''}</b>
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
            <span className="disc">−1 {language === 'en' ? 'hr' : 'ชม.'}</span>
          </div>
        </div>
        <Field label={t('schedule.note')}>
          <textarea className="classlog-input" placeholder={t('schedule.notePlaceholder')} value={logNote} onChange={(e) => setLogNote(e.target.value)}/>
        </Field>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button green style={{ flex: 1 }} onClick={() => submitLog('done')} disabled={logBusy}>
            {logBusy ? t('schedule.saving') : t('schedule.log')}
          </Button>
          <Button ghost onClick={() => setLogOpen(false)}>{t('schedule.cancel')}</Button>
        </div>
      </Modal>
    </>);
}
