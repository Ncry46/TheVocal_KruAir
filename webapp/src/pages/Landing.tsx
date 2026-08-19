import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PublicLayout } from '../components/layout/PublicLayout'
import { Button, Field, Input, Spinner, Stat } from '../components/ui'
import { BellIcon, BookIcon, CalendarIcon, CartIcon, CardIcon, ChartIcon, ChatIcon, ClockIcon, CrownIcon, GraduationIcon, MicIcon, MusicNoteIcon, PhoneIcon, PinIcon, TargetIcon, UserIcon } from '../components/icons'
import { api } from '../lib/api'
import type { PackagePlan } from '../lib/types'
import { useApp } from '../context/AppContext'

const PKG_IMG: Record<string, string> = {
  beginner: '/img/pkg-desk.jpg',
  pro: '/img/pkg-stage.jpg',
  master: '/img/pkg-studio.jpg',
}

export default function Landing() {
  const navigate = useNavigate()
  const { toast } = useApp()
  const [pkgs, setPkgs] = useState<PackagePlan[] | null>(null)

  useEffect(() => {
    api.getPackages().then(setPkgs).catch(() => setPkgs([]))
  }, [])

  /* scroll-reveal animation */
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.reveal'))
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('in'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        })
      },
      { threshold: 0.12 }
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [pkgs])

  return (
    <PublicLayout>
      {/* ===== Hero ===== */}
      <section className="hero">
        <div className="hero-orb" aria-hidden="true" />
        <div className="hero-arch" aria-hidden="true" />
        <div className="hero-staff" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
          <MusicNoteIcon className="sn s1" />
          <MusicNoteIcon className="sn s2" />
        </div>
        <div className="hero-notes" aria-hidden="true">
          <MusicNoteIcon className="hn n1" />
          <MusicNoteIcon className="hn n2" />
          <MusicNoteIcon className="hn n3" />
          <MusicNoteIcon className="hn n4" />
          <MusicNoteIcon className="hn n5" />
        </div>
        <div className="wrap hero-center reveal">
          <div className="hero-orn" aria-hidden="true">
            <i />
            <svg viewBox="0 0 24 24" width={10} height={10} fill="currentColor">
              <path d="M12 2l10 10-10 10L2 12z" />
            </svg>
            <i />
          </div>
          <div className="tagline">เปิดรับสมัครนักเรียนใหม่ · คอร์สเรียนร้องเพลง 1:1</div>
          <h1>
            พัฒนาน้ำเสียงกับ <em>ครูแอร์</em>
            <br />
            เริ่มต้นได้วันนี้ ที่ไหนก็ได้
          </h1>
          <p>
            เรียนร้องเพลงแบบตัวต่อตัว หลักสูตรออกแบบตามแนวเพลงและเป้าหมายของน้องแต่ละคน —
            จองเวลาเรียนเองได้ผ่านเว็บไซต์ แจ้งเตือนก่อนเรียน 1 วัน พร้อมระบบชำระเงินปลอดภัย (บัตรเครดิต / KBank)
          </p>
          <div className="cta">
            <Button pink onClick={() => navigate('/register')}>
              <MicIcon width={17} height={17} /> เริ่มเรียนเลย
            </Button>
            <Button ghost onClick={() => document.getElementById('pkg')?.scrollIntoView({ behavior: 'smooth' })}>
              ดูแพ็กเกจ
            </Button>
          </div>
          <div className="stats">
            <Stat value="120+" label="นักเรียน" />
            <i className="stats-line" aria-hidden="true" />
            <Stat value="2,400+" label="ชั่วโมงสอน" />
            <i className="stats-line" aria-hidden="true" />
            <Stat value="5.0 ★" label="คะแนนรีวิว" />
          </div>
        </div>
      </section>

      {/* ===== แพ็กเกจ ===== */}
      <section className="sec" id="pkg">
        <div className="wrap">
          <div className="sec-h reveal">
            <span className="k">PACKAGES</span>
            <h2>แพ็กเกจเรียน</h2>
            <p>เลือกแพ็กเกจตามเป้าหมาย — ซื้อแล้วสะสมชั่วโมงเรียนได้ตลอด 6 เดือน</p>
          </div>

          {pkgs === null ? (
            <Spinner />
          ) : (
            <div className="grid cols-3" style={{ marginBottom: 18 }}>
              {pkgs.map((p, i) => (
                <div key={p.id} className={`pkg reveal d${i + 1} ${p.tag === 'ยอดนิยม' ? 'popular' : ''}`}>
                  {p.tag && (
                    <div className="crown">
                      <CrownIcon width={13} height={13} /> {p.tag}
                    </div>
                  )}
                  <div className="top">
                    <img src={PKG_IMG[p.id]} alt={p.name} loading="lazy" />
                    <span className="top-em">
                      <MusicNoteIcon width={24} height={24} />
                    </span>
                  </div>
                  <div className="body">
                    <div className="nm">{p.name}</div>
                    <div className="hrs">
                      {p.hours} <small>ชั่วโมง</small>
                    </div>
                    <div className="price">฿{p.price.toLocaleString()}</div>
                    <div className="per">{p.note}</div>
                    <Button pink onClick={() => navigate('/register')}>
                      ซื้อแพ็กเกจนี้
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="termbox reveal">
            <b>
              <PinIcon width={14} height={14} /> เงื่อนไขทุกแพ็กเกจ:
            </b>{' '}
            นับชั่วโมงเมื่อเข้ารับจริง 1 ชม./ครั้ง · แพ็กเกจมีอายุ <b>6 เดือน</b> นับจากวันที่ซื้อ ·
            ไม่สามารถโอนหรือคืนเงินได้ · ใช้ได้เฉพาะคอร์สของครูแอร์เท่านั้น · ชำระผ่านบัตรเครดิต/เดบิต หรือโอนผ่าน <b>KBank</b>
          </div>
        </div>
      </section>

      {/* ===== วิธีเรียน ===== */}
      <section className="sec alt" id="how">
        <div className="wrap">
          <div className="sec-h reveal">
            <span className="k">HOW IT WORKS</span>
            <h2>เริ่มเรียนใน 4 ขั้นตอน</h2>
          </div>
          <div className="grid cols-4">
            {[
              ['1', 'สมัครสมาชิก', 'กรอกข้อมูล 6 ฟิลด์ผ่านเว็บ (หรือผูก LINE ได้)'],
              ['2', 'ซื้อแพ็กเกจ', 'เลือกแพ็กเกจ + ใส่วอเชอร์ส่วนลด + ชำระผ่านบัตร/KBank'],
              ['3', 'จองเวลาเรียน', 'เลือกวัน-เวลาที่ว่าง ระบบล็อกสล็อตให้ทันที'],
              ['4', 'เรียนกับครูแอร์', 'เตือนนัดก่อน 1 วัน → ยืนยันมาเรียน → หักชั่วโมงหลังเรียนจบ'],
            ].map(([n, t, d], i) => (
              <div className={`step reveal d${i + 1}`} key={i}>
                <div className="n">{n}</div>
                <h4>{t}</h4>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== ทำไมต้องเรา ===== */}
      <section className="sec" id="why">
        <div className="wrap">
          <div className="sec-h reveal">
            <span className="k">WHY US</span>
            <h2>ทำไมต้องเรียนกับครูแอร์</h2>
          </div>
          <div className="grid cols-3">
            {[
              [<GraduationIcon key="g" />, 'ครูมากประสบการณ์', 'สอนร้องเพลงกว่า 10 ปี ทั้ง Pop, Ballad, R&B และลูกทุ่ง'],
              [<TargetIcon key="t" />, 'คอร์สตามแนวเพลงที่ชอบ', 'หลักสูตรออกแบบจากแนวเพลงและเป้าหมายของน้อง'],
              [<CalendarIcon key="c" />, 'จองง่าย ทั้งเว็บและ LINE', 'จองเวลาเรียนได้ตลอด 24 ชม. ดูสล็อตว่างแบบเรียลไทม์'],
              [<CardIcon key="cc" />, 'ชำระเงินปลอดภัย', 'บัตรเครดิต/เดบิต หรือโอนผ่านเกตเวย์ KBank ระบบเพิ่มชั่วโมงอัตโนมัติ'],
              [<BellIcon key="b" />, 'แจ้งเตือนก่อนเรียน 1 วัน', 'ยืนยันการมาเรียนผ่านปุ่มเดียว พร้อมระบบเลื่อน/ยกเลิกนัด'],
              [<ChartIcon key="ch" />, 'ติดตามชั่วโมงได้ตลอด', 'ดูชั่วโมงคงเหลือ ประวัติการเรียน และใบเสร็จได้ทันที'],
            ].map(([ic, t, d], i) => (
              <div className={`card feat reveal d${i + 1}`} key={i}>
                <div className="ic">{ic}</div>
                <div>
                  <h4>{t}</h4>
                  <p>{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== พบกับครูแอร์ ===== */}
      <section className="sec teacher" id="teacher">
        <div className="wrap teacher-grid">
          <div className="teacher-photo reveal d1">
            <img src="/img/teacher-studio.jpg" alt="สตูดิโอของครูแอร์" loading="lazy" />
            <div className="teacher-tag">
              <MicIcon width={15} height={15} /> ครูแอร์ · โค้ชเสียง &amp; นักร้อง
            </div>
          </div>
          <div className="teacher-info reveal d2">
            <span className="k">MEET YOUR TEACHER</span>
            <h2>สวัสดีค่ะ น้อง ๆ ครูแอร์เองค่า</h2>
            <p>
              ครูแอร์เป็นนักร้องและโค้ชเสียงมากว่า 10 ปี สอนทั้ง Pop, Ballad, R&amp;B, Hip-Hop และลูกทุ่ง —
              เน้นปรับพื้นฐานเสียงให้ถูกวิธี เรียนกันตัวต่อตัว เพื่อให้ทุกคนร้องเพลงได้อย่างมั่นใจและมีสไตล์เป็นของตัวเอง
            </p>
            <div className="tlist">
              <div>หลักสูตรออกแบบตามแนวเพลงที่ชอบ</div>
              <div>เรียนสด ตัวต่อตัว ผ่านวิดีโอคอล</div>
              <div>ฟีดแบคเป็นไฟล์เสียง + แบบฝึกหัดหลังเรียน</div>
              <div>เหมาะทั้งมือใหม่และนักร้องมืออาชีพ</div>
            </div>
            <Button pink onClick={() => navigate('/register')}>เริ่มเรียนกับครูแอร์</Button>
          </div>
        </div>
      </section>

      {/* ===== รีวิว ===== */}
      <section className="sec alt" id="rev">
        <div className="wrap">
          <div className="sec-h reveal">
            <span className="k">REVIEWS</span>
            <h2>รีวิวจากนักเรียน</h2>
          </div>
          <div className="grid cols-3">
            {[
              ['/img/av-1.jpg', 'น้องมิ้นท์', 'เรียน 12 ชม. · Pop / R&B', 'ครูแอร์อธิบายละเอียดมาก เสียงเราดีขึ้นชัดเจนภายใน 3 คลาส จองเวลาผ่านเว็บง่ายมาก'],
              ['/img/av-2.jpg', 'น้องต้นน้ำ', 'เรียน 15 ชม. · Rock', 'ระบบเตือนนัดก่อนเรียน 1 วันช่วยได้มาก กดยืนยันปุ่มเดียวจบ ขยับเวลาก็ทำผ่านเว็บได้'],
              ['/img/av-3.jpg', 'น้องเฟิร์น', 'เรียน 5 ชม. · Ballad', 'ชอบที่คอร์สออกแบบตามแนวเพลงที่เรากรอกตอนสมัคร จ่ายด้วย K+ สะดวก ได้ใบเสร็จส่งเข้า LINE ด้วย'],
            ].map(([ava, name, meta, text], i) => (
              <div className={`card rev reveal d${i + 1}`} key={i}>
                <div className="stars">★★★★★</div>
                <p>"{text}"</p>
                <div className="who">
                  <div className="ava">
                    <img src={ava} alt={name} loading="lazy" />
                  </div>
                  <div>
                    <b>{name}</b>
                    <span>{meta}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== ฟังก์ชันหลักของระบบ ===== */}
      <section className="sec alt" id="features">
        <div className="wrap">
          <div className="sec-h reveal">
            <span className="k">SYSTEM FEATURES</span>
            <h2>ฟังก์ชันหลักของระบบ</h2>
            <p>ครบวงจรตั้งแต่สมัครจนถึงการเรียนจบ</p>
          </div>
          <div className="grid cols-3">
            {[
              [<UserIcon key="u" />, 'สมัครสมาชิก', 'สมัครผ่านเว็บหรือ LINE LIFF แก้ไข Profile ได้'],
              [<CartIcon key="c" />, 'เลือกแพ็กเกจ', 'แพ็กเกจ 10 / 20 / 30 ชม. พร้อมระบบวอเชอร์ส่วนลด'],
              [<CardIcon key="cd" />, 'ชำระเงินปลอดภัย', 'KBank Payment Gateway + บัตรเครดิต/เดบิต ผ่าน 3-D Secure'],
              [<CalendarIcon key="ca" />, 'จองเวลาเรียน', 'เลือกวัน-เวลาว่างจากปฏิทิน ระบบล็อกสล็อตให้ทันที'],
              [<BellIcon key="b" />, 'แจ้งเตือนอัตโนมัติ', 'เตือนนัดล่วงหน้า 1 วัน + ทวงถาม 6 ชม. ก่อนเข้าเรียน'],
              [<BookIcon key="bk" />, 'บันทึกผลการสอน', 'ครูแอร์บันทึก Class Log หักชั่วโมงอัตโนมัติ 1 ชม./ครั้ง'],
            ].map(([ic, t, d], i) => (
              <div className={`card feat reveal d${i + 1}`} key={i}>
                <div className="ic">{ic}</div>
                <div>
                  <h4>{t}</h4>
                  <p>{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>




      {/* ===== ติดต่อ ===== */}
      <section className="sec contact-section" id="contact">
        <div className="wrap">
          <div className="sec-h reveal">
            <span className="k">CONTACT</span>
            <h2>ติดต่อครูแอร์</h2>
            <p>พร้อมตอบทุกคำถาม · ให้คำปรึกษาฟรี · ทักมาได้เลยค่ะ</p>
          </div>

          {/* Big CTA cards */}
          <div className="contact-cards reveal">
            <div className="cc-item" onClick={() => toast('เปิด LINE ของคุณ')}>
              <div className="cc-icon green">
                <ChatIcon width={28} height={28} />
              </div>
              <div className="cc-info">
                <b>LINE Official</b>
                <span>@kruaersinging</span>
              </div>
              <div className="cc-arrow">→</div>
            </div>

            <div className="cc-item" onClick={() => window.open('tel:09X-XXX-XXXX')}>
              <div className="cc-icon pink">
                <PhoneIcon width={28} height={28} />
              </div>
              <div className="cc-info">
                <b>โทร / LINE Call</b>
                <span>09X-XXX-XXXX</span>
              </div>
              <div className="cc-arrow">→</div>
            </div>

            <div className="cc-item" onClick={() => toast('เปิด Google Maps')}>
              <div className="cc-icon wine">
                <PinIcon width={28} height={28} />
              </div>
              <div className="cc-info">
                <b>สตูดิโอ</b>
                <span>กรุงเทพฯ (ส่งที่อยู่ในแชต)</span>
              </div>
              <div className="cc-arrow">→</div>
            </div>

            <div className="cc-item">
              <div className="cc-icon violet">
                <ClockIcon width={28} height={28} />
              </div>
              <div className="cc-info">
                <b>เวลาทำการ</b>
                <span>อ.–อา. 10:00–20:00 น.</span>
              </div>
            </div>
          </div>

          {/* Contact form */}
          <div className="contact-form-card reveal d2">
            <div className="cf-header">
              <h3>ส่งข้อความถึงครูแอร์</h3>
              <p>กรอกข้อมูลด้านล่าง ครูแอร์จะติดต่อกลับภายใน 24 ชม.</p>
            </div>
            <div className="cf-form">
              <div className="two-col">
                <Field label="ชื่อ">
                  <Input placeholder="ชื่อเล่นของคุณ" />
                </Field>
                <Field label="LINE ID / เบอร์โทร">
                  <Input placeholder="สำหรับติดต่อกลับ" />
                </Field>
              </div>
              <Field label="ข้อความ">
                <textarea className="input" rows={3} placeholder="สอบถามแพ็กเกจ ตารางเรียน หรืออื่นๆ…" />
              </Field>
              <Button pink style={{ width: '100%', padding: '14px 28px' }} onClick={() => toast('ส่งข้อความแล้ว — ครูแอร์จะติดต่อกลับภายใน 24 ชม.', 'ok')}>
                <ChatIcon width={16} height={16} /> ส่งข้อความ
              </Button>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  )
}
