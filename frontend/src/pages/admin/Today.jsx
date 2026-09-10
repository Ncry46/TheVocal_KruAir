import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Spinner } from '@components/ui';
import { BellIcon, CalendarIcon, CheckIcon, GraduationIcon, MusicNoteIcon, RefreshIcon, WalletIcon } from '@components/icons';
import { api } from '@app/services/apiClient';
import { useApp } from '@app/context/AppContext';

export default function Today() {
    const { language, t, toast } = useApp();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [checkInBusy, setCheckInBusy] = useState('');

    const load = () => api.getTeacherToday().then(setData).catch(() => setData({
        date: '—',
        pendingLessons: 0,
        moveRequests: 0,
        homeworkThisWeek: 0,
        pendingSignatures: 0,
        pendingPayments: 0,
        lessons: [],
    }));

    useEffect(() => {
        load();
    }, [language]);

    const checkIn = async (bookingId) => {
        if (!bookingId || checkInBusy) {
            return;
        }
        setCheckInBusy(bookingId);
        try {
            await api.teacherCheckIn(bookingId);
            toast(t('schedule.checkInOk'), 'ok');
            await load();
        }
        catch (err) {
            toast(err instanceof Error ? err.message : t('schedule.checkInFailed'));
        }
        finally {
            setCheckInBusy('');
        }
    };

    if (!data) {
        return <Spinner />;
    }

    const statusLabel = (status) => {
        if (status === 'done') {
            return t('schedule.done');
        }
        if (status === 'confirmed') {
            return language === 'en' ? 'Confirmed' : 'ยืนยันแล้ว';
        }
        return language === 'en' ? 'Pending' : 'รอยืนยัน';
    };

    const stats = [
        { label: language === 'en' ? 'Pending confirm' : 'รอยืนยัน', value: data.pendingLessons, tone: 'amber', icon: <BellIcon width={18} height={18}/>, to: '/teacher/calendar' },
        { label: language === 'en' ? 'Move requests' : 'คำขอเลื่อนนัด', value: data.moveRequests, tone: 'pink', icon: <RefreshIcon width={18} height={18}/>, to: '/teacher/requests' },
        { label: language === 'en' ? 'Awaiting signature' : 'รอลงชื่อ', value: data.pendingSignatures, tone: 'blue', icon: <CheckIcon width={18} height={18}/>, to: '/teacher/calendar' },
        { label: language === 'en' ? 'Homework audio' : 'เสียงการบ้าน', value: data.homeworkThisWeek, tone: 'violet', icon: <MusicNoteIcon width={18} height={18}/>, to: '/teacher/calendar' },
        { label: language === 'en' ? 'Pending payments' : 'รอตรวจโอน', value: data.pendingPayments, tone: 'green', icon: <WalletIcon width={18} height={18}/>, to: '/teacher/payments' },
    ];

    return (
      <div className="grid" style={{ gap: 16 }}>
        <div className="alertbar">
          <CalendarIcon width={16} height={16}/>
          <b>{language === 'en' ? 'Today' : 'วันนี้'} · {data.date}</b>
        </div>

        <div className="kpi-grid kpi-grid-5">
          {stats.map((item) => (
            <Card key={item.label}>
              <button type="button" className="kpi-card stat-card" onClick={() => navigate(item.to)} style={{ width: '100%', textAlign: 'left', background: 'none', border: 0, padding: 0, cursor: 'pointer' }}>
                <span className={`stat-ic ${item.tone}`}>{item.icon}</span>
                <span className="stat-tx">
                  <span className="muted" style={{ fontSize: 12 }}>{item.label}</span>
                  <span style={{ fontSize: 28, fontWeight: 700, marginTop: 2, lineHeight: 1.15 }}>{item.value}</span>
                </span>
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
          ) : (
            <div className="today-lesson-list">
              {data.lessons.map((lesson) => (
                <div key={lesson.bookingId} className="today-lesson">
                  <div className="today-lesson-main">
                    <div className="today-lesson-title">{lesson.timeRange || lesson.time} · {lesson.student}</div>
                    <div className="muted today-lesson-sub">{lesson.lesson}</div>
                    <div className="today-lesson-chips">
                      <span className={`badge ${lesson.status === 'confirmed' || lesson.status === 'done' ? 'green' : 'amber'}`}>
                        {statusLabel(lesson.status)}
                      </span>
                      <span className={`badge ${lesson.studentCheckedIn ? 'green' : 'amber'}`}>
                        {lesson.studentCheckedIn ? t('schedule.studentCheckedIn') : t('schedule.studentNotCheckedIn')}
                      </span>
                      <span className={`badge ${lesson.studentSigned ? 'green' : 'amber'}`}>
                        {lesson.studentSigned ? t('schedule.studentSigned') : t('schedule.studentUnsigned')}
                      </span>
                      <span className={`badge ${lesson.teacherCheckedIn ? 'green' : 'amber'}`}>
                        {lesson.teacherCheckedIn ? t('schedule.teacherCheckedIn') : t('schedule.teacherNotCheckedIn')}
                      </span>
                    </div>
                  </div>
                  <div className="today-lesson-actions">
                    {lesson.canCheckIn && (
                      <Button
                        green
                        size="sm"
                        disabled={checkInBusy === lesson.bookingId}
                        onClick={() => checkIn(lesson.bookingId)}
                      >
                        {checkInBusy === lesson.bookingId ? t('schedule.checkingIn') : t('schedule.checkIn')}
                      </Button>
                    )}
                    <Button ghost size="sm" onClick={() => navigate(`/teacher/students/${lesson.studentId}`)}>
                      {language === 'en' ? 'Profile' : 'โปรไฟล์'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
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
