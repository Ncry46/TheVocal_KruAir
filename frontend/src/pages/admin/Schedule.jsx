import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Field, Input, Modal, Spinner } from '@components/ui';
import { BellIcon, CheckIcon } from '@components/icons';
import { SignaturePreviewModal } from '@components/admin/SignaturePreviewModal';
import { daysInMonth as countDaysInMonth, filterSignaturesByDate, signatureYears as collectSignatureYears } from './signatureFilter';
import { api } from '@app/services/apiClient';
import { useApp } from '@app/context/AppContext';

const plus1 = (t) => String(Number(t.split(':')[0]) + 1).padStart(2, '0') + ':00';
const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TH_WEEKDAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const EN_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
    const { language, t, toast, user } = useApp();
    const navigate = useNavigate();
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
    const [checkInBusy, setCheckInBusy] = useState(false);
    const [slotBusy, setSlotBusy] = useState(false);
    const [addTime, setAddTime] = useState('');
    const [bulkOpen, setBulkOpen] = useState(false);
    const [bulkFrom, setBulkFrom] = useState('');
    const [bulkTo, setBulkTo] = useState('');
    const [bookOpen, setBookOpen] = useState(false);
    const [students, setStudents] = useState([]);
    const [bookForm, setBookForm] = useState({ studentIds: [], times: [], topic: '', startDraft: '', endDraft: '' });
    const [studentFilter, setStudentFilter] = useState('');
    const [bookBusy, setBookBusy] = useState(false);
    const [homeworkSubmissions, setHomeworkSubmissions] = useState([]);
    const [signatureRows, setSignatureRows] = useState({ pending: [], signed: [] });
    const [signatureBookingId, setSignatureBookingId] = useState(null);
    const [sigFilterYear, setSigFilterYear] = useState(String(today.getFullYear()));
    const [sigFilterMonth, setSigFilterMonth] = useState('');
    const [sigFilterDay, setSigFilterDay] = useState('');
    const [teachers, setTeachers] = useState([]);
    const [teacherFilter, setTeacherFilter] = useState('');
    const [moveOpen, setMoveOpen] = useState(false);
    const [moveDay, setMoveDay] = useState('');
    const [moveTime, setMoveTime] = useState('');
    const [moveBusy, setMoveBusy] = useState(false);

    const load = () => api.getTeacherSchedule(year, month + 1, user?.role === 'admin' ? teacherFilter : '').then(setWeek);

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
    }, [language, year, month, teacherFilter]);

    useEffect(() => {
        if (user?.role !== 'admin') {
            return;
        }
        api.getTeachers().then((rows) => {
            setTeachers(rows);
            if (rows.length && !teacherFilter) {
                setTeacherFilter(String(rows[0].id));
            }
        }).catch(() => setTeachers([]));
    }, [language, user?.role]);

    const loadSignatures = () => api.getTeacherSignatures()
        .then(setSignatureRows)
        .catch(() => setSignatureRows({ pending: [], signed: [] }));

    useEffect(() => {
        api.getTeacherHomeworkSubmissions()
            .then(setHomeworkSubmissions)
            .catch(() => setHomeworkSubmissions([]));
        loadSignatures();
    }, [language]);

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

    const calendarDayCount = new Date(year, month + 1, 0).getDate();
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
    const displayRows = useMemo(() => {
        const rows = dayLessons.map((lesson) => ({
            key: `lesson-${lesson.bookingId}`,
            kind: 'lesson',
            lesson,
            time: lesson.time,
            timeRange: lesson.timeRange,
        }));
        for (const slot of daySlots) {
            const hasLesson = dayLessons.some((lesson) => lesson.slotId === slot.id || lesson.time === slot.time);
            if (!hasLesson) {
                rows.push({
                    key: `slot-${slot.id}`,
                    kind: 'slot',
                    slot,
                    time: slot.time,
                    timeRange: `${slot.time}–${plus1(slot.time)}${language === 'en' ? '' : ' น.'}`,
                });
            }
        }
        return rows.sort((a, b) => String(a.time).localeCompare(String(b.time)));
    }, [dayLessons, daySlots, language]);
    const hourGroups = useMemo(() => {
        const map = new Map();
        for (const row of displayRows) {
            if (!map.has(row.time)) {
                map.set(row.time, {
                    time: row.time,
                    timeRange: row.timeRange,
                    lessons: [],
                    slot: null,
                });
            }
            const group = map.get(row.time);
            if (row.kind === 'lesson') {
                group.lessons.push(row.lesson);
                group.timeRange = row.timeRange || group.timeRange;
            }
            else {
                group.slot = row.slot;
            }
        }
        return Array.from(map.values());
    }, [displayRows]);
    const unusedTimes = slotTimes.filter((time) => !daySlots.some((slot) => slot.time === time));
    const openTimes = slotTimes.filter((time) => {
        const slot = daySlots.find((item) => item.time === time);
        return !slot || slot.status === 'open' || slot.status === 'booked';
    });
    const toggleSlots = useMemo(
        () => daySlots.filter((slot) => slot.status === 'open' || slot.status === 'closed'),
        [daySlots],
    );

    const signatureYearOptions = useMemo(
        () => collectSignatureYears([...signatureRows.pending, ...signatureRows.signed], today.getFullYear()),
        [signatureRows, today],
    );
    const signatureFilter = useMemo(() => ({
        year: sigFilterYear,
        month: sigFilterMonth,
        day: sigFilterDay,
    }), [sigFilterYear, sigFilterMonth, sigFilterDay]);
    const filteredPendingSignatures = useMemo(
        () => filterSignaturesByDate(signatureRows.pending, signatureFilter),
        [signatureRows.pending, signatureFilter],
    );
    const filteredSignedSignatures = useMemo(
        () => filterSignaturesByDate(signatureRows.signed, signatureFilter),
        [signatureRows.signed, signatureFilter],
    );
    const signatureDayOptions = useMemo(() => {
        if (!sigFilterYear || !sigFilterMonth) {
            return [];
        }
        return Array.from({ length: countDaysInMonth(sigFilterYear, sigFilterMonth) }, (_, index) => String(index + 1));
    }, [sigFilterYear, sigFilterMonth]);
    const monthLabels = language === 'en' ? EN_MONTHS : TH_MONTHS;
    const resetSignatureFilter = () => {
        setSigFilterYear(String(today.getFullYear()));
        setSigFilterMonth('');
        setSigFilterDay('');
    };
    const onSignatureMonthChange = (value) => {
        setSigFilterMonth(value);
        setSigFilterDay('');
    };
    const onSignatureYearChange = (value) => {
        setSigFilterYear(value);
        setSigFilterDay('');
    };

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
            await Promise.all([load(), loadSignatures()]);
        }
        catch (err) {
            toast(err instanceof Error ? err.message : t('schedule.logFailed'));
        }
        finally {
            setLogBusy(false);
        }
    };

    const submitCheckIn = async () => {
        if (!selectedLesson?.bookingId || checkInBusy) {
            return;
        }
        setCheckInBusy(true);
        try {
            await api.teacherCheckIn(selectedLesson.bookingId);
            toast(t('schedule.checkInOk'), 'ok');
            await load();
        }
        catch (err) {
            toast(err instanceof Error ? err.message : t('schedule.checkInFailed'));
        }
        finally {
            setCheckInBusy(false);
        }
    };

    const setSlot = async (slot, action) => {
        if (!slot?.id || slotBusy) {
            return;
        }
        if (action === 'close' && (slot.status === 'booked' || dayLessons.some((lesson) => lesson.slotId === slot.id || lesson.time === slot.time))) {
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
        setBookForm({ studentIds: [], times: [], topic: '', startDraft: '', endDraft: '' });
        setStudentFilter('');
        setBookOpen(true);
        try {
            const rows = await api.getStudents();
            setStudents(rows);
        }
        catch {
            setStudents([]);
        }
    };

    const toggleBookStudent = (studentId) => {
        const id = String(studentId);
        setBookForm((current) => {
            const selected = current.studentIds.includes(id)
                ? current.studentIds.filter((item) => item !== id)
                : [...current.studentIds, id];
            return { ...current, studentIds: selected };
        });
    };

    const toggleBookTime = (time) => {
        setBookForm((current) => {
            const selected = current.times.includes(time)
                ? current.times.filter((item) => item !== time)
                : [...current.times, time];
            return { ...current, times: selected };
        });
    };

    const setTimeDraft = (field, value) => {
        setBookForm((current) => ({ ...current, [field]: digitsTimeMask(value) }));
    };

    const applyTimeRangeFromDrafts = (startDraft, endDraft, currentTimes) => {
        const startRaw = finalizeTimeMask(startDraft);
        const endRaw = finalizeTimeMask(endDraft);
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
        if (range.every((time) => daySlots.some((slot) => slot.time === time && slot.status === 'closed'))) {
            return { startDraft: start, endDraft: end, times: currentTimes, toast: 'timeClosed' };
        }
        const openRange = range.filter((time) => !daySlots.some((slot) => slot.time === time && slot.status === 'closed'));
        return {
            startDraft: start,
            endDraft: end,
            times: [...new Set([...currentTimes, ...openRange])],
            toast: null,
        };
    };

    const blurTimeDraft = (field) => {
        const drafted = {
            ...bookForm,
            [field]: finalizeTimeMask(bookForm[field]),
        };
        const next = applyTimeRangeFromDrafts(drafted.startDraft, drafted.endDraft, drafted.times);
        setBookForm({
            ...drafted,
            startDraft: next.startDraft,
            endDraft: next.endDraft,
            times: next.times,
        });
        if (next.toast === 'needStartEnd') {
            toast(t('schedule.needStartEnd'));
        }
        else if (next.toast === 'badTime') {
            toast(t('schedule.badTime'));
        }
        else if (next.toast === 'endAfterStart') {
            toast(t('schedule.endAfterStart'));
        }
        else if (next.toast === 'timeClosed') {
            toast(t('schedule.timeClosed'));
        }
    };

    const bookBlocks = useMemo(
        () => groupConsecutiveTimes(bookForm.times, slotTimes),
        [bookForm.times, slotTimes],
    );
    const bookHoursTotal = bookBlocks.reduce((sum, block) => sum + block.hours, 0);

    const submitBook = async () => {
        if (!bookForm.studentIds.length || !bookBlocks.length) {
            toast(t('schedule.needStudent'));
            return;
        }
        for (const block of bookBlocks) {
            const closed = daySlots.some((slot) => slot.time === block.start && slot.status === 'closed');
            if (closed) {
                toast(t('schedule.timeClosed'));
                return;
            }
        }
        setBookBusy(true);
        try {
            let createdCount = 0;
            const failed = [];
            const noLineNames = [];
            for (const block of bookBlocks) {
                const result = await api.createTeacherBooking({
                    studentIds: bookForm.studentIds.map((id) => Number(id)),
                    day: selectedIso,
                    time: block.start,
                    hours: block.hours,
                    topic: bookForm.topic.trim() || undefined,
                });
                createdCount += result?.created?.length || 0;
                if (result?.failed?.length) {
                    failed.push(...result.failed);
                }
                for (const row of result?.created || []) {
                    if (row.lineLinked === false && row.name) {
                        noLineNames.push(row.name);
                    }
                }
            }
            if (failed.length) {
                const names = [...new Set(failed.map((row) => row.name))].join(', ');
                toast(
                    t('schedule.bookPartial')
                        .replace('{ok}', String(createdCount))
                        .replace('{fail}', String(failed.length))
                        .replace('{names}', names),
                    'ok',
                );
            }
            else {
                toast(
                    createdCount > 1
                        ? t('schedule.bookOkMany').replace('{n}', String(createdCount))
                        : t('schedule.bookOk'),
                    'ok',
                );
            }
            const uniqueNoLine = [...new Set(noLineNames)];
            if (uniqueNoLine.length) {
                toast(
                    t('schedule.bookNoLine').replace('{names}', uniqueNoLine.join(', ')),
                );
            }
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

    const submitMove = async () => {
        if (!selectedLesson?.bookingId || !moveDay || !moveTime) {
            toast(language === 'en' ? 'Pick a new date and time' : 'เลือกวันและเวลาใหม่');
            return;
        }
        setMoveBusy(true);
        try {
            await api.rescheduleTeacherLesson(selectedLesson.bookingId, moveDay, moveTime);
            toast(language === 'en' ? 'Lesson rescheduled' : 'เลื่อนนัดแล้ว', 'ok');
            setMoveOpen(false);
            await load();
        }
        catch (err) {
            toast(err instanceof Error ? err.message : (language === 'en' ? 'Could not reschedule' : 'เลื่อนนัดไม่สำเร็จ'));
        }
        finally {
            setMoveBusy(false);
        }
    };

    if (!week) {
        return <Spinner />;
    }

    return (<>
      <div className="alertbar">
        <BellIcon width={16} height={16}/> <b>{week.pendingCount} {t('schedule.pending')}</b>
        {user?.role === 'admin' && teachers.length > 1 && (
          <select className="input" style={{ width: 'auto', minWidth: 180, marginLeft: 12 }} value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)}>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>{teacher.nickname} · {teacher.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="sched-layout">
        <Card className="sched-cal-card">
          <div className="sched-cal">
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
            {Array.from({ length: calendarDayCount }).map((_, index) => {
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
          <div className="dp-actions sched-cal-actions">
            <Button ghost onClick={() => { setBulkFrom(selectedIso); setBulkTo(selectedIso); setBulkOpen(true); }}>
              {t('schedule.bulkClose')}
            </Button>
          </div>
          </div>
        </Card>

        <Card
          className="sched-day-card"
          title={selectedIso ? formatLongDate(selectedIso, language) : t('schedule.pickDay')}
          action={<Button pink size="sm" onClick={openBookModal}>{t('schedule.bookStudent')}</Button>}
        >
          <div className="sched-day-body">
          {hourGroups.length === 0 ? (
            <div className="empty">{t('schedule.emptySlots')}</div>
          ) : (
            <div className="sched-list">
              {hourGroups.map((group) => (
                <section key={group.time} className="sched-hour">
                  <div className="sched-hour-label">{group.timeRange}</div>
                  <div className="sched-hour-rows">
                    {group.lessons.map((lesson) => {
                      const active = selectedLesson?.bookingId === lesson.bookingId;
                      return (
                        <button
                          key={lesson.bookingId}
                          type="button"
                          className={`sched-lesson student${active ? ' on' : ''}`}
                          onClick={() => setSelectedLesson(lesson)}
                        >
                          <div className="sched-meta">
                            <b>{`${lesson.student}${lesson.hours > 1 ? ` · ${lesson.hours} ${language === 'en' ? 'hrs' : 'ชม.'}` : ''}`}</b>
                            <span>{lesson.lesson}</span>
                          </div>
                          <span className={`dp-badge ${lesson.status || 'pending'}`}>
                            {lesson.status === 'confirmed' || lesson.status === 'done'
                                ? (lesson.status === 'done' ? t('schedule.done') : t('schedule.confirmed'))
                                : t('schedule.awaiting')}
                          </span>
                        </button>
                      );
                    })}
                    {group.lessons.length === 0 && group.slot && (
                      <button
                        type="button"
                        className={`sched-lesson empty-slot ${group.slot.status}`}
                        onClick={() => setSelectedLesson(null)}
                      >
                        <div className="sched-meta">
                          <b>{group.slot.status === 'closed' ? t('schedule.slotClosed') : t('schedule.slotOpen')}</b>
                          <span>{t('schedule.noStudent')}</span>
                        </div>
                        <span className={`dp-badge ${group.slot.status}`}>
                          {group.slot.status === 'closed' ? t('schedule.closed') : t('schedule.open')}
                        </span>
                      </button>
                    )}
                  </div>
                </section>
              ))}
            </div>
          )}

          {selectedLesson && (
            <div className="sched-detail">
              <div className="sched-detail-head">
                <div>
                  <div className="sched-detail-name">{selectedLesson.student}</div>
                  <div className="muted sched-detail-sub">
                    {selectedLesson.timeRange || selectedLesson.time} · {selectedLesson.lesson}
                  </div>
                </div>
              </div>
              <div className="sched-detail-chips">
                <span className={`badge ${selectedLesson.studentCheckedIn ? 'green' : 'amber'}`}>
                  {selectedLesson.studentCheckedIn ? t('schedule.studentCheckedIn') : t('schedule.studentNotCheckedIn')}
                </span>
                <span className={`badge ${selectedLesson.studentSigned ? 'green' : 'amber'}`}>
                  {selectedLesson.studentSigned ? t('schedule.studentSigned') : t('schedule.studentUnsigned')}
                </span>
                <span className={`badge ${selectedLesson.teacherCheckedIn ? 'green' : 'amber'}`}>
                  {selectedLesson.teacherCheckedIn ? t('schedule.teacherCheckedIn') : t('schedule.teacherNotCheckedIn')}
                </span>
              </div>
              <div className="sched-detail-actions">
                {selectedLesson.canCheckIn && (
                  <Button green size="sm" onClick={submitCheckIn} disabled={checkInBusy}>
                    {checkInBusy ? t('schedule.checkingIn') : t('schedule.checkIn')}
                  </Button>
                )}
                {selectedLesson.status === 'confirmed' || selectedLesson.status === 'done' ? (
                  <>
                    <Button green size="sm" onClick={() => { setLogNote(''); setLogAudioUrl(''); setLogOpen(true); }}>
                      <CheckIcon width={14} height={14}/> {t('schedule.log')}
                    </Button>
                    {selectedLesson.status !== 'done' && (
                      <Button danger size="sm" onClick={() => submitLog('no_show')} disabled={logBusy}>
                        {t('schedule.noShow')}
                      </Button>
                    )}
                  </>
                ) : (
                  <Button ghost size="sm" onClick={remind} disabled={slotBusy}>
                    {t('schedule.remind')}
                  </Button>
                )}
                <Button ghost size="sm" onClick={() => { setMoveDay(selectedIso); setMoveTime(selectedLesson.time); setMoveOpen(true); }} disabled={slotBusy}>
                  {language === 'en' ? 'Reschedule' : 'เลื่อนนัด'}
                </Button>
                {selectedLesson.status !== 'done' && (
                  <Button danger size="sm" onClick={cancelLesson} disabled={slotBusy}>{t('schedule.cancelLesson')}</Button>
                )}
              </div>
            </div>
          )}

          <div className="sched-day-footer">
            <div className="slot-add">
              <select className="input" value={addTime} onChange={(event) => setAddTime(event.target.value)}>
                <option value="">{t('schedule.pickTime')}</option>
                {unusedTimes.map((time) => <option key={time} value={time}>{time}</option>)}
              </select>
              <Button ghost size="sm" onClick={addSlot} disabled={!addTime || slotBusy}>{t('schedule.addSlot')}</Button>
            </div>
            {toggleSlots.length > 0 && (
              <div className="slot-toggles">
                {toggleSlots.map((slot) => (
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
          </div>
          </div>
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
        <Field label={t('schedule.pickStudents')} required>
          <Input
            value={studentFilter}
            onChange={(e) => setStudentFilter(e.target.value)}
            placeholder={t('schedule.searchStudent')}
          />
          <div className="book-student-list">
            {students
              .filter((student) => {
                  const q = studentFilter.trim().toLowerCase();
                  if (!q) {
                      return true;
                  }
                  const hay = `${student.name || ''} ${student.nickname || ''}`.toLowerCase();
                  return hay.includes(q);
              })
              .map((student) => {
                  const id = String(student.id);
                  const checked = bookForm.studentIds.includes(id);
                  return (
                    <label key={student.id} className={`book-student-row${checked ? ' on' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleBookStudent(student.id)}
                      />
                      <span className="book-student-name">{student.name || student.nickname}</span>
                      <span className="muted book-student-hours">
                        {student.left} {language === 'en' ? 'hrs left' : 'ชม. เหลือ'}
                      </span>
                    </label>
                  );
              })}
            {students.length === 0 && (
              <div className="empty" style={{ padding: 12 }}>{t('schedule.noStudents')}</div>
            )}
          </div>
          {bookForm.studentIds.length > 0 && (
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              {t('schedule.selectedCount').replace('{n}', String(bookForm.studentIds.length))}
            </div>
          )}
        </Field>
        <Field label={t('schedule.pickTimes')} required>
          <div className="time-slots-grid book-time-grid">
            {slotTimes.map((time) => {
              const closed = daySlots.some((slot) => slot.time === time && slot.status === 'closed');
              const selected = bookForm.times.includes(time);
              return (
                <button
                  key={time}
                  type="button"
                  disabled={closed}
                  className={`time-slot${selected ? ' on' : ''}${closed ? ' full' : ''}`}
                  onClick={() => toggleBookTime(time)}
                >
                  <span className="ts-time">{time}</span>
                  <span className="ts-end">–{plus1(time)}</span>
                  {closed && <span className="ts-full">{t('schedule.closed')}</span>}
                  {selected && !closed && <span className="ts-full">{t('schedule.timePicked')}</span>}
                </button>
              );
            })}
          </div>
          <div className="book-time-type book-time-range">
            <label className="book-time-field">
              <span className="book-time-type-label">{t('schedule.timeStart')}</span>
              <Input
                className="input book-time-input"
                inputMode="numeric"
                pattern="[0-9:]*"
                value={bookForm.startDraft}
                placeholder={t('schedule.timeStartPlaceholder')}
                onChange={(e) => setTimeDraft('startDraft', e.target.value)}
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
              <span className="book-time-type-label">{t('schedule.timeEnd')}</span>
              <Input
                className="input book-time-input"
                inputMode="numeric"
                pattern="[0-9:]*"
                value={bookForm.endDraft}
                placeholder={t('schedule.timeEndPlaceholder')}
                onChange={(e) => setTimeDraft('endDraft', e.target.value)}
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
          <div className="muted book-time-hint">{t('schedule.timeRangeHint')}</div>
          {bookBlocks.length > 0 ? (
            <div className="book-time-summary">
              {t('schedule.timeSummary')
                  .replace('{hours}', String(bookHoursTotal))
                  .replace('{ranges}', formatTimeBlocks(bookBlocks))}
            </div>
          ) : (
            <div className="muted book-time-hint">{t('schedule.timeHint')}</div>
          )}
        </Field>
        <Field label={t('schedule.bookTopic')}>
          <Input value={bookForm.topic} onChange={(e) => setBookForm((current) => ({ ...current, topic: e.target.value }))}/>
        </Field>
        <Button pink style={{ width: '100%' }} onClick={submitBook} disabled={bookBusy}>
          {bookBusy ? t('schedule.booking') : t('schedule.bookSubmit')}
        </Button>
      </Modal>

      <Modal open={moveOpen} onClose={() => setMoveOpen(false)} title={language === 'en' ? 'Reschedule lesson' : 'เลื่อนนัดเรียน'}>
        <Field label={language === 'en' ? 'New date' : 'วันใหม่'} required>
          <Input type="date" value={moveDay} onChange={(e) => setMoveDay(e.target.value)}/>
        </Field>
        <Field label={language === 'en' ? 'New time' : 'เวลาใหม่'} required>
          <select className="input" value={moveTime} onChange={(e) => setMoveTime(e.target.value)}>
            <option value="">{language === 'en' ? 'Select time' : 'เลือกเวลา'}</option>
            {(week.slotTimes || []).map((time) => <option key={time} value={time}>{time}</option>)}
          </select>
        </Field>
        <Button pink style={{ width: '100%' }} disabled={moveBusy} onClick={submitMove}>
          {moveBusy ? (language === 'en' ? 'Saving…' : 'กำลังบันทึก…') : (language === 'en' ? 'Confirm reschedule' : 'ยืนยันเลื่อนนัด')}
        </Button>
      </Modal>

      {homeworkSubmissions.length > 0 && (
        <Card title={language === 'en' ? 'Student homework audio' : 'เสียงการบ้านจากนักเรียน'} style={{ marginTop: 16 }}>
          {homeworkSubmissions.slice(0, 8).map((row) => (
            <div key={row.id} className="toggle-row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{row.student} · {row.date}</div>
              <div className="muted" style={{ fontSize: 12 }}>{row.lesson}</div>
              <a href={row.audioUrl} target="_blank" rel="noreferrer" className="link" style={{ fontSize: 12 }}>
                {language === 'en' ? 'Listen' : 'ฟังเสียง'}
              </a>
            </div>
          ))}
        </Card>
      )}

      <Card
        className="sched-signatures"
        title={t('teacherSignature.title')}
        action={filteredPendingSignatures.length > 0
            ? <span className="badge amber">{filteredPendingSignatures.length} {t('teacherSignature.pending')}</span>
            : <span className="badge green">{t('teacherSignature.nonePending')}</span>}
      >
        <div className="signature-filter-row">
          <label className="signature-filter-field">
            <span className="muted">{t('teacherSignature.filterYear')}</span>
            <select className="input" value={sigFilterYear} onChange={(e) => onSignatureYearChange(e.target.value)}>
              {signatureYearOptions.map((item) => (
                <option key={item} value={item}>{language === 'en' ? item : Number(item) + 543}</option>
              ))}
            </select>
          </label>
          <label className="signature-filter-field">
            <span className="muted">{t('teacherSignature.filterMonth')}</span>
            <select className="input" value={sigFilterMonth} onChange={(e) => onSignatureMonthChange(e.target.value)}>
              <option value="">{t('teacherSignature.allMonths')}</option>
              {monthLabels.map((label, index) => (
                <option key={label} value={String(index + 1)}>{label}</option>
              ))}
            </select>
          </label>
          <label className="signature-filter-field">
            <span className="muted">{t('teacherSignature.filterDay')}</span>
            <select
              className="input"
              value={sigFilterDay}
              disabled={!sigFilterMonth}
              onChange={(e) => setSigFilterDay(e.target.value)}
            >
              <option value="">{t('teacherSignature.allDays')}</option>
              {signatureDayOptions.map((day) => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
          </label>
          <Button ghost size="sm" type="button" onClick={resetSignatureFilter}>{t('teacherSignature.resetFilter')}</Button>
        </div>

        {filteredPendingSignatures.length === 0 && filteredSignedSignatures.length === 0 ? (
          <div className="empty">{t('teacherSignature.noResults')}</div>
        ) : (
          <>
            {filteredPendingSignatures.map((row) => (
              <div key={row.bookingId} className="toggle-row">
                <div>
                  <div style={{ fontWeight: 600 }}>{row.student} · {row.date} · {row.time}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{row.lesson}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="badge amber">{t('teacherSignature.pending')}</span>
                  <Button ghost size="sm" onClick={() => navigate(`/teacher/students/${row.studentId}`)}>
                    {language === 'en' ? 'Profile' : 'โปรไฟล์'}
                  </Button>
                </div>
              </div>
            ))}
            {filteredSignedSignatures.map((row) => (
              <div key={row.bookingId} className="toggle-row">
                <div>
                  <div style={{ fontWeight: 600 }}>{row.student} · {row.date} · {row.time}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{row.lesson}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="badge green">{t('teacherSignature.signed')}</span>
                  <Button ghost size="sm" onClick={() => setSignatureBookingId(row.bookingId)}>
                    {t('teacherSignature.view')}
                  </Button>
                </div>
              </div>
            ))}
          </>
        )}
      </Card>

      <SignaturePreviewModal
        open={Boolean(signatureBookingId)}
        onClose={() => setSignatureBookingId(null)}
        bookingId={signatureBookingId}
        language={language}
      />
    </>);
}
