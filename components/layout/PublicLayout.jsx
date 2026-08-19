import { useNavigate } from 'react-router-dom';
import { Button } from '../ui';
import { Logo } from '../Logo';
import { useApp } from '@app/context/AppContext';
export function PublicLayout({ children }) {
    const navigate = useNavigate();
    const { language, setLanguage, t } = useApp();
    const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    return (<>
      <header className="snav">
        <div className="wrap nav-row">
          <Logo size={44} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}/>
          <nav>
            <a onClick={() => go('pkg')}>{t('nav.packages')}</a>
            <a onClick={() => go('how')}>{t('nav.how')}</a>
            <a onClick={() => go('why')}>{t('nav.why')}</a>
            <a onClick={() => go('rev')}>{t('nav.reviews')}</a>
            <a onClick={() => go('contact')}>{t('nav.contact')}</a>
          </nav>
          <div className="nav-actions">
            <button className="pref-btn" type="button" onClick={() => setLanguage(language === 'th' ? 'en' : 'th')}>
              {language === 'th' ? 'EN' : 'TH'}
            </button>
            <Button ghost size="sm" onClick={() => navigate('/login')}>
              {t('common.login')}
            </Button>
            <Button pink size="sm" onClick={() => navigate('/register')}>
              {t('common.register')}
            </Button>
          </div>
        </div>
      </header>

      {children}

      <footer>
        <div className="wrap footer-grid">
          <div>
            <Logo light size={40} text="ครูแอร์ Singing School" style={{ marginBottom: 14 }}/>
            <p style={{ fontSize: 12, lineHeight: 1.7, color: '#8f96c2', maxWidth: 300 }}>
              {t('public.footerText')}
            </p>
          </div>
          <div>
            <h5>{t('public.menu')}</h5>
            <a onClick={() => go('pkg')}>{t('nav.packages')}</a>
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
      </footer>
    </>);
}
