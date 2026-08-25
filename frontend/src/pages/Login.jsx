import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Field, Input } from '@components/ui';
import { LogoMark } from '@components/Logo';
import { PublicLayout } from '@components/layout/PublicLayout';
import { useApp } from '../context/AppContext';
import { homePath } from '@app/utils/avatar';
import { beginLineLogin } from '../services/lineAuth';

export default function Login() {
    const { login, completeLineSession, t, toast } = useApp();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [id, setId] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [lineBusy, setLineBusy] = useState(false);

    useEffect(() => {
        const token = searchParams.get('token');
        const lineError = searchParams.get('lineError');
        const next = searchParams.get('next');
        if (!token && !lineError) {
            return undefined;
        }
        if (lineError) {
            const key = `auth.lineError.${lineError}`;
            const message = t(key);
            toast(message === key ? t('auth.lineFailed') : message);
            navigate('/login', { replace: true });
            return undefined;
        }
        let cancelled = false;
        (async () => {
            try {
                const session = await completeLineSession(token, {
                    silent: Boolean(next && next.includes('line=linked')),
                });
                if (!cancelled) {
                    const target = next && next.startsWith('/') && !next.startsWith('//')
                        ? next
                        : homePath(session);
                    navigate(target, { replace: true });
                }
            }
            catch (err) {
                if (!cancelled) {
                    toast(err instanceof Error ? err.message : t('auth.loginFailed'));
                    navigate('/login', { replace: true });
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [completeLineSession, navigate, searchParams, t, toast]);

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            const session = await login({ id, password });
            navigate(homePath(session));
        }
        catch (err) {
            toast(err instanceof Error ? err.message : t('auth.loginFailed'));
        }
        finally {
            setBusy(false);
        }
    };

    const onLine = async (event) => {
        event.preventDefault();
        setLineBusy(true);
        try {
            await beginLineLogin('login');
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
            <h2>{t('auth.welcome')}</h2>
            <div className="sub">{t('auth.welcomeSub')}</div>

            <Field label={t('auth.idLabel')} required>
              <Input placeholder={t('auth.idPlaceholder')} value={id} onChange={(e) => setId(e.target.value)}/>
            </Field>
            <Field label={t('auth.password')} required>
              <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)}/>
            </Field>

            <Button pink style={{ width: '100%' }} disabled={busy || lineBusy}>
              {busy ? t('auth.signingIn') : t('common.login')}
            </Button>

            <div className="divider">{t('auth.or')}</div>
            <Button line type="button" style={{ width: '100%' }} disabled={busy || lineBusy} onClick={onLine}>
              {lineBusy ? t('auth.lineConnecting') : t('auth.lineLogin')}
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
        </div>
      </PublicLayout>
    );
}
