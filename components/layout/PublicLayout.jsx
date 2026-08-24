import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../ui';
import { Logo } from '../Logo';
import { ThemeToggle } from '../ThemeToggle';
import { useApp } from '@app/context/AppContext';
import { avatarSrc, profilePath } from '@app/utils/avatar';

export function PublicLayout({ children, footer = true }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { language, setLanguage, t, user } = useApp();
    const goHome = () => navigate('/');
    const roleLabel = user?.role === 'teacher'
        ? t('roles.teacher')
        : user?.role === 'admin'
            ? t('roles.admin')
            : t('roles.student');
    const go = (id) => {
        if (location.pathname === '/') {
            document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
            return;
        }
        navigate(`/#${id}`);
    };
    const goPackages = () => {
        if (user?.role === 'student') {
            navigate('/app/packages');
            return;
        }
        go('pkg');
    };
    return (<>
      <header className="snav">
        <div className="wrap nav-row">
          <Logo size={44} onClick={goHome}/>
          <nav>
            <a onClick={goPackages}>{t('nav.packages')}</a>
            <a onClick={() => go('how')}>{t('nav.how')}</a>
            <a onClick={() => go('why')}>{t('nav.why')}</a>
            <a onClick={() => go('rev')}>{t('nav.reviews')}</a>
            <a onClick={() => go('contact')}>{t('nav.contact')}</a>
          </nav>
          <div className="nav-actions">
            <button className="pref-btn" type="button" onClick={() => setLanguage(language === 'th' ? 'en' : 'th')}>
              {language === 'th' ? 'EN' : 'TH'}
            </button>
            <ThemeToggle />
            {user ? (
              <button type="button" className="user" title={t('nav.profile')} onClick={() => navigate(profilePath(user))}>
                <div className="ava">
                  <img src={avatarSrc(user)} alt={user.nickname ?? user.name ?? ''}/>
                </div>
                <div>
                  <div className="nm">{user.nickname ?? user.name ?? ''}</div>
                  <div className="rl">{roleLabel}</div>
                </div>
              </button>
            ) : (
              <>
                <Button ghost size="sm" onClick={() => navigate('/login')}>
                  {t('common.login')}
                </Button>
                <Button pink size="sm" onClick={() => navigate('/register')}>
                  {t('common.register')}
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {children}

      {footer && (<footer>
        <div className="wrap footer-grid">
          <div>
            <Logo light size={40} text="ครูแอร์ Singing School" style={{ marginBottom: 14 }}/>
            <p style={{ fontSize: 12, lineHeight: 1.7, color: '#8f96c2', maxWidth: 300 }}>
              {t('public.footerText')}
            </p>
          </div>
          <div>
            <h5>{t('public.menu')}</h5>
            <a onClick={goPackages}>{t('nav.packages')}</a>
            <a onClick={() => go('how')}>{t('nav.how')}</a>
            <a onClick={() => go('rev')}>{t('nav.reviews')}</a>
            <a onClick={() => go('contact')}>{t('nav.contact')}</a>
          </div>
          <div>
            <h5>{t('public.account')}</h5>
            <a onClick={() => navigate('/login')}>{t('common.login')}</a>
            <a onClick={() => navigate('/register')}>{t('common.register')}</a>
          </div>
          <div>
            <h5>{t('nav.system')}</h5>
            <a onClick={() => navigate('/login')}>{t('public.lineOfficial')}</a>
            <a>{t('public.pdpa')}</a>
            <a>{t('public.terms')}</a>
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
