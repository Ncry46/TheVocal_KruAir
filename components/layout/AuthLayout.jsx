import { lazy, Suspense, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthShell } from './AuthShell';
import { PublicLayout } from './PublicLayout';
import { useApp } from '@app/context/AppContext';

const Login = lazy(() => import('@app/pages/Login'));
const Register = lazy(() => import('@app/pages/Register'));

const AUTH_PATHS = new Set(['/login', '/register']);

function slideMode(previousPath, nextPath) {
    if (previousPath === '/login' && nextPath === '/register') {
        return 'forward';
    }
    if (previousPath === '/register' && nextPath === '/login') {
        return 'back';
    }
    return 'enter';
}

function AuthSlideFallback() {
    const { t } = useApp();
    return <div className="auth-slide-fallback">{t('common.loading')}</div>;
}

export function AuthLayout() {
    const { t } = useApp();
    const location = useLocation();
    const previousPathRef = useRef(location.pathname);
    const modeRef = useRef('enter');

    const previousPath = previousPathRef.current;
    const nextPath = location.pathname;
    if (previousPath !== nextPath) {
        modeRef.current = AUTH_PATHS.has(previousPath) && AUTH_PATHS.has(nextPath)
            ? slideMode(previousPath, nextPath)
            : 'enter';
        previousPathRef.current = nextPath;
    }

    const isRegister = location.pathname === '/register';

    return (
      <PublicLayout footer={false}>
        <AuthShell wide={isRegister}>
          <nav className="auth-mode-switch" aria-label={t('common.login')}>
            <Link
              to="/login"
              className={`auth-mode-btn${isRegister ? '' : ' on'}`}
              replace
            >
              {t('common.login')}
            </Link>
            <Link
              to="/register"
              className={`auth-mode-btn${isRegister ? ' on' : ''}`}
              replace
            >
              {t('common.register')}
            </Link>
            <span className={`auth-mode-indicator${isRegister ? ' right' : ''}`} aria-hidden="true"/>
          </nav>
          <div className={`auth-slide-viewport auth-slide-${modeRef.current}`}>
            <div key={location.pathname} className="auth-slide-panel">
              <Suspense fallback={<AuthSlideFallback />}>
                {isRegister ? <Register /> : <Login />}
              </Suspense>
            </div>
          </div>
        </AuthShell>
      </PublicLayout>
    );
}