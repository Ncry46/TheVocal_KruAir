import { type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../ui'
import { Logo } from '../Logo'

export function PublicLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()

  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

  return (
    <>
      <header className="snav">
        <div className="wrap nav-row">
          <Logo size={44} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
          <nav>
            <a onClick={() => go('pkg')}>แพ็กเกจ</a>
            <a onClick={() => go('how')}>วิธีเรียน</a>
            <a onClick={() => go('why')}>ทำไมต้องเรา</a>
            <a onClick={() => go('rev')}>รีวิว</a>
            <a onClick={() => go('contact')}>ติดต่อ</a>
          </nav>
          <div className="nav-actions">
            <Button ghost size="sm" onClick={() => navigate('/login')}>
              เข้าสู่ระบบ
            </Button>
            <Button pink size="sm" onClick={() => navigate('/register')}>
              สมัครสมาชิก
            </Button>
          </div>
        </div>
      </header>

      {children}

      <footer>
        <div className="wrap footer-grid">
          <div>
            <Logo light size={40} text="ครูแอร์ Singing School" style={{ marginBottom: 14 }} />
            <p style={{ fontSize: 12, lineHeight: 1.7, color: '#8f96c2', maxWidth: 300 }}>
              โรงเรียนสอนร้องเพลงแบบตัวต่อตัว หลักสูตรตามแนวเพลงที่ชอบ พร้อมระบบจองเวลาเรียนออนไลน์และชำระเงินปลอดภัย
            </p>
          </div>
          <div>
            <h5>เมนู</h5>
            <a onClick={() => go('pkg')}>แพ็กเกจ</a>
            <a onClick={() => go('how')}>วิธีเรียน</a>
            <a onClick={() => go('rev')}>รีวิว</a>
            <a onClick={() => go('contact')}>ติดต่อ</a>
          </div>
          <div>
            <h5>บัญชี</h5>
            <a onClick={() => navigate('/login')}>เข้าสู่ระบบ</a>
            <a onClick={() => navigate('/register')}>สมัครสมาชิก</a>
          </div>
          <div>
            <h5>ระบบ</h5>
            <a onClick={() => navigate('/login')}>LINE Official (ฟีเจอร์เสริม)</a>
            <a>นโยบาย PDPA</a>
            <a>เงื่อนไขการใช้บริการ</a>
          </div>
        </div>
        <div className="wrap">
          <div className="copy">
            © 2026 ครูแอร์ Singing School · เว็บแอปพลิเคชัน (React + TypeScript) · LINE OA เป็นฟีเจอร์เสริม
          </div>
        </div>
      </footer>
    </>
  )
}
