import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import type { LoginInput, RegisterInput, Student } from '../lib/types'
import { api } from '../lib/api'

interface ToastState {
  id: number
  message: string
  type: 'ok' | 'info'
}

interface AppContextValue {
  user: Student | null
  login: (input: LoginInput) => Promise<Student>
  register: (input: RegisterInput) => Promise<Student>
  logout: () => void
  toast: (message: string, type?: 'ok' | 'info') => void
}

const AppContext = createContext<AppContextValue | null>(null)

const STORAGE_KEY = 'kruaer-session'

function loadUser(): Student | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Student) : null
  } catch {
    return null
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Student | null>(loadUser)
  const [toastState, setToastState] = useState<ToastState | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toast = useCallback((message: string, type: 'ok' | 'info' = 'info') => {
    if (timer.current) clearTimeout(timer.current)
    setToastState({ id: Date.now(), message, type })
    timer.current = setTimeout(() => setToastState(null), 2800)
  }, [])

  const setSession = useCallback((s: Student | null) => {
    setUser(s)
    try {
      if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore quota/private-mode errors */
    }
  }, [])

  const login = useCallback(
    async (input: LoginInput) => {
      const s = await api.login(input)
      setSession(s)
      toast(`ยินดีต้อนรับกลับค่า น้อง${s.nickname}`, 'ok')
      return s
    },
    [setSession, toast],
  )

  const register = useCallback(
    async (input: RegisterInput) => {
      const s = await api.register(input)
      setSession(s)
      toast(`สมัครสมาชิกสำเร็จ ยินดีต้อนรับน้อง${s.nickname}`, 'ok')
      return s
    },
    [setSession, toast],
  )

  const logout = useCallback(() => {
    setSession(null)
    toast('ออกจากระบบแล้ว — กลับสู่หน้าเว็บไซต์')
  }, [setSession, toast])

  const value = useMemo(
    () => ({ user, login, register, logout, toast }),
    [user, login, register, logout, toast],
  )

  return (
    <AppContext.Provider value={value}>
      {children}
      {toastState && (
        <div key={toastState.id} className={`toast show ${toastState.type === 'ok' ? 'ok' : ''}`}>
          {toastState.message}
        </div>
      )}
    </AppContext.Provider>
  )
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
