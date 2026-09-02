import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Spinner } from '@components/ui';
import { api } from '@app/services/apiClient';
import { useApp } from '@app/context/AppContext';

function SignaturePad({ clearLabel, onChange }) {
    const canvasRef = useRef(null);
    const drawing = useRef(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
    }, []);

    const pos = (event) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const clientX = event.touches ? event.touches[0].clientX : event.clientX;
        const clientY = event.touches ? event.touches[0].clientY : event.clientY;
        return {
            x: (clientX - rect.left) * (canvas.width / rect.width),
            y: (clientY - rect.top) * (canvas.height / rect.height),
        };
    };

    const start = (event) => {
        drawing.current = true;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const { x, y } = pos(event);
        ctx.beginPath();
        ctx.moveTo(x, y);
        event.preventDefault();
    };

    const move = (event) => {
        if (!drawing.current) {
            return;
        }
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const { x, y } = pos(event);
        ctx.lineTo(x, y);
        ctx.stroke();
        onChange(canvas.toDataURL('image/png'));
        event.preventDefault();
    };

    const end = () => {
        drawing.current = false;
    };

    const clear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        onChange('');
    };

    return (
      <div>
        <canvas
          ref={canvasRef}
          width={480}
          height={160}
          className="signature-canvas"
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
        <Button ghost size="sm" style={{ marginTop: 8 }} onClick={clear}>
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

    return (
      <div className="grid" style={{ gap: 16 }}>
        {pendingSign.length > 0 && (
          <Card title={t('signature.title')} action={<span className="badge amber">{pendingSign.length}</span>}>
            {pendingSign.map((row) => (
              <div key={row.bookingId} className="toggle-row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{row.date} · {row.time}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{row.lesson}</div>
                </div>
                <SignaturePad
                  clearLabel={t('signature.clear')}
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
