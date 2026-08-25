import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Field, Input } from '@components/ui';
import { LogoMark } from '@components/Logo';
import { PublicLayout } from '@components/layout/PublicLayout';
import { useApp } from '../context/AppContext';
import { api } from '../services/apiClient';
import { beginLineLogin } from '../services/lineAuth';

const EDUCATION_OPTIONS = [
    { value: 'ม.ต้น', th: 'ม.ต้น', en: 'Lower secondary' },
    { value: 'ม.ปลาย', th: 'ม.ปลาย', en: 'Upper secondary' },
    { value: 'ปวช. / ปวส.', th: 'ปวช. / ปวส.', en: 'Vocational certificate' },
    { value: 'ปริญญาตรี', th: 'ปริญญาตรี', en: "Bachelor's degree" },
    { value: 'ปริญญาโทขึ้นไป', th: 'ปริญญาโทขึ้นไป', en: "Master's or higher" },
];
const GENRES = [
    { value: 'Pop', th: 'Pop', en: 'Pop' },
    { value: 'Ballad', th: 'Ballad', en: 'Ballad' },
    { value: 'Rock', th: 'Rock', en: 'Rock' },
    { value: 'R&B', th: 'R&B', en: 'R&B' },
    { value: 'Hip-Hop', th: 'Hip-Hop', en: 'Hip-Hop' },
    { value: 'ลูกทุ่ง', th: 'ลูกทุ่ง', en: 'Luk thung' },
    { value: 'Jazz', th: 'Jazz', en: 'Jazz' },
    { value: 'อื่น ๆ', th: 'อื่น ๆ', en: 'Other' },
];
export default function Register() {
    const { register, t, toast, language } = useApp();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const lineTicket = searchParams.get('lineTicket') || '';
    const [name, setName] = useState('');
    const [nameEn, setNameEn] = useState('');
    const [nickname, setNickname] = useState('');
    const [nicknameEn, setNicknameEn] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [emergencyContact, setEmergencyContact] = useState('');
    const [password, setPassword] = useState('');
    const [age, setAge] = useState('');
    const [education, setEducation] = useState('');
    const [genres, setGenres] = useState([]);
    const [reason, setReason] = useState('');
    const [consent, setConsent] = useState(false);
    const [busy, setBusy] = useState(false);
    const [lineBusy, setLineBusy] = useState(false);
    const toggleGenre = (g) => setGenres((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));

    useEffect(() => {
        if (!lineTicket) {
            return undefined;
        }
        let cancelled = false;
        api.getLinePending(lineTicket)
            .then((pending) => {
                if (cancelled) {
                    return;
                }
                if (pending.name) {
                    setName((current) => current || pending.name);
                    setNickname((current) => current || String(pending.name).split(/\s+/)[0]);
                    if (/^[\x20-\x7E]+$/.test(String(pending.name))) {
                        setNameEn((current) => current || pending.name);
                        setNicknameEn((current) => current || String(pending.name).split(/\s+/)[0]);
                    }
                }
                if (pending.email) {
                    setEmail((current) => current || pending.email);
                }
                toast(t('auth.linePrefill'), 'ok');
            })
            .catch((err) => {
                if (!cancelled) {
                    toast(err instanceof Error ? err.message : t('auth.lineFailed'));
                }
            });
        return () => {
            cancelled = true;
        };
    }, [lineTicket, t, toast]);

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            await register(lineTicket
                ? {
                    nameEn,
                    nicknameEn,
                    consent,
                    phone,
                    lineTicket,
                }
                : {
                    name,
                    nameEn,
                    nickname,
                    nicknameEn,
                    age: Number(age),
                    education,
                    genres,
                    reason,
                    consent,
                    email,
                    phone,
                    emergencyContact,
                    password,
                });
            navigate('/app');
        }
        catch (err) {
            toast(err instanceof Error ? err.message : t('auth.registerFailed'));
        }
        finally {
            setBusy(false);
        }
    };

    const onLine = async (event) => {
        event.preventDefault();
        setLineBusy(true);
        try {
            await beginLineLogin('register');
        }
        catch (err) {
            toast(err instanceof Error ? err.message : t('auth.lineFailed'));
            setLineBusy(false);
        }
    };

    return (
      <PublicLayout footer={false}>
        <div className="authwrap">
          <form className="authcard" onSubmit={submit}>
            <LogoMark size={64}/>
            <h2>{t('auth.registerTitle')}</h2>
            <div className="sub">{lineTicket ? t('auth.lineRegisterSub') : t('auth.registerSub')}</div>

        {lineTicket ? (
          <>
            <Field label={t('auth.phone')} required>
              <Input type="tel" placeholder={t('auth.phonePlaceholder')} value={phone} onChange={(e) => setPhone(e.target.value)}/>
            </Field>
            <Field label={t('auth.nameEn')} required>
              <Input placeholder={t('auth.nameEnPlaceholder')} value={nameEn} onChange={(e) => setNameEn(e.target.value)}/>
            </Field>
            <Field label={t('auth.nicknameEn')} required>
              <Input placeholder={t('auth.nicknameEnPlaceholder')} value={nicknameEn} onChange={(e) => setNicknameEn(e.target.value)}/>
            </Field>
          </>
        ) : (
          <>
        <Field label={t('auth.name')} required>
          <Input placeholder="เช่น สมชาย ใจดี" value={name} onChange={(e) => setName(e.target.value)}/>
        </Field>
        <Field label={t('auth.nameEn')} required>
          <Input placeholder={t('auth.nameEnPlaceholder')} value={nameEn} onChange={(e) => setNameEn(e.target.value)}/>
        </Field>
        <div className="two-col">
          <Field label={t('auth.nickname')} required>
            <Input placeholder="เช่น มิ้นท์" value={nickname} onChange={(e) => setNickname(e.target.value)}/>
          </Field>
          <Field label={t('auth.nicknameEn')} required>
            <Input placeholder={t('auth.nicknameEnPlaceholder')} value={nicknameEn} onChange={(e) => setNicknameEn(e.target.value)}/>
          </Field>
        </div>

        <div className="two-col">
          <Field label={t('auth.email')} required>
            <Input type="email" placeholder={t('auth.idPlaceholder')} value={email} onChange={(e) => setEmail(e.target.value)}/>
          </Field>
          <Field label={t('auth.phone')} required>
            <Input type="tel" placeholder={t('auth.phonePlaceholder')} value={phone} onChange={(e) => setPhone(e.target.value)}/>
          </Field>
        </div>

        <div className="two-col">
          <Field label={t('auth.passwordMin')} required>
            <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)}/>
          </Field>
          <Field label={t('auth.emergency')}>
            <Input placeholder={t('auth.emergencyPlaceholder')} value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value)}/>
          </Field>
        </div>

        <div className="two-col">
          <Field label={t('auth.age')} required>
            <Input type="number" placeholder="เช่น 22" value={age} onChange={(e) => setAge(e.target.value)}/>
          </Field>
          <Field label={t('auth.education')} required>
            <select className="input" value={education} onChange={(e) => setEducation(e.target.value)}>
              <option value="">{t('auth.select')}</option>
              {EDUCATION_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>{language === 'en' ? item.en : item.th}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label={t('auth.genres')} required>
          <div className="genre-row">
            {GENRES.map((g) => (<span key={g.value} className={`chk ${genres.includes(g.value) ? 'on' : ''}`} onClick={() => toggleGenre(g.value)}>
                {language === 'en' ? g.en : g.th}
              </span>))}
          </div>
        </Field>

        <Field label={t('auth.reason')} required>
          <textarea className="input" rows={2} placeholder="เช่น อยากออดิชันวงดนตรี / พัฒนาน้ำเสียง…" value={reason} onChange={(e) => setReason(e.target.value)}/>
        </Field>
          </>
        )}

        <div className="consent">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}/>
          <span>{t('auth.consent')}</span>
        </div>

        <Button pink style={{ width: '100%' }} disabled={busy || lineBusy}>
          {busy ? t('auth.signingUp') : t('common.register')}
        </Button>

        {!lineTicket && (
          <>
            <div className="divider">{t('auth.or')}</div>
            <Button line type="button" style={{ width: '100%' }} disabled={busy || lineBusy} onClick={onLine}>
              {lineBusy ? t('auth.lineConnecting') : t('auth.lineRegister')}
            </Button>
          </>
        )}

            <div className="authlink">
              {t('auth.hasAccount')} <Link to="/login">{t('common.login')}</Link>
            </div>
          </form>
        </div>
      </PublicLayout>
    );
}
