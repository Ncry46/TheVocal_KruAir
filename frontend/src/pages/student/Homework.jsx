import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Spinner } from '@components/ui';
import { api } from '@app/services/apiClient';
import { useApp } from '@app/context/AppContext';
import { daysInMonth, filterSignaturesByDate, signatureYears } from '../admin/signatureFilter.js';

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function SignaturePad({ clearLabel, onChange, hint }) {
    const canvasRef = useRef(null);
    const wrapRef = useRef(null);
    const drawing = useRef(false);
    const last = useRef(null);

    const paintBlank = (canvas) => {
        const ctx = canvas.getContext('2d');
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const width = canvas.width / dpr;
        const height = canvas.height / dpr;
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.restore();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    };

    const syncCanvasSize = () => {
        const canvas = canvasRef.current;
        const wrap = wrapRef.current;
        if (!canvas || !wrap) {
            return;
        }
        const cssWidth = Math.min(wrap.clientWidth || 320, 360);
        const cssHeight = 140;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${cssHeight}px`;
        canvas.width = Math.round(cssWidth * dpr);
        canvas.height = Math.round(cssHeight * dpr);
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        paintBlank(canvas);
        onChange('');
    };

    useEffect(() => {
        syncCanvasSize();
        const onResize = () => {
            const hadInk = Boolean(canvasRef.current?.dataset.hasInk === '1');
            if (!hadInk) {
                syncCanvasSize();
            }
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const pos = (event) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const point = event.touches ? event.touches[0] : event;
        return {
            x: point.clientX - rect.left,
            y: point.clientY - rect.top,
        };
    };

    const start = (event) => {
        drawing.current = true;
        last.current = pos(event);
        event.preventDefault();
    };

    const move = (event) => {
        if (!drawing.current) {
            return;
        }
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const next = pos(event);
        const prev = last.current || next;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(next.x, next.y);
        ctx.stroke();
        last.current = next;
        canvas.dataset.hasInk = '1';
        onChange(canvas.toDataURL('image/png'));
        event.preventDefault();
    };

    const end = () => {
        drawing.current = false;
        last.current = null;
    };

    const clear = () => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }
        paintBlank(canvas);
        canvas.dataset.hasInk = '0';
        onChange('');
    };

    return (
      <div className="signature-pad" ref={wrapRef}>
        {hint && <div className="signature-pad-hint muted">{hint}</div>}
        <div className="signature-pad-frame">
          <canvas
            ref={canvasRef}
            className="signature-canvas"
            onMouseDown={start}
            onMouseMove={move}
            onMouseUp={end}
            onMouseLeave={end}
            onTouchStart={start}
            onTouchMove={move}
            onTouchEnd={end}
          />
          <div className="signature-pad-line" aria-hidden="true"/>
        </div>
        <Button ghost size="sm" type="button" onClick={clear}>
          {clearLabel}
        </Button>
      </div>
    );
}

function HomeworkAudioUpload({ itemId, existingUrl, t, toast, onUploaded }) {
    const [recording, setRecording] = useState(false);
    const [previewUrl, setPreviewUrl] = useState('');
    const [busy, setBusy] = useState(false);
    const mediaRef = useRef(null);
    const chunksRef = useRef([]);

    useEffect(() => () => {
        mediaRef.current?.stream.getTracks().forEach((track) => track.stop());
    }, []);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            chunksRef.current = [];
            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };
            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
                setPreviewUrl(URL.createObjectURL(blob));
                stream.getTracks().forEach((track) => track.stop());
            };
            mediaRef.current = recorder;
            recorder.start();
            setRecording(true);
        }
        catch {
            toast(t('homework.micDenied'));
        }
    };

    const stopRecording = () => {
        mediaRef.current?.stop();
        setRecording(false);
    };

    const upload = async () => {
        if (!previewUrl) {
            return;
        }
        setBusy(true);
        try {
            const response = await fetch(previewUrl);
            const blob = await response.blob();
            const dataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result));
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            await api.uploadHomeworkAudio(itemId, dataUrl);
            toast(t('homework.uploaded'), 'ok');
            setPreviewUrl('');
            await onUploaded();
        }
        catch (err) {
            toast(err instanceof Error ? err.message : t('homework.uploadFailed'));
        }
        finally {
            setBusy(false);
        }
    };

    const onFile = async (event) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        setBusy(true);
        try {
            const dataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result));
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            await api.uploadHomeworkAudio(itemId, dataUrl);
            toast(t('homework.uploaded'), 'ok');
            await onUploaded();
        }
        catch (err) {
            toast(err instanceof Error ? err.message : t('homework.uploadFailed'));
        }
        finally {
            setBusy(false);
            event.target.value = '';
        }
    };

    return (
      <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
        {existingUrl && (
          <a href={existingUrl} target="_blank" rel="noreferrer" className="link" style={{ fontSize: 12 }}>
            {t('homework.studentAudio')}
          </a>
        )}
        {!existingUrl && (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {!recording ? (
                <Button ghost size="sm" onClick={startRecording}>{t('homework.uploadAudio')}</Button>
              ) : (
                <Button ghost size="sm" onClick={stopRecording}>{t('homework.stopRecording')}</Button>
              )}
              <label className="btn ghost sm" style={{ cursor: 'pointer' }}>
                {t('homework.chooseFile')}
                <input type="file" accept="audio/*" hidden onChange={onFile}/>
              </label>
            </div>
            {previewUrl && (
              <>
                <audio controls src={previewUrl} style={{ width: '100%' }}/>
                <Button pink size="sm" disabled={busy} onClick={upload}>
                  {busy ? t('homework.uploading') : t('homework.upload')}
                </Button>
              </>
            )}
          </>
        )}
      </div>
    );
}

export default function Homework() {
    const { language, t, toast } = useApp();
    const navigate = useNavigate();
    const [items, setItems] = useState(null);
    const [pendingSign, setPendingSign] = useState([]);
    const [signatures, setSignatures] = useState({});
    const [busyId, setBusyId] = useState('');
    const todayParts = useMemo(() => {
        const iso = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
        const [year, month, day] = iso.split('-');
        return {
            iso,
            year,
            month: String(Number(month)),
            day: String(Number(day)),
        };
    }, []);
    const [filterYear, setFilterYear] = useState(todayParts.year);
    const [filterMonth, setFilterMonth] = useState(todayParts.month);
    const [filterDay, setFilterDay] = useState(todayParts.day);

    const load = async () => {
        const [homework, signRows] = await Promise.all([
            api.getHomework(),
            api.getPendingSignatures(),
        ]);
        setItems(homework);
        setPendingSign(signRows);
    };

    useEffect(() => {
        load().catch(() => setItems([]));
    }, [language]);

    const yearOptions = useMemo(
        () => signatureYears(pendingSign, Number(todayParts.year)),
        [pendingSign, todayParts.year],
    );
    const dateFilter = useMemo(
        () => ({ year: filterYear, month: filterMonth, day: filterDay }),
        [filterYear, filterMonth, filterDay],
    );
    const filteredPending = useMemo(
        () => filterSignaturesByDate(pendingSign, dateFilter),
        [pendingSign, dateFilter],
    );
    const dayOptions = useMemo(() => {
        if (!filterYear || !filterMonth) {
            return [];
        }
        return Array.from({ length: daysInMonth(filterYear, filterMonth) }, (_, index) => String(index + 1));
    }, [filterYear, filterMonth]);
    const monthLabels = language === 'en' ? EN_MONTHS : TH_MONTHS;

    const resetFilter = () => {
        setFilterYear(todayParts.year);
        setFilterMonth(todayParts.month);
        setFilterDay(todayParts.day);
    };

    const submitSign = async (bookingId) => {
        const data = signatures[bookingId];
        if (!data) {
            toast(t('signature.needSign'));
            return;
        }
        setBusyId(bookingId);
        try {
            const result = await api.signLesson(bookingId, data);
            toast(result?.hoursDeducted ? t('signature.saved') : (language === 'en' ? 'Signature saved' : 'บันทึกลายเซ็นแล้ว'), 'ok');
            await load();
        }
        catch (err) {
            toast(err instanceof Error ? err.message : t('signature.failed'));
        }
        finally {
            setBusyId('');
        }
    };

    if (!items) {
        return <Spinner />;
    }

    const showSignatureCard = pendingSign.length > 0;

    return (
      <div className="grid" style={{ gap: 16 }}>
        {showSignatureCard && (
          <Card title={t('signature.title')} action={<span className="badge amber">{filteredPending.length}</span>}>
            <div className="signature-filter-row">
              <label className="signature-filter-field">
                <span className="muted">{t('signature.filterYear')}</span>
                <select
                  className="input sales-filter"
                  value={filterYear}
                  onChange={(e) => {
                      setFilterYear(e.target.value);
                      setFilterDay('');
                  }}
                >
                  {yearOptions.map((item) => (
                    <option key={item} value={item}>{language === 'en' ? item : Number(item) + 543}</option>
                  ))}
                </select>
              </label>
              <label className="signature-filter-field">
                <span className="muted">{t('signature.filterMonth')}</span>
                <select
                  className="input sales-filter"
                  value={filterMonth}
                  onChange={(e) => {
                      const nextMonth = e.target.value;
                      setFilterMonth(nextMonth);
                      if (!nextMonth) {
                          setFilterDay('');
                          return;
                      }
                      const isTodayMonth = nextMonth === todayParts.month && filterYear === todayParts.year;
                      setFilterDay(isTodayMonth ? todayParts.day : '1');
                  }}
                >
                  <option value="">{t('signature.allMonths')}</option>
                  {monthLabels.map((label, index) => (
                    <option key={label} value={String(index + 1)}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="signature-filter-field">
                <span className="muted">{t('signature.filterDay')}</span>
                <select
                  className="input sales-filter"
                  value={filterDay}
                  disabled={!filterMonth}
                  onChange={(e) => setFilterDay(e.target.value)}
                >
                  <option value="">{t('signature.allDays')}</option>
                  {dayOptions.map((day) => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </label>
              <Button ghost size="sm" type="button" onClick={resetFilter}>{t('signature.resetFilter')}</Button>
            </div>

            {filteredPending.length === 0 ? (
              <div className="empty">{t('signature.noResults')}</div>
            ) : filteredPending.map((row) => (
              <div key={row.bookingId} className="signature-item">
                <div className="signature-item-meta">
                  <div style={{ fontWeight: 600 }}>{row.date} · {row.time}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{row.lesson}</div>
                </div>
                <SignaturePad
                  clearLabel={t('signature.clear')}
                  hint={t('signature.hint')}
                  onChange={(value) => setSignatures((current) => ({ ...current, [row.bookingId]: value }))}
                />
                <Button pink disabled={busyId === row.bookingId} onClick={() => submitSign(row.bookingId)}>
                  {busyId === row.bookingId ? t('signature.saving') : t('signature.submit')}
                </Button>
              </div>
            ))}
          </Card>
        )}

        <Card title={t('homework.title')} action={<Button ghost size="sm" onClick={() => navigate('/app/history')}>{t('homework.history')}</Button>}>
          {items.length === 0 ? (
            <div className="empty">{t('homework.empty')}</div>
          ) : items.map((item) => (
            <div key={item.id} className="toggle-row" style={{ alignItems: 'flex-start', flexDirection: 'column' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{item.date} · {item.lesson}</div>
                <div style={{ fontSize: 13, marginTop: 6, whiteSpace: 'pre-wrap' }}>{item.note}</div>
                {item.audioUrl && (
                  <a href={item.audioUrl} target="_blank" rel="noreferrer" className="link" style={{ fontSize: 12, display: 'inline-block', marginTop: 8 }}>
                    {t('homework.audio')}
                  </a>
                )}
              </div>
              <HomeworkAudioUpload
                itemId={item.id}
                existingUrl={item.studentAudioUrl}
                t={t}
                toast={toast}
                onUploaded={load}
              />
            </div>
          ))}
        </Card>
      </div>
    );
}
