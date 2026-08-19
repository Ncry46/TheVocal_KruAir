import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
const AppContext = createContext(null);
const STORAGE_KEY = 'kruaer-session';
function loadUser() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    }
    catch {
        return null;
    }
}
export function AppProvider({ children }) {
    const [user, setUser] = useState(loadUser);
    const [toastState, setToastState] = useState(null);
    const timer = useRef(null);
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
        toast(`ยินดีต้อนรับกลับค่า น้อง${s.nickname}`, 'ok');
        return s;
    }, [setSession, toast]);
    const register = useCallback(async (input) => {
        const s = await api.register(input);
        setSession(s);
        toast(`สมัครสมาชิกสำเร็จ ยินดีต้อนรับน้อง${s.nickname}`, 'ok');
        return s;
    }, [setSession, toast]);
    const logout = useCallback(() => {
        setSession(null);
        toast('ออกจากระบบแล้ว — กลับสู่หน้าเว็บไซต์');
    }, [setSession, toast]);
    const value = useMemo(() => ({ user, login, register, logout, toast }), [user, login, register, logout, toast]);
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
