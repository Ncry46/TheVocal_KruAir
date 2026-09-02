import { BrandLogo } from '../BrandLogo';
import { useApp } from '@app/context/AppContext';

export function AuthShell({ children, wide = false }) {
    const { t } = useApp();
    const bullets = t('auth.panelBullets');
    const items = Array.isArray(bullets) ? bullets : [];

    return (
      <div className="auth-page">
        <div className={`authwrap auth-split${wide ? ' auth-wide' : ''}`}>
          <aside className="auth-brand-panel">
            <div className="auth-brand-inner">
            <BrandLogo light stacked size={72}/>
              <p className="auth-panel-lead">{t('auth.panelSub')}</p>
              {items.length > 0 && (
                <ul className="auth-panel-list">
                  {items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              )}
              <div className="auth-panel-deco" aria-hidden="true">
                <span/><span/><span/>
              </div>
            </div>
          </aside>
          <div className="auth-form-col">
            <div className={`auth-form-inner${wide ? ' is-scrollable' : ''}`}>
              {children}
            </div>
          </div>
        </div>
      </div>
    );
}
