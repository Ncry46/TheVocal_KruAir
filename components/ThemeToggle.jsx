import { useApp } from '@app/context/AppContext';
import { MoonIcon, SunIcon } from './icons';

export function ThemeToggle() {
    const { t, theme, toggleTheme } = useApp();
    const isDark = theme === 'dark';
    const label = isDark ? t('common.themeLight') : t('common.themeDark');

    return (
      <button
        type="button"
        className="theme-toggle"
        aria-label={label}
        title={label}
        onClick={toggleTheme}
      >
        {isDark ? <SunIcon /> : <MoonIcon />}
      </button>
    );
}
