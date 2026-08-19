import { useApp } from '@app/context/AppContext';
import { MoonIcon, SunIcon } from './icons';

export function ThemeToggle() {
    const { setTheme, t, theme } = useApp();
    return (
        <div className="theme-toggle" role="group" aria-label={`${t('common.themeLight')} / ${t('common.themeDark')}`}>
            <button
                type="button"
                className={theme === 'light' ? 'on' : ''}
                aria-label={t('common.themeLight')}
                aria-pressed={theme === 'light'}
                title={t('common.themeLight')}
                onClick={() => setTheme('light')}
            >
                <SunIcon />
            </button>
            <button
                type="button"
                className={theme === 'dark' ? 'on' : ''}
                aria-label={t('common.themeDark')}
                aria-pressed={theme === 'dark'}
                title={t('common.themeDark')}
                onClick={() => setTheme('dark')}
            >
                <MoonIcon />
            </button>
        </div>
    );
}
