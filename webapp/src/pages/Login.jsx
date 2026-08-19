import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Field, Input } from '../components/ui';
import { LogoMark } from '../components/Logo';
import { useApp } from '../context/AppContext';
export default function Login() {
    const { login, toast } = useApp();
    const navigate = useNavigate();
    const [id, setId] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            const s = await login({ id, password });
            navigate(s.role === 'teacher' ? '/teacher' : s.role === 'admin' ? '/admin' : '/app');
        }
        catch (err) {
            toast(err instanceof Error ? err.message : 'เข้าสู่ระบบไม่สำเร็จ');
        }
        finally {
            setBusy(false);
        }
    };
    return (<div className="authwrap">
      <form className="authcard" onSubmit={submit}>
        <LogoMark size={64}/>
        <h2>ยินดีต้อนรับกลับค่า</h2>
        <div className="sub">เข้าสู่ระบบเพื่อจัดการแพ็กเกจและการจองเรียนของคุณ</div>

        <Field label="อีเมล หรือ เบอร์โทรศัพท์" required>
          <Input placeholder="เช่น mint@email.com" value={id} onChange={(e) => setId(e.target.value)}/>
        </Field>
        <Field label="รหัสผ่าน" required>
          <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)}/>
        </Field>

        <Button pink style={{ width: '100%' }} disabled={busy}>
          {busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </Button>

        <div className="divider">หรือ</div>
        <Button line style={{ width: '100%' }} onClick={() => toast('เปิด LIFF LINE Login (ฟีเจอร์เสริม) — ผูกบัญชีกับ LINE')}>
          เข้าสู่ระบบด้วย LINE (LIFF)
        </Button>

        <div className="authlink">
          ยังไม่มีบัญชี? <Link to="/register">สมัครสมาชิกฟรี</Link>
        </div>

        <div className="demohint">
          <b>เดโม่:</b> นักเรียน <code>mint@email.com</code> / <code>mint123</code><br />
          ครูแอร์ <code>kruaer@email.com</code> / <code>kruaer123</code><br />
          แอดมิน <code>admin@kruaer.com</code> / <code>admin123</code>
        </div>
      </form>
    </div>);
}
