import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Spinner } from '@components/ui';
import { CheckIcon } from '@components/icons';
import { SignaturePreviewModal } from '@components/admin/SignaturePreviewModal';
import { daysInMonth as countDaysInMonth, filterSignaturesByDate, signatureYears as collectSignatureYears } from './signatureFilter';
import { api } from '@app/services/apiClient';
import { useApp } from '@app/context/AppContext';

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function TeacherSignatures() {
    const { language, t, toast } = useApp();
    const navigate = useNavigate();
    const today = new Date();
    const [signatureRows, setSignatureRows] = useState(null);
    const [signatureBookingId, setSignatureBookingId] = useState(null);
    const [sigFilterYear, setSigFilterYear] = useState(String(today.getFullYear()));
    const [sigFilterMonth, setSigFilterMonth] = useState('');
    const [sigFilterDay, setSigFilterDay] = useState('');
    const [loadError, setLoadError] = useState('');

    const load = () => {
        setLoadError('');
        return api.getTeacherSignatures()
            .then((data) => {
                setSignatureRows({
                    pending: data?.pending ?? [],
                    signed: data?.signed ?? [],
                });
            })
            .catch((err) => {
                setSignatureRows({ pending: [], signed: [] });
                const message = err instanceof Error
                    ? err.message
                    : (language === 'en' ? 'Could not load signatures' : 'โหลดลายเซ็นไม่สำเร็จ');
                setLoadError(message);
                toast(message);
            });
    };

    useEffect(() => {
        setSignatureRows(null);
        load();
    }, [language]);

    const signatureYearOptions = useMemo(
        () => collectSignatureYears(
            [...(signatureRows?.pending ?? []), ...(signatureRows?.signed ?? [])],
            today.getFullYear(),
        ),
        [signatureRows, today],
    );
    const signatureFilter = useMemo(() => ({
        year: sigFilterYear,
        month: sigFilterMonth,
        day: sigFilterDay,
    }), [sigFilterYear, sigFilterMonth, sigFilterDay]);
    const filteredPending = useMemo(
        () => filterSignaturesByDate(signatureRows?.pending ?? [], signatureFilter),
        [signatureRows?.pending, signatureFilter],
    );
    const filteredSigned = useMemo(
        () => filterSignaturesByDate(signatureRows?.signed ?? [], signatureFilter),
        [signatureRows?.signed, signatureFilter],
    );
    const signatureDayOptions = useMemo(() => {
        if (!sigFilterYear || !sigFilterMonth) {
            return [];
        }
        return Array.from({ length: countDaysInMonth(sigFilterYear, sigFilterMonth) }, (_, index) => String(index + 1));
    }, [sigFilterYear, sigFilterMonth]);
    const monthLabels = language === 'en' ? EN_MONTHS : TH_MONTHS;

    if (signatureRows === null) {
        return <Spinner />;
    }

    return (
      <div className="grid" style={{ gap: 16 }}>
        <div className="alertbar">
          <CheckIcon width={16} height={16}/>
          <b>
            {filteredPending.length}
            {' '}
            {t('teacherSignature.pending')}
          </b>
          {loadError && (
            <Button ghost size="sm" style={{ marginLeft: 'auto' }} onClick={() => { setSignatureRows(null); load(); }}>
              {language === 'en' ? 'Retry' : 'ลองใหม่'}
            </Button>
          )}
        </div>

        <Card
          className="sched-signatures"
          title={t('teacherSignature.title')}
          action={filteredPending.length > 0
              ? <span className="badge amber">{filteredPending.length} {t('teacherSignature.pending')}</span>
              : <span className="badge green">{t('teacherSignature.nonePending')}</span>}
        >
          <div className="signature-filter-row">
            <label className="signature-filter-field">
              <span className="muted">{t('teacherSignature.filterYear')}</span>
              <select
                className="input"
                value={sigFilterYear}
                onChange={(e) => {
                    setSigFilterYear(e.target.value);
                    setSigFilterDay('');
                }}
              >
                {signatureYearOptions.map((item) => (
                  <option key={item} value={item}>{language === 'en' ? item : Number(item) + 543}</option>
                ))}
              </select>
            </label>
            <label className="signature-filter-field">
              <span className="muted">{t('teacherSignature.filterMonth')}</span>
              <select
                className="input"
                value={sigFilterMonth}
                onChange={(e) => {
                    setSigFilterMonth(e.target.value);
                    setSigFilterDay('');
                }}
              >
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
            <Button
              ghost
              size="sm"
              type="button"
              onClick={() => {
                  setSigFilterYear(String(today.getFullYear()));
                  setSigFilterMonth('');
                  setSigFilterDay('');
              }}
            >
              {t('teacherSignature.resetFilter')}
            </Button>
          </div>

          {filteredPending.length === 0 && filteredSigned.length === 0 ? (
            <div className="empty">{t('teacherSignature.noResults')}</div>
          ) : (
            <>
              {filteredPending.map((row) => (
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
              {filteredSigned.map((row) => (
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
      </div>
    );
}
