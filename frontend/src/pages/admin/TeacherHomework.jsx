import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Spinner } from '@components/ui';
import { MusicNoteIcon } from '@components/icons';
import { api } from '@app/services/apiClient';
import { useApp } from '@app/context/AppContext';

export default function TeacherHomework() {
    const { language, toast } = useApp();
    const navigate = useNavigate();
    const [rows, setRows] = useState(null);
    const [loadError, setLoadError] = useState('');

    const load = () => {
        setLoadError('');
        return api.getTeacherHomeworkSubmissions()
            .then((data) => {
                setRows(Array.isArray(data) ? data : []);
            })
            .catch((err) => {
                setRows([]);
                const message = err instanceof Error
                    ? err.message
                    : (language === 'en' ? 'Could not load homework' : 'โหลดการบ้านไม่สำเร็จ');
                setLoadError(message);
                toast(message);
            });
    };

    useEffect(() => {
        setRows(null);
        load();
    }, [language]);

    if (rows === null) {
        return <Spinner />;
    }

    return (
      <div className="grid" style={{ gap: 16 }}>
        <div className="alertbar">
          <MusicNoteIcon width={16} height={16}/>
          <b>
            {rows.length}
            {' '}
            {language === 'en' ? 'homework audio submissions' : 'เสียงการบ้านจากนักเรียน'}
          </b>
          {loadError && (
            <Button ghost size="sm" style={{ marginLeft: 'auto' }} onClick={() => { setRows(null); load(); }}>
              {language === 'en' ? 'Retry' : 'ลองใหม่'}
            </Button>
          )}
        </div>

        <Card
          title={language === 'en' ? 'Review homework audio' : 'ตรวจการบ้าน · ฟังเสียง'}
          action={(
            <Button ghost size="sm" onClick={() => { setRows(null); load(); }}>
              {language === 'en' ? 'Refresh' : 'รีเฟรช'}
            </Button>
          )}
        >
          {rows.length === 0 ? (
            <div className="empty">
              {loadError
                  ? (language === 'en' ? 'Could not load homework from the database.' : 'โหลดการบ้านจากฐานข้อมูลไม่สำเร็จ')
                  : (language === 'en' ? 'No homework audio yet' : 'ยังไม่มีเสียงการบ้าน')}
            </div>
          ) : (
            rows.map((row) => (
              <div key={row.id} className="toggle-row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{row.student} · {row.date}{row.time ? ` · ${row.time}` : ''}</div>
                <div className="muted" style={{ fontSize: 12 }}>{row.lesson}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {row.audioUrl && (
                    <a href={row.audioUrl} target="_blank" rel="noreferrer" className="link" style={{ fontSize: 12 }}>
                      {language === 'en' ? 'Listen' : 'ฟังเสียง'}
                    </a>
                  )}
                  {row.studentId && (
                    <Button ghost size="sm" onClick={() => navigate(`/teacher/students/${row.studentId}`)}>
                      {language === 'en' ? 'Profile' : 'โปรไฟล์'}
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </Card>
      </div>
    );
}
