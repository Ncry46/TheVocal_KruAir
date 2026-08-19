import type {
  AdminSlot,
  AppNotification,
  BookingSummary,
  DaySlot,
  LessonHistory,
  LoginInput,
  MoveRequest,
  MyLesson,
  PackagePlan,
  PackageStatus,
  Purchase,
  RegisterInput,
  Role,
  Sale,
  SalesReport,
  Student,
  StudentRow,
  Voucher,
} from './types'
import {
  adminSlots,
  bookingSummary,
  currentUser,
  teacherProfile,
  days,
  history,
  moveRequests,
  myLessons,
  notifications,
  packageStatus,
  packages,
  receipts,
  salesReport,
  slotsByDay,
  studentRows,
  voucherCodes,
  vouchers,
} from './data'

const delay = (ms = 450) => new Promise((r) => setTimeout(r, ms))

/**
 * Mock DB — จำลองฐานข้อมูลจริง: ข้อมูลที่เปลี่ยนได้ (ใบเสร็จ, ชั่วโมงคงเหลือ, ประวัติ)
 * จะ persist ไว้ใน localStorage เพื่อให้เวิร์กโฟลว์ต่อเนื่องแม้ refresh หน้า
 */
const DB_KEY = 'kruaer-mock-db'

interface MockAccount {
  id: string
  email: string
  phone?: string
  password: string
  role: Role
  profile: Student
}

interface MockDB {
  receipts: Purchase[]
  packageStatus: PackageStatus
  history: LessonHistory[]
  lessons: MyLesson[]
  notifications: AppNotification[]
  moveRequests: MoveRequest[]
  accounts: MockAccount[]
}

const adminProfile: Student = {
  ...currentUser,
  id: 'admin-001',
  name: 'แอดมิน',
  nickname: 'แอดมิน',
  role: 'admin',
  lineLinked: true,
}

function seedAccounts(): MockAccount[] {
  return [
    {
      id: currentUser.id,
      email: 'mint@email.com',
      phone: '0800000001',
      password: 'mint123',
      role: 'student',
      profile: { ...currentUser },
    },
    {
      id: teacherProfile.id,
      email: 'kruaer@email.com',
      password: 'kruaer123',
      role: 'teacher',
      profile: { ...teacherProfile },
    },
    {
      id: 'admin-001',
      email: 'admin@kruaer.com',
      password: 'admin123',
      role: 'admin',
      profile: { ...adminProfile },
    },
  ]
}

function seedDB(): MockDB {
  return {
    receipts: [...receipts],
    packageStatus: { ...packageStatus },
    history: [...history],
    lessons: myLessons.map((l) => ({ ...l })),
    notifications: notifications.map((n) => ({ ...n })),
    moveRequests: moveRequests.map((r) => ({ ...r })),
    accounts: seedAccounts(),
  }
}

function loadDB(): MockDB {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) return { ...seedDB(), ...(JSON.parse(raw) as MockDB) }
  } catch {
    /* ignore corrupt storage */
  }
  return seedDB()
}

const db = loadDB()
const saveDB = () => {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db))
  } catch {
    /* ignore quota/private-mode errors */
  }
}

/** Mock API — จำลอง backend จริง: มี latency, validate, error */
export const api = {
  async login(input: LoginInput): Promise<Student> {
    await delay()
    const id = input.id.trim().toLowerCase()
    if (!id || !input.password.trim()) {
      throw new Error('กรุณากรอกอีเมล/เบอร์โทร และรหัสผ่าน')
    }
    const acc = db.accounts.find(
      (a) => a.email.toLowerCase() === id || (a.phone != null && a.phone === id),
    )
    if (!acc || acc.password !== input.password) {
      throw new Error('อีเมล/เบอร์ หรือรหัสผ่านไม่ถูกต้อง')
    }
    return { ...acc.profile }
  },

  async register(input: RegisterInput): Promise<Student> {
    await delay()
    if (!input.name || !input.nickname || !input.age || !input.education || input.genres.length === 0 || !input.reason) {
      throw new Error('กรุณากรอกข้อมูลให้ครบทุกช่อง')
    }
    if (!input.consent) throw new Error('กรุณายอมรับนโยบาย PDPA')
    const email = input.email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('กรุณากรอกอีเมลให้ถูกต้อง')
    if (db.accounts.some((a) => a.email.toLowerCase() === email)) {
      throw new Error('อีเมลนี้ลงทะเบียนแล้ว — เข้าสู่ระบบเลย')
    }
    if (input.password.length < 6) throw new Error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร')
    const s: Student = {
      ...currentUser,
      id: `stu-${Date.now()}`,
      name: input.name,
      nickname: input.nickname,
      age: input.age,
      education: input.education,
      genres: input.genres,
      reason: input.reason,
      email,
      role: 'student',
    }
    db.accounts.unshift({ id: s.id, email, password: input.password, role: 'student', profile: s })
    saveDB()
    return s
  },

  async getPackages(): Promise<PackagePlan[]> {
    await delay(300)
    return packages
  },

  async getPackageStatus(): Promise<PackageStatus> {
    await delay(300)
    return db.packageStatus
  },

  async getHistory(): Promise<LessonHistory[]> {
    await delay(300)
    return db.history
  },

  async getReceipts(): Promise<Purchase[]> {
    await delay(300)
    return db.receipts
  },

  async getDays(): Promise<string[]> {
    await delay(250)
    return days
  },

  async getSlots(day: string): Promise<DaySlot[]> {
    await delay(350)
    return slotsByDay[day] ?? slotsByDay['จ. 19']
  },

  async getBookingSummary(day: string, time: string): Promise<BookingSummary> {
    await delay(300)
    return { ...bookingSummary, day, time, leftHours: db.packageStatus.left }
  },

  async createBooking(day: string, time: string): Promise<void> {
    await delay(600)
    db.lessons.unshift({
      id: `L${Date.now()}`,
      date: day,
      time: `${time}–${String(Number(time.split(':')[0]) + 1).padStart(2, '0')}:00 น.`,
      teacher: 'ครูแอร์ (เรียนสด 1:1)',
      status: 'pending',
      topic: 'คอร์สตามแนวเพลงที่ชอบ',
    })
    db.notifications.unshift({
      id: `N${Date.now()}`,
      title: 'จองเวลาเรียนสำเร็จ',
      body: `ล็อกสล็อต ${day} ${time} น. แล้ว — ระบบจะเตือนนัดก่อนเรียน 1 วัน`, 
      time: 'เมื่อกี้นี้',
      read: false,
      tone: 'blue',
    })
    saveDB()
  },

  async getMyLessons(): Promise<MyLesson[]> {
    await delay(300)
    return db.lessons
  },

  async confirmLesson(id: string): Promise<void> {
    await delay(400)
    const l = db.lessons.find((x) => x.id === id)
    if (!l) throw new Error('ไม่พบคลาสที่เลือก')
    l.status = 'confirmed'
    db.notifications.unshift({
      id: `N${Date.now()}`,
      title: 'ยืนยันนัดเรียนแล้ว',
      body: `ยืนยันการมาเรียน ${l.date} ${l.time} เรียบร้อย — แล้วพบกันนะครับ`, 
      time: 'เมื่อกี้นี้',
      read: false,
      tone: 'green',
    })
    saveDB()
  },

  async requestMoveLesson(id: string, newDay: string, newTime: string): Promise<void> {
    await delay(500)
    const l = db.lessons.find((x) => x.id === id)
    if (!l) throw new Error('ไม่พบคลาสที่เลือก')
    l.status = 'moved'
    const to = `${newDay} ${newTime}`
    db.moveRequests.unshift({
      id: `MR${Date.now()}`,
      student: `น้อง${currentUser.nickname}`,
      from: `${l.date} ${l.time}`,
      to,
      at: 'เมื่อกี้นี้',
      status: 'รออนุมัติ',
      lessonId: l.id,
      newDay,
      newTime: `${newTime}–${String(Number(newTime.split(':')[0]) + 1).padStart(2, '0')}:00 น.`,
    })
    db.notifications.unshift({
      id: `N${Date.now()}`,
      title: 'ส่งคำขอเลื่อนนัดแล้ว',
      body: `ขอเลื่อนนัดเป็น ${to} — ครูแอร์จะยืนยันอีกครั้งภายใน 24 ชม.`, 
      time: 'เมื่อกี้นี้',
      read: false,
      tone: 'blue',
    })
    saveDB()
  },

  async getNotifications(): Promise<AppNotification[]> {
    await delay(250)
    return db.notifications
  },

  async markNotificationsRead(): Promise<void> {
    await delay(150)
    db.notifications.forEach((n) => {
      n.read = true
    })
    saveDB()
  },

  async validateVoucher(code: string, price: number): Promise<number> {
    await delay(400)
    const fn = voucherCodes[code.toUpperCase()]
    if (!fn) throw new Error(`โค้ด "${code}" ไม่ถูกต้องหรือหมดอายุ`)
    return fn(price)
  },

  async purchase(pkgId: string, voucherCode: string, method: string): Promise<void> {
    await delay(700)
    const p = packages.find((x) => x.id === pkgId)
    if (!p) throw new Error('ไม่พบแพ็กเกจที่เลือก')
    const disc = voucherCode ? voucherCodes[voucherCode]?.(p.price) ?? 0 : 0
    const d = new Date()
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
    const date = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
    const pkgLabel = p.name.includes('ชั่วโมง') ? p.name : `${p.name} ${p.hours} ชม.`
    db.receipts.unshift({
      id: `INV-2026-${8800 + db.receipts.length}`,
      date,
      pkg: pkgLabel,
      voucher: voucherCode ? `${voucherCode} (-${disc.toLocaleString()})` : '—',
      amount: p.price - disc,
      method: method.split(' (')[0],
      status: 'สำเร็จ',
    })
    db.packageStatus.hours += p.hours
    db.packageStatus.left += p.hours
    saveDB()
  },

  async getAdminSlots(): Promise<AdminSlot[]> {
    await delay(300)
    return adminSlots
  },

  async getMoveRequests(): Promise<MoveRequest[]> {
    await delay(300)
    return db.moveRequests
  },

  async decideMove(id: string, approve: boolean): Promise<void> {
    await delay(450)
    const r = db.moveRequests.find((x) => x.id === id)
    if (!r) throw new Error('ไม่พบคำขอ')
    r.status = approve ? 'อนุมัติแล้ว' : 'ปฏิเสธ'
    if (r.lessonId) {
      const l = db.lessons.find((x) => x.id === r.lessonId)
      if (l) {
        if (approve && r.newDay && r.newTime) {
          l.date = r.newDay
          l.time = r.newTime
          l.status = 'confirmed'
        } else {
          l.status = 'pending'
        }
      }
    }
    db.notifications.unshift({
      id: `N${Date.now()}`,
      title: approve ? 'อนุมัติเลื่อนนัดแล้ว' : 'ปฏิเสธคำขอเลื่อนนัด',
      body: approve
        ? `เลื่อนนัดเป็น ${r.to} เรียบร้อย — อัปเดตตารางเรียนแล้ว`
        : 'ครูแอร์ยังสะดวกเวลานัดเดิม — ติดต่อครูแอร์เพื่อปรึกษาเวลาใหม่ได้เลย',
      time: 'เมื่อกี้นี้',
      read: false,
      tone: approve ? 'green' : 'pink',
    })
    saveDB()
  },

  async getStudents(): Promise<StudentRow[]> {
    await delay(300)
    return studentRows
  },

  async getSalesReport(): Promise<SalesReport> {
    await delay(350)
    return salesReport
  },

  async getVouchers(): Promise<Voucher[]> {
    await delay(300)
    return vouchers
  },

  async createVoucher(_code: string): Promise<void> {
    await delay(500)
    return
  },

  async recordLesson(time: string, outcome: 'done' | 'no_show'): Promise<void> {
    await delay(400)
    db.packageStatus.used += 1
    db.packageStatus.left = Math.max(0, db.packageStatus.left - 1)
    db.history.unshift({
      date: 'อ. 20 ส.ค.',
      time,
      lesson: outcome === 'done' ? 'เทคนิคการหายใจ + สเกลพื้นฐาน' : 'No-show (ไม่มาเรียน)',
      note: outcome === 'done' ? 'บันทึกโดยครูแอร์' : '—',
      usedHours: 1,
    })
    saveDB()
  },
}

export type SaleRow = Sale
