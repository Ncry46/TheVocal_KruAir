import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Spinner } from '@components/ui';
import { BellIcon, CalendarIcon, GraduationIcon, RefreshIcon, WalletIcon } from '@components/icons';
import { api } from '@app/services/apiClient';
import { useApp } from '@app/context/AppContext';

export default function Today() {
    const { language, t } = useApp();
    const navigate = useNavigate();
    const [data, setData] = useState(null);

    useEffect(() => {
        api.getTeacherToday().then(setData).catch(() => setData({
            date: '—',
            pendingLessons: 0,
            moveRequests: 0,
            homeworkThisWeek: 0,
            pendingSignatures: 0,
            pendingPayments: 0,
            lessons: [],
        }));
    }, [language]);

    if (!data) {
        return <Spinner />;
    }

    const stats = [
        { label: language === 'en' ? 'Pending confirm' : 'รอยืนยัน', value: data.pendingLessons, tone: 'amber', to: '/teacher/calendar' },
        { label: language === 'en' ? 'Move requests' : 'คำขอเลื่อนนัด', value: data.moveRequests, tone: 'pink', to: '/teacher/requests' },
        { label: language === 'en' ? 'Awaiting signature' : 'รอลงชื่อ', value: data.pendingSignatures, tone: 'blue', to: '/teacher/calendar' },
        { label: language === 'en' ? 'Homework audio' : 'เสียงการบ้าน', value: data.homeworkThisWeek, tone: 'blue', to: '/teacher/calendar' },
        { label: language === 'en' ? 'Pending payments' : 'รอตรวจโอน', value: data.pendingPayments, tone: 'green', to: '/teacher/payments' },
    ];

    return (
      <div className="grid" style={{ gap: 16 }}>
        <div className="alertbar">
          <CalendarIcon width={16} height={16}/>
          <b>{language === 'en' ? 'Today' : 'วันนี้'} · {data.date}</b>
        </div>

        <div className="kpi-grid">
          {stats.map((item) => (
            <Card key={item.label}>
              <button type="button" className="kpi-card" onClick={() => navigate(item.to)} style={{ width: '100%', textAlign: 'left', background: 'none', border: 0, padding: 0, cursor: 'pointer' }}>
                <div className="muted" style={{ fontSize: 12 }}>{item.label}</div>
                <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>{item.value}</div>
              </button>
            </Card>
          ))}
        </div>

        <Card
          title={language === 'en' ? "Today's lessons" : 'คลาสวันนี้'}
          action={<Button ghost size="sm" onClick={() => navigate('/teacher/calendar')}>{language === 'en' ? 'Full calendar' : 'ดูปฏิทิน'}</Button>}
        >
          {data.lessons.length === 0 ? (
            <div className="empty">{language === 'en' ? 'No lessons today' : 'วันนี้ยังไม่มีคลาส'}</div>
          ) : data.lessons.map((lesson) => (
            <div key={lesson.bookingId} className="toggle-row">
              <div>
                <div style={{ fontWeight: 600 }}>{lesson.timeRange || lesson.time} · {lesson.student}</div>
                <div className="muted" style={{ fontSize: 12 }}>{lesson.lesson}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className={`badge ${lesson.status === 'confirmed' ? 'green' : 'amber'}`}>
                  {lesson.status === 'confirmed' ? (language === 'en' ? 'Confirmed' : 'ยืนยันแล้ว') : (language === 'en' ? 'Pending' : 'รอยืนยัน')}
                </span>
                <Button ghost size="sm" onClick={() => navigate(`/teacher/students/${lesson.studentId}`)}>
                  {language === 'en' ? 'Profile' : 'โปรไฟล์'}
                </Button>
              </div>
            </div>
          ))}
        </Card>

        <div className="quick-links" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button ghost onClick={() => navigate('/teacher/requests')}><RefreshIcon width={14} height={14}/> {t('nav.requests')}</Button>
          <Button ghost onClick={() => navigate('/teacher/students')}><GraduationIcon width={14} height={14}/> {t('nav.students')}</Button>
          <Button ghost onClick={() => navigate('/teacher/payments')}><WalletIcon width={14} height={14}/> {t('nav.payments')}</Button>
          <Button ghost onClick={() => navigate('/teacher/payment-links')}><BellIcon width={14} height={14}/> {language === 'en' ? 'Payment links' : 'ลิงก์ชำระเงิน'}</Button>
        </div>
      </div>
    );
}
