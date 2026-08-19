import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Field, Input } from '../components/ui';
import { LogoMark } from '../components/Logo';
import { useApp } from '../context/AppContext';
const GENRES = ['Pop', 'Ballad', 'Rock', 'R&B', 'Hip-Hop', 'ลูกทุ่ง', 'Jazz', 'อื่น ๆ'];
export default function Register() {
    const { language, register, setLanguage, t, toast } = useApp();
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [nickname, setNickname] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [age, setAge] = useState('');
    const [education, setEducation] = useState('');
    const [genres, setGenres] = useState([]);
    const [reason, setReason] = useState('');
    const [consent, setConsent] = useState(false);
    const [busy, setBusy] = useState(false);
    const toggleGenre = (g) => setGenres((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            await register({
                name,
                nickname,
                age: Number(age),
                education,
                genres,
                reason,
                consent,
                email,
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
    return (<div className="authwrap">
      <form className="authcard" onSubmit={submit}>
        <div className="auth-prefs">
          <button className="pref-btn" type="button" onClick={() => setLanguage(language === 'th' ? 'en' : 'th')}>
            {language === 'th' ? 'EN' : 'TH'}
          </button>
        </div>
        <LogoMark size={64}/>
        <h2>{t('auth.registerTitle')}</h2>
        <div className="sub">{t('auth.registerSub')}</div>

        <Field label={t('auth.name')} required>
          <Input placeholder="เช่น สมชาย ใจดี" value={name} onChange={(e) => setName(e.target.value)}/>
        </Field>
        <Field label={t('auth.nickname')} required>
          <Input placeholder="เช่น มิ้นท์" value={nickname} onChange={(e) => setNickname(e.target.value)}/>
        </Field>

        <div className="two-col">
          <Field label={t('auth.email')} required>
            <Input type="email" placeholder={t('auth.idPlaceholder')} value={email} onChange={(e) => setEmail(e.target.value)}/>
          </Field>
          <Field label={t('auth.passwordMin')} required>
            <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)}/>
          </Field>
        </div>

        <div className="two-col">
          <Field label={t('auth.age')} required>
            <Input type="number" placeholder="เช่น 22" value={age} onChange={(e) => setAge(e.target.value)}/>
          </Field>
          <Field label={t('auth.education')} required>
            <select className="input" value={education} onChange={(e) => setEducation(e.target.value)}>
              <option value="">{t('auth.select')}</option>
              <option>ม.ต้น</option>
              <option>ม.ปลาย</option>
              <option>ปวช. / ปวส.</option>
              <option>ปริญญาตรี</option>
              <option>ปริญญาโทขึ้นไป</option>
            </select>
          </Field>
        </div>

        <Field label={t('auth.genres')} required>
          <div className="genre-row">
            {GENRES.map((g) => (<span key={g} className={`chk ${genres.includes(g) ? 'on' : ''}`} onClick={() => toggleGenre(g)}>
                {g}
              </span>))}
          </div>
        </Field>

        <Field label={t('auth.reason')} required>
          <textarea className="input" rows={2} placeholder="เช่น อยากออดิชันวงดนตรี / พัฒนาน้ำเสียง…" value={reason} onChange={(e) => setReason(e.target.value)}/>
        </Field>

        <div className="consent">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}/>
          <span>{t('auth.consent')}</span>
        </div>

        <Button pink style={{ width: '100%' }} disabled={busy}>
          {busy ? t('auth.signingUp') : t('common.register')}
        </Button>

        <div className="divider">{t('auth.or')}</div>
        <Button line style={{ width: '100%' }} onClick={() => toast('เปิด LIFF สมัครผ่าน LINE (ฟีเจอร์เสริม) — ข้อมูลจะถูกกรอกอัตโนมัติ')}>
          {t('auth.lineRegister')}
        </Button>

        <div className="authlink">
          {t('auth.hasAccount')} <Link to="/login">{t('common.login')}</Link>
        </div>
      </form>
    </div>);
}
