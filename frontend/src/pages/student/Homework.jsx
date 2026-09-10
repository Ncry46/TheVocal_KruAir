import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Spinner } from '@components/ui';
import { api } from '@app/services/apiClient';
import { useApp } from '@app/context/AppContext';
import { daysInMonth, filterSignaturesByDate, signatureYears } from '../admin/signatureFilter.js';

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

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

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function HomeworkAudioUpload({ itemId, existingUrl, t, toast, onUploaded }) {
    const [recording, setRecording] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [previewUrl, setPreviewUrl] = useState('');
    const [pendingFile, setPendingFile] = useState(null);
    const [fileLabel, setFileLabel] = useState('');
    const [busy, setBusy] = useState(false);
    const mediaRef = useRef(null);
    const chunksRef = useRef([]);
    const inputRef = useRef(null);

    useEffect(() => () => {
        mediaRef.current?.stream?.getTracks?.().forEach((track) => track.stop());
        if (previewUrl?.startsWith('blob:')) {
            URL.revokeObjectURL(previewUrl);
        }
    }, [previewUrl]);

    const clearPreview = () => {
        setPreviewUrl('');
        setPendingFile(null);
        setFileLabel('');
    };

    const acceptAudioFile = (file) => {
        if (!file) {
            return;
        }
        if (!String(file.type || '').startsWith('audio/')) {
            toast(t('homework.audioOnly'));
            return;
        }
        if (file.size > MAX_AUDIO_BYTES) {
            toast(t('homework.tooLarge'));
            return;
        }
        setPendingFile(file);
        setFileLabel(file.name || t('homework.audioFile'));
        setPreviewUrl((prev) => {
            if (prev?.startsWith('blob:')) {
                URL.revokeObjectURL(prev);
            }
            return URL.createObjectURL(file);
        });
    };

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
                setPendingFile(blob);
                setFileLabel(t('homework.recordedClip'));
                setPreviewUrl((prev) => {
                    if (prev?.startsWith('blob:')) {
                        URL.revokeObjectURL(prev);
                    }
                    return URL.createObjectURL(blob);
                });
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
        if (!pendingFile) {
            return;
        }
        setBusy(true);
        try {
            const dataUrl = await fileToDataUrl(pendingFile);
            if (!String(dataUrl).startsWith('data:audio/')) {
                throw new Error(t('homework.audioOnly'));
            }
            await api.uploadHomeworkAudio(itemId, dataUrl);
            toast(t('homework.uploaded'), 'ok');
            clearPreview();
            await onUploaded();
        }
        catch (err) {
            toast(err instanceof Error ? err.message : t('homework.uploadFailed'));
        }
        finally {
            setBusy(false);
        }
    };

    const onDrop = (event) => {
        event.preventDefault();
        setDragOver(false);
        if (busy || recording) {
            return;
        }
        acceptAudioFile(event.dataTransfer?.files?.[0]);
    };

    if (existingUrl) {
        return (
          <div className="hw-block">
            <div className="hw-block-label">{t('homework.submitLabel')}</div>
            <div className="hw-upload hw-upload-done">
              <div className="hw-upload-done-label">{t('homework.submitted')}</div>
              <a href={existingUrl} target="_blank" rel="noreferrer" className="btn ghost sm">
                {t('homework.openSubmitted')}
              </a>
            </div>
          </div>
        );
    }

    return (
      <div className="hw-block">
        <div className="hw-block-label">{t('homework.submitLabel')}</div>
        <div className="hw-upload">
          <div
            className={`hw-dropzone${dragOver ? ' over' : ''}${recording ? ' recording' : ''}`}
            onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
            onDrop={onDrop}
          >
            <div className="hw-dropzone-copy">
              <div className="hw-dropzone-title">
                {recording ? t('homework.recording') : t('homework.dropTitle')}
              </div>
              <p className="muted hw-dropzone-hint">{t('homework.dropHint')}</p>
            </div>
            <div className="hw-dropzone-actions">
              {!recording ? (
                <Button ghost size="sm" type="button" disabled={busy} onClick={startRecording}>
                  {t('homework.record')}
                </Button>
              ) : (
                <Button pink size="sm" type="button" onClick={stopRecording}>
                  {t('homework.stopRecording')}
                </Button>
              )}
              <label
                className="btn ghost sm"
                style={{ cursor: busy || recording ? 'not-allowed' : 'pointer', opacity: busy || recording ? 0.55 : 1 }}
              >
                {t('homework.chooseFile')}
                <input
                  ref={inputRef}
                  type="file"
                  accept="audio/*"
                  hidden
                  disabled={busy || recording}
                  onChange={(e) => {
                      acceptAudioFile(e.target.files?.[0]);
                      e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>

          {previewUrl && (
            <div className="hw-preview">
              <div className="hw-preview-meta">
                <span className="hw-preview-name">{fileLabel || t('homework.audioFile')}</span>
                <button type="button" className="link" onClick={clearPreview} disabled={busy}>
                  {t('homework.clearPreview')}
                </button>
              </div>
              <audio controls src={previewUrl} className="hw-preview-audio"/>
              <Button pink style={{ width: '100%' }} disabled={busy} onClick={upload}>
                {busy ? t('homework.uploading') : t('homework.upload')}
              </Button>
            </div>
          )}
        </div>
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
    const [filterTime, setFilterTime] = useState('');
    const [hwFilterYear, setHwFilterYear] = useState('');
    const [hwFilterMonth, setHwFilterMonth] = useState('');
    const [hwFilterDay, setHwFilterDay] = useState('');
    const [hwFilterTime, setHwFilterTime] = useState('');

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
    const hwYearOptions = useMemo(
        () => signatureYears(items || [], Number(todayParts.year)),
        [items, todayParts.year],
    );
    const dateFilter = useMemo(
        () => ({ year: filterYear, month: filterMonth, day: filterDay }),
        [filterYear, filterMonth, filterDay],
    );
    const filteredPending = useMemo(() => {
        const byDate = filterSignaturesByDate(pendingSign, dateFilter);
        if (!filterTime) {
            return byDate;
        }
        return byDate.filter((row) => row.slotTime === filterTime);
    }, [pendingSign, dateFilter, filterTime]);
    const filteredHomework = useMemo(() => {
        const byDate = filterSignaturesByDate(items || [], {
            year: hwFilterYear,
            month: hwFilterMonth,
            day: hwFilterDay,
        });
        if (!hwFilterTime) {
            return byDate;
        }
        return byDate.filter((row) => row.slotTime === hwFilterTime);
    }, [items, hwFilterYear, hwFilterMonth, hwFilterDay, hwFilterTime]);
    const dayOptions = useMemo(() => {
        if (!filterYear || !filterMonth) {
            return [];
        }
        return Array.from({ length: daysInMonth(filterYear, filterMonth) }, (_, index) => String(index + 1));
    }, [filterYear, filterMonth]);
    const hwDayOptions = useMemo(() => {
        if (!hwFilterYear || !hwFilterMonth) {
            return [];
        }
        return Array.from({ length: daysInMonth(hwFilterYear, hwFilterMonth) }, (_, index) => String(index + 1));
    }, [hwFilterYear, hwFilterMonth]);
    const timeOptions = useMemo(() => {
        const times = new Set();
        for (const row of pendingSign) {
            if (row.slotTime) {
                times.add(row.slotTime);
            }
        }
        return Array.from(times).sort();
    }, [pendingSign]);
    const hwTimeOptions = useMemo(() => {
        const times = new Set();
        for (const row of items || []) {
            if (row.slotTime) {
                times.add(row.slotTime);
            }
        }
        return Array.from(times).sort();
    }, [items]);
    const monthLabels = language === 'en' ? EN_MONTHS : TH_MONTHS;
    const pendingUploadCount = useMemo(
        () => filteredHomework.filter((item) => !item.studentAudioUrl).length,
        [filteredHomework],
    );

    const resetFilter = () => {
        setFilterYear(todayParts.year);
        setFilterMonth(todayParts.month);
        setFilterDay(todayParts.day);
        setFilterTime('');
    };

    const resetHwFilter = () => {
        setHwFilterYear('');
        setHwFilterMonth('');
        setHwFilterDay('');
        setHwFilterTime('');
    };

    const signKey = (row) => `${row.bookingId}:${row.kind || 'checkout'}`;

    const submitSign = async (row) => {
        const key = signKey(row);
        const data = signatures[key];
        if (!data) {
            toast(t('signature.needSign'));
            return;
        }
        if (row.canSign === false) {
            toast(row.waitReason === 'tooLate' ? t('signature.waitTooLate') : t('signature.waitAfterEnd'));
            return;
        }
        const kind = row.kind === 'checkin' ? 'checkin' : 'checkout';
        setBusyId(key);
        try {
            await api.signLesson(row.bookingId, data, kind);
            toast(kind === 'checkin' ? t('signature.savedCheckin') : t('signature.saved'), 'ok');
            setSignatures((current) => {
                const next = { ...current };
                delete next[key];
                return next;
            });
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
      <div className="homework-page">
        <header className="homework-topbar">
          <div className="homework-topbar-main">
            <span className="homework-eyebrow">{t('nav.homework')}</span>
            <h2 className="homework-title">{t('homework.title')}</h2>
            <p className="muted homework-sub">{t('pages.homeworkSub')}</p>
          </div>
          <div className="homework-topbar-meta">
            <div className="homework-stat">
              <span className="label">{t('homework.pendingUpload')}</span>
              <strong>{pendingUploadCount}</strong>
            </div>
            <Button ghost size="sm" onClick={() => navigate('/app/history')}>{t('homework.history')}</Button>
          </div>
        </header>

        <section className="homework-panel">
          <div className="homework-panel-head">
            <div>
              <h3>{t('homework.listTitle')}</h3>
              <p className="muted homework-panel-sub">{t('homework.listHint')}</p>
            </div>
            <span className="homework-count">{filteredHomework.length} {t('homework.itemsUnit')}</span>
          </div>

          {items.length === 0 ? (
            <div className="homework-empty">{t('homework.empty')}</div>
          ) : (
            <>
              <div className="history-filter-bar">
                <label className="history-filter-field">
                  <span className="muted">{t('homework.filterYear')}</span>
                  <select
                    className="input"
                    value={hwFilterYear}
                    onChange={(e) => {
                        setHwFilterYear(e.target.value);
                        setHwFilterDay('');
                    }}
                  >
                    <option value="">{t('homework.allYears')}</option>
                    {hwYearOptions.map((item) => (
                      <option key={item} value={item}>{language === 'en' ? item : Number(item) + 543}</option>
                    ))}
                  </select>
                </label>
                <label className="history-filter-field">
                  <span className="muted">{t('homework.filterMonth')}</span>
                  <select
                    className="input"
                    value={hwFilterMonth}
                    disabled={!hwFilterYear}
                    onChange={(e) => {
                        const nextMonth = e.target.value;
                        setHwFilterMonth(nextMonth);
                        if (!nextMonth) {
                            setHwFilterDay('');
                        }
                    }}
                  >
                    <option value="">{t('homework.allMonths')}</option>
                    {monthLabels.map((label, index) => (
                      <option key={label} value={String(index + 1)}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className="history-filter-field">
                  <span className="muted">{t('homework.filterDay')}</span>
                  <select
                    className="input"
                    value={hwFilterDay}
                    disabled={!hwFilterYear || !hwFilterMonth}
                    onChange={(e) => setHwFilterDay(e.target.value)}
                  >
                    <option value="">{t('homework.allDays')}</option>
                    {hwDayOptions.map((day) => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </label>
                <label className="history-filter-field">
                  <span className="muted">{t('homework.filterTime')}</span>
                  <select
                    className="input"
                    value={hwFilterTime}
                    onChange={(e) => setHwFilterTime(e.target.value)}
                  >
                    <option value="">{t('homework.allTimes')}</option>
                    {hwTimeOptions.map((time) => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </label>
                <Button ghost size="sm" type="button" onClick={resetHwFilter}>
                  {t('homework.resetFilter')}
                </Button>
              </div>

              {filteredHomework.length === 0 ? (
                <div className="homework-empty">
                  <div>{t('homework.noResults')}</div>
                  <p className="muted" style={{ margin: '6px 0 0' }}>{t('homework.noResultsBody')}</p>
                </div>
              ) : (
                <ul className="homework-list">
                  {filteredHomework.map((item) => (
                    <li key={item.id} className="homework-card">
                      <div className="homework-card-top">
                        <div className="homework-card-meta">
                          <span className="homework-card-date">
                            {item.date}{item.time ? ` · ${item.time}` : ''}
                          </span>
                          <h4 className="homework-card-lesson">{item.lesson}</h4>
                        </div>
                        <span className={`badge ${item.studentAudioUrl ? 'green' : 'amber'}`}>
                          {item.studentAudioUrl ? t('homework.statusDone') : t('homework.statusTodo')}
                        </span>
                      </div>

                      {(item.note || item.audioUrl) && (
                        <div className="homework-card-body">
                          {item.note && (
                            <div className="hw-block">
                              <div className="hw-block-label">{t('homework.teacherNote')}</div>
                              <p className="homework-card-note">{item.note}</p>
                            </div>
                          )}
                          {item.audioUrl && (
                            <div className="hw-block">
                              <div className="hw-block-label">{t('homework.sampleLabel')}</div>
                              <a href={item.audioUrl} target="_blank" rel="noreferrer" className="link homework-sample">
                                {t('homework.audio')}
                              </a>
                            </div>
                          )}
                        </div>
                      )}

                      <HomeworkAudioUpload
                        itemId={item.id}
                        existingUrl={item.studentAudioUrl}
                        t={t}
                        toast={toast}
                        onUploaded={load}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        {showSignatureCard && (
          <section className="homework-panel">
            <div className="homework-panel-head">
              <div>
                <h3>{t('signature.title')}</h3>
                <p className="muted homework-panel-sub">{t('homework.signHint')}</p>
              </div>
              <span className="badge amber">{filteredPending.length}</span>
            </div>

            <div className="signature-filter-bar">
              <label className="signature-filter-field">
                <span className="muted">{t('signature.filterYear')}</span>
                <select
                  className="input"
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
                  className="input"
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
                  className="input"
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
              <label className="signature-filter-field">
                <span className="muted">{t('signature.filterTime')}</span>
                <select
                  className="input"
                  value={filterTime}
                  onChange={(e) => setFilterTime(e.target.value)}
                >
                  <option value="">{t('signature.allTimes')}</option>
                  {timeOptions.map((time) => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
              </label>
              <Button ghost size="sm" type="button" onClick={resetFilter}>{t('signature.resetFilter')}</Button>
            </div>

            {filteredPending.length === 0 ? (
              <div className="homework-empty">{t('signature.noResults')}</div>
            ) : (
              <ul className="homework-list">
                {filteredPending.map((row) => {
                    const key = signKey(row);
                    const isCheckin = row.kind === 'checkin';
                    const canSign = row.canSign !== false;
                    return (
                      <li key={key} className="homework-card">
                        <div className="homework-card-top">
                          <div className="homework-card-meta">
                            <span className="homework-card-date">{row.date} · {row.time}</span>
                            <h4 className="homework-card-lesson">
                              {isCheckin ? t('signature.checkinTitle') : t('signature.checkoutTitle')}
                            </h4>
                            <div className="muted homework-card-lesson-sub">{row.lesson}</div>
                          </div>
                        </div>
                        {!canSign && (
                          <p className="homework-wait muted">
                            {row.waitReason === 'tooLate' ? t('signature.waitTooLate') : t('signature.waitAfterEnd')}
                          </p>
                        )}
                        {canSign && (
                          <div className="hw-block">
                            <div className="hw-block-label">{t('signature.hint')}</div>
                            <SignaturePad
                              clearLabel={t('signature.clear')}
                              onChange={(value) => setSignatures((current) => ({ ...current, [key]: value }))}
                            />
                          </div>
                        )}
                        <Button
                          pink
                          style={{ width: '100%' }}
                          disabled={!canSign || busyId === key}
                          onClick={() => submitSign(row)}
                        >
                          {busyId === key
                            ? t('signature.saving')
                            : (isCheckin ? t('signature.submitCheckin') : t('signature.submitCheckout'))}
                        </Button>
                      </li>
                    );
                })}
              </ul>
            )}
          </section>
        )}
      </div>
    );
}
