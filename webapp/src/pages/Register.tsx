import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Field, Input } from '../components/ui'
import { LogoMark } from '../components/Logo'
import { useApp } from '../context/AppContext'

const GENRES = ['Pop', 'Ballad', 'Rock', 'R&B', 'Hip-Hop', 'ลูกทุ่ง', 'Jazz', 'อื่น ๆ']

export default function Register() {
  const { register, toast } = useApp()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [age, setAge] = useState('')
  const [education, setEducation] = useState('')
  const [genres, setGenres] = useState<string[]>([])
  const [reason, setReason] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)

  const toggleGenre = (g: string) =>
    setGenres((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await register({
        name,
        nickname,
        age: Number(age),
        education,
        genres,
        reason,
        consent,
        email,
        password,
      })
      navigate('/app')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'สมัครสมาชิกไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="authwrap">
      <form className="authcard" onSubmit={submit}>
        <LogoMark size={64} />
        <h2>สมัครสมาชิก</h2>
        <div className="sub">กรอกข้อมูลเพื่อให้ครูแอร์ออกแบบคอร์สให้ตรงกับคุณที่สุด</div>

        <Field label="ชื่อจริง" required>
          <Input placeholder="เช่น สมชาย ใจดี" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="ชื่อเล่น" required>
          <Input placeholder="เช่น มิ้นท์" value={nickname} onChange={(e) => setNickname(e.target.value)} />
        </Field>

        <div className="two-col">
          <Field label="อีเมล" required>
            <Input type="email" placeholder="เช่น mint@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="รหัสผ่าน (อย่างน้อย 6 ตัว)" required>
            <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        </div>

        <div className="two-col">
          <Field label="อายุ" required>
            <Input type="number" placeholder="เช่น 22" value={age} onChange={(e) => setAge(e.target.value)} />
          </Field>
          <Field label="ระดับการศึกษา" required>
            <select className="input" value={education} onChange={(e) => setEducation(e.target.value)}>
              <option value="">เลือก</option>
              <option>ม.ต้น</option>
              <option>ม.ปลาย</option>
              <option>ปวช. / ปวส.</option>
              <option>ปริญญาตรี</option>
              <option>ปริญญาโทขึ้นไป</option>
            </select>
          </Field>
        </div>

        <Field label="แนวเพลงที่ชอบ (เลือกได้หลายแนว)" required>
          <div className="genre-row">
            {GENRES.map((g) => (
              <span key={g} className={`chk ${genres.includes(g) ? 'on' : ''}`} onClick={() => toggleGenre(g)}>
                {g}
              </span>
            ))}
          </div>
        </Field>

        <Field label="เหตุผลที่อยากเรียนร้องเพลง" required>
          <textarea
            className="input"
            rows={2}
            placeholder="เช่น อยากออดิชันวงดนตรี / พัฒนาน้ำเสียง…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>

        <div className="consent">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>ข้าพเจ้ายินยอมให้จัดเก็บข้อมูลส่วนบุคคลเพื่อการติดต่อและให้บริการ ตามนโยบาย PDPA</span>
        </div>

        <Button pink style={{ width: '100%' }} disabled={busy}>
          {busy ? 'กำลังสมัคร…' : 'สมัครสมาชิก'}
        </Button>

        <div className="divider">หรือ</div>
        <Button line style={{ width: '100%' }} onClick={() => toast('เปิด LIFF สมัครผ่าน LINE (ฟีเจอร์เสริม) — ข้อมูลจะถูกกรอกอัตโนมัติ')}>
          สมัครด้วย LINE (LIFF)
        </Button>

        <div className="authlink">
          มีบัญชีแล้ว? <Link to="/login">เข้าสู่ระบบ</Link>
        </div>
      </form>
    </div>
  )
}
