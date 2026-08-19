import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Field, Input } from '../components/ui';
import { LogoMark } from '../components/Logo';
import { useApp } from '../context/AppContext';
export default function Login() {
    const { language, login, setLanguage, t, toast } = useApp();
    const navigate = useNavigate();
    const [id, setId] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            const s = await login({ id, password });
            navigate(s.role === 'teacher' ? '/teacher' : s.role === 'admin' ? '/admin' : '/app');
        }
        catch (err) {
            toast(err instanceof Error ? err.message : t('auth.loginFailed'));
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
        <h2>{t('auth.welcome')}</h2>
        <div className="sub">{t('auth.welcomeSub')}</div>

        <Field label={t('auth.idLabel')} required>
          <Input placeholder={t('auth.idPlaceholder')} value={id} onChange={(e) => setId(e.target.value)}/>
        </Field>
        <Field label={t('auth.password')} required>
          <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)}/>
        </Field>

        <Button pink style={{ width: '100%' }} disabled={busy}>
          {busy ? t('auth.signingIn') : t('common.login')}
        </Button>

        <div className="divider">{t('auth.or')}</div>
        <Button line style={{ width: '100%' }} onClick={() => toast('เปิด LIFF LINE Login (ฟีเจอร์เสริม) — ผูกบัญชีกับ LINE')}>
          {t('auth.lineLogin')}
        </Button>

        <div className="authlink">
          {t('auth.noAccount')} <Link to="/register">{t('common.register')}</Link>
        </div>

        <div className="demohint">
          <b>{t('auth.demo')}</b> {t('roles.student')} <code>mint@email.com</code> / <code>mint123</code><br />
          {t('roles.teacher')} <code>kruaer@email.com</code> / <code>kruaer123</code><br />
          {t('roles.admin')} <code>admin@kruaer.com</code> / <code>admin123</code>
        </div>
      </form>
    </div>);
}
