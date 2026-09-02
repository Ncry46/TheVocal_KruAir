import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, Spinner } from '@components/ui';
import { SignaturePreviewModal } from '@components/admin/SignaturePreviewModal';
import { api } from '@app/services/apiClient';
import { useApp } from '@app/context/AppContext';

export default function StudentProfile() {
    const { id } = useParams();
    const { language, t } = useApp();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(undefined);
    const [signatureBookingId, setSignatureBookingId] = useState(null);

    useEffect(() => {
        setProfile(undefined);
        api.getStudentProfile(id).then(setProfile).catch(() => setProfile(null));
    }, [id, language]);

    if (profile === undefined) {
        return <Spinner />;
    }

    if (!profile) {
        return (
          <Card>
            <div className="empty">{language === 'en' ? 'Student not found' : 'ไม่พบนักเรียน'}</div>
            <Button ghost onClick={() => navigate('/teacher/students')}>{language === 'en' ? 'Back' : 'กลับ'}</Button>
          </Card>
        );
    }

    return (
      <div className="grid" style={{ gap: 16 }}>
        <Button ghost size="sm" onClick={() => navigate('/teacher/students')} style={{ width: 'fit-content' }}>
          ← {language === 'en' ? 'All students' : 'รายชื่อนักเรียน'}
        </Button>

        <Card title={`${profile.nickname} · ${profile.name}`}>
          <div className="sumrow"><span className="muted">{language === 'en' ? 'Email' : 'อีเมล'}</span><b>{profile.email || '—'}</b></div>
          <div className="sumrow"><span className="muted">{language === 'en' ? 'Phone' : 'เบอร์โทร'}</span><b>{profile.phone || '—'}</b></div>
          <div className="sumrow"><span className="muted">{language === 'en' ? 'Emergency' : 'ผู้ติดต่อฉุกเฉิน'}</span><b>{profile.emergencyContact || '—'}</b></div>
          <div className="sumrow"><span className="muted">{language === 'en' ? 'Age / education' : 'อายุ / การศึกษา'}</span><b>{profile.age ?? '—'} · {profile.education || '—'}</b></div>
          <div className="sumrow"><span className="muted">{language === 'en' ? 'Experience' : 'ประสบการณ์ร้อง'}</span><b>{profile.singingExperience || '—'}</b></div>
          <div className="sumrow"><span className="muted">{language === 'en' ? 'Genres' : 'แนวเพลง'}</span><b>{profile.genres || '—'}</b></div>
          <div className="sumrow"><span className="muted">{language === 'en' ? 'Instruments' : 'เครื่องดนตรี'}</span><b>{profile.instruments || '—'}</b></div>
          <div className="sumrow"><span className="muted">{language === 'en' ? 'Goals' : 'เป้าหมาย'}</span><b style={{ whiteSpace: 'pre-wrap' }}>{profile.goals || '—'}</b></div>
          {profile.address && <div className="sumrow"><span className="muted">{language === 'en' ? 'Address' : 'ที่อยู่'}</span><b>{profile.address}</b></div>}
          {profile.teacher && <div className="sumrow"><span className="muted">{language === 'en' ? 'Teacher' : 'ครูประจำ'}</span><b>{profile.teacher}</b></div>}
        </Card>

        <Card title={language === 'en' ? 'Package' : 'แพ็กเกจ'}>
          <div className="sumrow">
            <span className="muted">{profile.package?.name || '—'}</span>
            <Badge tone={profile.package?.left > 0 ? 'green' : 'gray'}>
              {profile.package?.left ?? 0} {language === 'en' ? 'hrs left' : 'ชม. เหลือ'}
            </Badge>
          </div>
        </Card>

        <Card title={language === 'en' ? 'Upcoming lessons' : 'นัดเรียนที่จะมา'}>
          {profile.upcoming.length === 0 ? (
            <div className="empty">{language === 'en' ? 'No upcoming lessons' : 'ยังไม่มีนัดเรียน'}</div>
          ) : profile.upcoming.map((row) => (
            <div key={row.id} className="toggle-row">
              <div>
                <div style={{ fontWeight: 600 }}>{row.date} · {row.time}</div>
                <div className="muted" style={{ fontSize: 12 }}>{row.lesson}</div>
              </div>
              <Badge tone={row.status === 'confirmed' ? 'green' : 'amber'}>{row.status}</Badge>
            </div>
          ))}
        </Card>

        <Card title={language === 'en' ? 'Lesson history' : 'ประวัติการเรียน'}>
          {profile.lessons.length === 0 ? (
            <div className="empty">{language === 'en' ? 'No lessons yet' : 'ยังไม่มีประวัติ'}</div>
          ) : profile.lessons.map((row, index) => (
            <div key={`${row.bookingId || row.date}-${index}`} className="toggle-row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{row.date} · {row.time} · {row.lesson}</div>
                {row.outcome === 'no_show' ? (
                  <Badge tone="gray">{t('teacherSignature.noShow')}</Badge>
                ) : row.signed ? (
                  <Badge tone="green">{t('teacherSignature.signed')}</Badge>
                ) : row.needsSignature ? (
                  <Badge tone="amber">{t('teacherSignature.pending')}</Badge>
                ) : null}
              </div>
              <div style={{ fontSize: 13 }}>{row.note}</div>
              {row.signature && (
                <button type="button" className="signature-thumb-btn" onClick={() => setSignatureBookingId(row.bookingId)}>
                  <img src={row.signature} alt={t('teacherSignature.view')} className="signature-preview-img thumb"/>
                  <span>{t('teacherSignature.view')}</span>
                </button>
              )}
              {!row.signature && row.signed && row.bookingId && (
                <Button ghost size="sm" onClick={() => setSignatureBookingId(row.bookingId)}>{t('teacherSignature.view')}</Button>
              )}
            </div>
          ))}
        </Card>

        <SignaturePreviewModal
          open={Boolean(signatureBookingId)}
          onClose={() => setSignatureBookingId(null)}
          bookingId={signatureBookingId}
          language={language}
        />
      </div>
    );
}
