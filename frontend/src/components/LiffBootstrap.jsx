import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ensureLiffAppSession, initLiff } from '../services/liff';

export function LiffBootstrap() {
    const { setSession, setLiffBooting, t, toast } = useApp();
    const navigate = useNavigate();

    useEffect(() => {
        let cancelled = false;
        setLiffBooting(true);
        (async () => {
            try {
                const boot = await initLiff();
                if (!boot.configured) {
                    if (!cancelled) {
                        setLiffBooting(false);
                    }
                    return;
                }
                if (!boot.inClient) {
                    if (!cancelled) {
                        setLiffBooting(false);
                    }
                    return;
                }
                const result = await ensureLiffAppSession({
                    onNeedRegister: (ticket) => {
                        if (!cancelled) {
                            navigate(`/register?lineTicket=${encodeURIComponent(ticket)}`, { replace: true });
                        }
                    },
                    onLoggedIn: (user) => {
                        if (!cancelled && user) {
                            setSession(user);
                        }
                    },
                });
                if (cancelled || result.redirecting || result.needRegister) {
                    return;
                }
            }
            catch (err) {
                if (!cancelled) {
                    toast(err instanceof Error ? err.message : t('auth.lineFailed'));
                }
            }
            finally {
                if (!cancelled) {
                    setLiffBooting(false);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [navigate, setLiffBooting, setSession, t, toast]);

    return null;
}
