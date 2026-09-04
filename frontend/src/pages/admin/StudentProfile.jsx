import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, Field, Input, Spinner } from '@components/ui';
import { SignaturePreviewModal } from '@components/admin/SignaturePreviewModal';
import { api } from '@app/services/apiClient';
import { useApp } from '@app/context/AppContext';

const SLOT_TIMES = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];

const EMPTY_RULE = {
    weekday: '1',
    time: '18:00',
    hours: '1',
    mode: 'studio',
};

export default function StudentProfile() {
    const { id } = useParams();
    const { language, t, toast } = useApp();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(undefined);
    const [signatureBookingId, setSignatureBookingId] = useState(null);
    const [recurring, setRecurring] = useState([]);
    const [ruleForm, setRuleForm] = useState(EMPTY_RULE);
    const [busy, setBusy] = useState(false);

    const weekdays = language === 'en'
        ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        : ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

    const load = async () => {
        setProfile(undefined);
        try {
            const data = await api.getStudentProfile(id);
            setProfile(data);
        }
        catch {
            setProfile(null);
        }
        try {
            setRecurring(await api.getStudentRecurring(id));
        }
        catch {
            setRecurring([]);
        }
    };

    useEffect(() => {
        load();
    }, [id, language]);

    const addRule = async () => {
        setBusy(true);
        try {
            const result = await api.createStudentRecurring(id, {
                weekday: Number(ruleForm.weekday),
                time: ruleForm.time,
                hours: Number(ruleForm.hours) || 1,
                mode: ruleForm.mode,
            });
            const made = result.generated?.created?.length ?? 0;
            const skipped = result.generated?.skipped?.length ?? 0;
            toast(
                language === 'en'
                    ? `Saved. Created ${made} lesson(s)${skipped ? `, skipped ${skipped}` : ''}.`
                    : `บันทึกแล้ว สร้างนัด ${made} รายการ${skipped ? ` · ข้าม ${skipped}` : ''}`,
                'ok',
            );
            setRuleForm(EMPTY_RULE);
            setRecurring(await api.getStudentRecurring(id));
            const data = await api.getStudentProfile(id);
            setProfile(data);
        }
        catch (err) {
            toast(err instanceof Error ? err.message : (language === 'en' ? 'Could not save' : 'บันทึกไม่สำเร็จ'));
        }
        finally {
            setBusy(false);
        }
    };

    const removeRule = async (ruleId) => {
        setBusy(true);
        try {
            await api.deleteStudentRecurring(id, ruleId);
            toast(language === 'en' ? 'Weekly rule removed' : 'ลบตารางประจำแล้ว', 'ok');
            setRecurring(await api.getStudentRecurring(id));
        }
        catch (err) {
            toast(err instanceof Error ? err.message : (language === 'en' ? 'Could not delete' : 'ลบไม่สำเร็จ'));
        }
        finally {
            setBusy(false);
        }
    };

    const generate = async () => {
        setBusy(true);
        try {
            const result = await api.generateStudentRecurring(id, 4);
            toast(
                language === 'en'
                    ? `Created ${result.created?.length ?? 0} lesson(s)${result.skipped?.length ? `, skipped ${result.skipped.length}` : ''}.`
                    : `สร้างนัด ${result.created?.length ?? 0} รายการ${result.skipped?.length ? ` · ข้าม ${result.skipped.length}` : ''}`,
                'ok',
            );
            const data = await api.getStudentProfile(id);
            setProfile(data);
        }
        catch (err) {
            toast(err instanceof Error ? err.message : (language === 'en' ? 'Could not generate' : 'สร้างนัดไม่สำเร็จ'));
        }
        finally {
            setBusy(false);
        }
    };

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

        <Card
          title={language === 'en' ? 'Weekly schedule' : 'ตารางเรียนประจำ'}
          action={(
            <Button size="sm" ghost disabled={busy || recurring.length === 0} onClick={generate}>
              {language === 'en' ? 'Generate 4 weeks' : 'สร้างนัด 4 อาทิตย์'}
            </Button>
          )}
        >
          <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>
            {language === 'en'
              ? 'Set weekly days/times. The system creates up to 4 weeks ahead, limited by remaining hours.'
              : 'ตั้งวัน–เวลาเรียนประจำได้หลายวันต่อสัปดาห์ ระบบสร้างนัดล่วงหน้าสูงสุด 4 อาทิตย์ ตามชั่วโมงที่เหลือ'}
          </p>

          <div className="two-col">
            <Field label={language === 'en' ? 'Weekday' : 'วัน'}>
              <select className="input" value={ruleForm.weekday} onChange={(e) => setRuleForm((c) => ({ ...c, weekday: e.target.value }))}>
                {weekdays.map((label, index) => (
                  <option key={label} value={String(index)}>{label}</option>
                ))}
              </select>
            </Field>
            <Field label={language === 'en' ? 'Time' : 'เวลา'}>
              <select className="input" value={ruleForm.time} onChange={(e) => setRuleForm((c) => ({ ...c, time: e.target.value }))}>
                {SLOT_TIMES.map((time) => <option key={time} value={time}>{time}</option>)}
              </select>
            </Field>
          </div>
          <div className="two-col">
            <Field label={language === 'en' ? 'Hours' : 'ชั่วโมง'}>
              <Input type="number" min="1" max="10" value={ruleForm.hours} onChange={(e) => setRuleForm((c) => ({ ...c, hours: e.target.value }))}/>
            </Field>
            <Field label={language === 'en' ? 'Mode' : 'รูปแบบ'}>
              <select className="input" value={ruleForm.mode} onChange={(e) => setRuleForm((c) => ({ ...c, mode: e.target.value }))}>
                <option value="studio">{language === 'en' ? 'Studio' : 'สตูดิโอ'}</option>
                <option value="online">{language === 'en' ? 'Online' : 'ออนไลน์'}</option>
              </select>
            </Field>
          </div>
          <Button pink style={{ width: '100%', marginBottom: 14 }} disabled={busy} onClick={addRule}>
            {busy ? (language === 'en' ? 'Saving…' : 'กำลังบันทึก…') : (language === 'en' ? 'Add weekly rule' : 'เพิ่มวันเรียนประจำ')}
          </Button>

          {recurring.length === 0 ? (
            <div className="empty">{language === 'en' ? 'No weekly rules yet' : 'ยังไม่มีตารางประจำ'}</div>
          ) : recurring.map((rule) => (
            <div key={rule.id} className="toggle-row">
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>
                  {weekdays[rule.weekday]} · {rule.time} · {rule.hours} {language === 'en' ? 'hrs' : 'ชม.'}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {rule.mode === 'online' ? (language === 'en' ? 'Online' : 'ออนไลน์') : (language === 'en' ? 'Studio' : 'สตูดิโอ')}
                </div>
              </div>
              <Button size="sm" ghost disabled={busy} onClick={() => removeRule(rule.id)}>
                {language === 'en' ? 'Remove' : 'ลบ'}
              </Button>
            </div>
          ))}
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
