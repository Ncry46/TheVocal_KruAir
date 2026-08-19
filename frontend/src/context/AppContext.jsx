import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { translations } from '../i18n/translations';
import { api, getToken } from '../services/apiClient';
const AppContext = createContext(null);
const STORAGE_KEY = 'kruaer-session';
const LANGUAGE_KEY = 'kruaer-language';
const THEME_KEY = 'kruaer-theme';
function loadUser() {
    try {
        if (!getToken()) {
            return null;
        }
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    }
    catch {
        return null;
    }
}
function loadPreference(key, fallback) {
    try {
        return localStorage.getItem(key) || fallback;
    }
    catch {
        return fallback;
    }
}
export function AppProvider({ children }) {
    const [user, setUser] = useState(loadUser);
    const [toastState, setToastState] = useState(null);
    const [language, setLanguageState] = useState(() => loadPreference(LANGUAGE_KEY, 'th'));
    const [theme, setThemeState] = useState(() => loadPreference(THEME_KEY, 'light'));
    const timer = useRef(null);
    useEffect(() => {
        document.documentElement.lang = language;
        try {
            localStorage.setItem(LANGUAGE_KEY, language);
        }
        catch {
            /* ignore quota/private-mode errors */
        }
    }, [language]);
    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        try {
            localStorage.setItem(THEME_KEY, theme);
        }
        catch {
            /* ignore quota/private-mode errors */
        }
    }, [theme]);
    const t = useCallback(
        (key) => key.split('.').reduce((node, part) => node?.[part], translations[language]) ?? key,
        [language],
    );
    const setLanguage = useCallback((nextLanguage) => {
        setLanguageState(nextLanguage === 'en' ? 'en' : 'th');
    }, []);
    const toggleTheme = useCallback(() => {
        setThemeState((current) => (current === 'dark' ? 'light' : 'dark'));
    }, []);
    const toast = useCallback((message, type = 'info') => {
        if (timer.current)
            clearTimeout(timer.current);
        setToastState({ id: Date.now(), message, type });
        timer.current = setTimeout(() => setToastState(null), 2800);
    }, []);
    const setSession = useCallback((s) => {
        setUser(s);
        try {
            if (s)
                localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
            else
                localStorage.removeItem(STORAGE_KEY);
        }
        catch {
            /* ignore quota/private-mode errors */
        }
    }, []);
    const login = useCallback(async (input) => {
        const s = await api.login(input);
        setSession(s);
        toast(language === 'en' ? `Welcome back, ${s.nickname}` : `ยินดีต้อนรับกลับค่า น้อง${s.nickname}`, 'ok');
        return s;
    }, [language, setSession, toast]);
    const register = useCallback(async (input) => {
        const s = await api.register(input);
        setSession(s);
        toast(language === 'en' ? `Account created. Welcome, ${s.nickname}` : `สมัครสมาชิกสำเร็จ ยินดีต้อนรับน้อง${s.nickname}`, 'ok');
        return s;
    }, [language, setSession, toast]);
    const logout = useCallback(() => {
        api.logout();
        setSession(null);
        toast(language === 'en' ? 'Logged out — back to website' : 'ออกจากระบบแล้ว — กลับสู่หน้าเว็บไซต์');
    }, [language, setSession, toast]);
    const value = useMemo(
        () => ({ user, login, register, logout, toast, language, setLanguage, theme, toggleTheme, t }),
        [user, login, register, logout, toast, language, setLanguage, theme, toggleTheme, t],
    );
    return (<AppContext.Provider value={value}>
      {children}
      {toastState && (<div key={toastState.id} className={`toast show ${toastState.type === 'ok' ? 'ok' : ''}`}>
          {toastState.message}
        </div>)}
    </AppContext.Provider>);
}
export function useApp() {
    const ctx = useContext(AppContext);
    if (!ctx)
        throw new Error('useApp must be used within AppProvider');
    return ctx;
}
