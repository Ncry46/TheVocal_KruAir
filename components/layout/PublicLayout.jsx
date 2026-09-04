import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../ui';
import { BrandLogo } from '../BrandLogo';
import { ThemeToggle } from '../ThemeToggle';
import { useApp } from '@app/context/AppContext';
import { avatarSrc, dashboardPath, profilePath } from '@app/utils/avatar';

export function PublicLayout({ children, footer = true }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { language, setLanguage, t, user } = useApp();
    const [navOpen, setNavOpen] = useState(false);
    const goHome = () => navigate('/');
    const roleLabel = user?.role === 'teacher' || user?.role === 'admin'
        ? t('roles.teacher')
        : t('roles.student');
    const closeNav = useCallback(() => setNavOpen(false), []);
    useEffect(() => {
        const root = document.documentElement;
        const onScroll = () => {
            const max = root.scrollHeight - root.clientHeight;
            const pct = max > 0 ? root.scrollTop / max : 0;
            root.style.setProperty('--scroll', String(pct));
        };
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);
    const go = (id) => {
        closeNav();
        if (location.pathname === '/') {
            document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
            return;
        }
        navigate(`/#${id}`);
    };
    const goPackages = () => {
        closeNav();
        if (user?.role === 'student') {
            navigate('/app/packages');
            return;
        }
        go('pkg');
    };
    const navLinks = [
        { label: t('nav.packages'), action: goPackages },
        { label: t('nav.how'), action: () => go('how') },
        { label: t('nav.why'), action: () => go('why') },
    ];
    return (<>
      <div className="scroll-progress" aria-hidden="true"/>
      <header className="snav">
        <div className="wrap nav-row">
          <BrandLogo size={44} onClick={goHome}/>
          <nav className="nav-desktop">
            {navLinks.map((item) => (
              <a key={item.label} onClick={item.action}>{item.label}</a>
            ))}
          </nav>
          <div className="nav-actions">
            <button
              type="button"
              className="nav-menu-btn"
              aria-label={language === 'en' ? 'Open menu' : 'เปิดเมนู'}
              onClick={() => setNavOpen(true)}
            >
              ☰
            </button>
            <button className="pref-btn" type="button" onClick={() => setLanguage(language === 'th' ? 'en' : 'th')}>
              {language === 'th' ? 'EN' : 'TH'}
            </button>
            <ThemeToggle />
            {user ? (
              <button type="button" className="user" title={t('nav.profile')} onClick={() => navigate(profilePath(user))}>
                <div className="ava">
                  <img src={avatarSrc(user)} alt={user.nickname ?? user.name ?? ''}/>
                </div>
                <div className="user-text">
                  <div className="nm">{user.nickname ?? user.name ?? ''}</div>
                  <div className="rl">{roleLabel}</div>
                </div>
              </button>
            ) : (
              <>
                <Button ghost size="sm" className="nav-login-btn" onClick={() => navigate('/login')}>
                  {t('common.login')}
                </Button>
                <Button pink size="sm" className="nav-register-btn" onClick={() => navigate('/register')}>
                  {t('common.register')}
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className={`pub-nav-panel ${navOpen ? 'open' : ''}`}>
        <div className="pub-nav-head">
          <BrandLogo size={36} onClick={() => { goHome(); closeNav(); }}/>
          <button type="button" className="x" onClick={closeNav} aria-label={language === 'en' ? 'Close menu' : 'ปิดเมนู'}>
            ✕
          </button>
        </div>
        <nav className="pub-nav-links">
          {navLinks.map((item) => (
            <button key={item.label} type="button" onClick={item.action}>{item.label}</button>
          ))}
        </nav>
        {!user && (
          <div className="pub-nav-actions">
            <Button ghost onClick={() => { closeNav(); navigate('/login'); }}>{t('common.login')}</Button>
            <Button pink onClick={() => { closeNav(); navigate('/register'); }}>{t('common.register')}</Button>
          </div>
        )}
      </div>
      {navOpen && <div className="pub-nav-overlay" onClick={closeNav}/>}

      {children}

      {footer && (<footer>
        <div className="wrap footer-grid">
          <div>
            <BrandLogo light stacked size={44} style={{ marginBottom: 14 }} onClick={goHome}/>
            <p style={{ fontSize: 12, lineHeight: 1.7, color: 'rgba(255,255,255,0.55)', maxWidth: 300 }}>
              {t('public.footerText')}
            </p>
          </div>
          <div>
            <h5>{t('public.menu')}</h5>
            <a onClick={goPackages}>{t('nav.packages')}</a>
            <a onClick={() => go('how')}>{t('nav.how')}</a>
            <a onClick={() => go('why')}>{t('nav.why')}</a>
          </div>
          <div>
            <h5>{t('public.account')}</h5>
            {user ? (
              <>
                <a onClick={() => navigate(dashboardPath(user))}>
                  {user.role === 'teacher' || user.role === 'admin' ? t('nav.schedule') : t('nav.studentHome')}
                </a>
                <a onClick={() => navigate(profilePath(user))}>{t('nav.profile')}</a>
              </>
            ) : (
              <>
                <a onClick={() => navigate('/login')}>{t('common.login')}</a>
                <a onClick={() => navigate('/register')}>{t('common.register')}</a>
              </>
            )}
          </div>
          <div>
            <h5>{t('nav.system')}</h5>
            <a onClick={() => navigate('/login')}>{t('public.lineOfficial')}</a>
            <a onClick={() => navigate('/privacy')}>{t('public.pdpa')}</a>
            <a onClick={() => navigate('/terms')}>{t('public.terms')}</a>
          </div>
        </div>
        <div className="wrap">
          <div className="copy">
            {t('public.copy')}
          </div>
        </div>
      </footer>)}
    </>);
}
