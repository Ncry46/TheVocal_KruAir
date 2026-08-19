import type {
  AdminSlot,
  AppNotification,
  BookingSummary,
  DaySlot,
  LessonHistory,
  MoveRequest,
  MyLesson,
  PackagePlan,
  PackageStatus,
  Purchase,
  SalesReport,
  Student,
  StudentRow,
  Voucher,
} from './types'

/* ───────────────────────── helpers ───────────────────────── */
const THAI_DAYS_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']

function chipLabel(d: Date) {
  return `${THAI_DAYS_SHORT[d.getDay()]} ${d.getDate()}`
}

function shortThaiDate(d: Date) {
  const m = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  return `${d.getDate()} ${m[d.getMonth()]}`
}

const today = new Date()

/* Generate next 7 available days starting from tomorrow */
const availDays: Date[] = []
const tmp = new Date(today)
tmp.setDate(tmp.getDate() + 1) // start from tomorrow
while (availDays.length < 7) {
  if (tmp.getDay() !== 0) { // skip Sunday
    availDays.push(new Date(tmp))
  }
  tmp.setDate(tmp.getDate() + 1)
}

/* ───────────────────────── data ───────────────────────── */
export const currentUser: Student = {
  id: 'stu-001',
  name: 'สมชาย ใจดี',
  nickname: 'มิ้นท์',
  age: 22,
  education: 'ปริญญาตรี',
  genres: ['Pop', 'R&B'],
  reason: 'อยากพัฒนาน้ำเสียงเพื่อออดิชันวงดนตรี',
  email: 'mint@email.com',
  lineLinked: true,
  role: 'student',
}

export const teacherProfile: Student = {
  id: 'tch-001',
  name: 'ครูแอร์',
  nickname: 'แอร์',
  age: 30,
  education: 'ปริญญาโท',
  genres: ['Pop', 'R&B', 'Rock', 'Ballad', 'Hip-Hop', 'ลูกทุ่ง'],
  reason: 'สอนร้องเพลงมากว่า 10 ปี',
  email: 'kruaer@email.com',
  lineLinked: true,
  role: 'teacher',
}

export const packages: PackagePlan[] = [
  {
    id: 'beginner',
    name: 'Package 10 ชั่วโมง',
    hours: 10,
    price: 22000,
    note: 'เฉลี่ย 2,200 บาท/ชม. · เหมาะกับผู้เริ่มต้น',
    tone: 'pink',
  },
  {
    id: 'pro',
    name: 'Package 20 ชั่วโมง',
    hours: 20,
    price: 40000,
    tag: 'ยอดนิยม',
    note: 'เฉลี่ย 2,000 บาท/ชม. · คุ้มค่าสำหรับสายจริงจัง',
    tone: 'navy',
  },
  {
    id: 'master',
    name: 'Package 30 ชั่วโมง',
    hours: 30,
    price: 56000,
    tag: 'คุ้มสุด',
    note: 'เฉลี่ย 1,867 บาท/ชม.',
    tone: 'purple',
  },
]

export const packageStatus: PackageStatus = {
  name: 'Pro',
  hours: 20,
  used: 1,
  left: 19,
  expiresAt: '18 ก.พ. 2027',
}

export const history: LessonHistory[] = [
  { date: 'จ. 19 ส.ค.', time: '17:00–18:00', lesson: 'เทคนิคการหายใจ + สเกลพื้นฐาน', note: 'เสียงดีขึ้นมาก ฝึก C3–C5', usedHours: 1 },
  { date: 'จ. 12 ส.ค.', time: '19:00–20:00', lesson: 'อารมณ์เพลง + Ballad', note: 'เน้น phrasing', usedHours: 1 },
  { date: 'จ. 5 ส.ค.', time: '17:00–18:00', lesson: 'เปิดเสียง + เทคนิค falsetto', note: '—', usedHours: 1 },
]

export const receipts: Purchase[] = [
  { id: 'INV-2026-8801', date: '18 ส.ค. 2026', pkg: 'Pro 20 ชม.', voucher: 'WELCOME10 (-3,000)', amount: 37000, method: 'บัตรเครดิต', status: 'สำเร็จ' },
  { id: 'INV-2026-8800', date: '10 ก.ค. 2026', pkg: 'Beginner 10 ชม.', voucher: '—', amount: 22000, method: 'KBank (K+)', status: 'สำเร็จ' },
]

export const days = availDays.map(chipLabel)

const sampleStatuses: ('ว่าง' | 'เต็ม')[] = ['ว่าง', 'ว่าง', 'ว่าง', 'เต็ม', 'ว่าง', 'ว่าง']

export const slotsByDay: Record<string, DaySlot[]> = Object.fromEntries(
  availDays.map((d) => [
    chipLabel(d),
    [
      { time: '10:00', status: sampleStatuses[Math.floor(Math.random() * sampleStatuses.length)] },
      { time: '11:00', status: sampleStatuses[Math.floor(Math.random() * sampleStatuses.length)] },
      { time: '13:00', status: sampleStatuses[Math.floor(Math.random() * sampleStatuses.length)] },
      { time: '15:00', status: sampleStatuses[Math.floor(Math.random() * sampleStatuses.length)] },
      { time: '17:00', status: sampleStatuses[Math.floor(Math.random() * sampleStatuses.length)] },
      { time: '19:00', status: sampleStatuses[Math.floor(Math.random() * sampleStatuses.length)] },
    ],
  ])
)

// Ensure first day has good availability
if (availDays.length > 0) {
  const firstKey = chipLabel(availDays[0])
  slotsByDay[firstKey] = [
    { time: '10:00', status: 'ว่าง' },
    { time: '11:00', status: 'ว่าง' },
    { time: '13:00', status: 'เต็ม' },
    { time: '15:00', status: 'ว่าง' },
    { time: '17:00', status: 'ว่าง' },
    { time: '19:00', status: 'ว่าง' },
  ]
}

const firstAvailDate = availDays[0] || new Date(today.getTime() + 86400000)

export const bookingSummary: BookingSummary = {
  day: `${THAI_DAYS_SHORT[firstAvailDate.getDay()]} ${shortThaiDate(firstAvailDate)}`,
  time: '17:00–18:00',
  teacher: 'ครูแอร์ (เรียนสด 1:1)',
  leftHours: 19,
}

export const adminSlots: AdminSlot[] = [
  { time: '10:00', student: 'น้องเฟิร์น', status: 'ยืนยันแล้ว', lesson: 'Pop + สเกล' },
  { time: '11:00', student: 'น้องมิน', status: 'รอคอนเฟิร์ม', lesson: 'Ballad' },
  { time: '13:00', student: '—', status: 'ว่าง', lesson: '' },
  { time: '15:00', student: 'น้องต้นน้ำ', status: 'ยืนยันแล้ว', lesson: 'Rock' },
  { time: '17:00', student: 'น้องมิ้นท์', status: 'ยืนยันแล้ว', lesson: 'เทคนิคการหายใจ' },
  { time: '19:00', student: '—', status: 'ว่าง', lesson: '' },
]

export const moveRequests: MoveRequest[] = [
  { id: 'mv-1', student: 'น้องมิ้นท์', from: `${chipLabel(availDays[0])} 17:00`, to: `${chipLabel(availDays[1] || availDays[0])} 17:00`, at: `${chipLabel(today)} 14:02`, status: 'รออนุมัติ' },
  { id: 'mv-2', student: 'น้องเฟิร์น', from: `${chipLabel(availDays[2] || availDays[0])} 13:00`, to: `${chipLabel(availDays[3] || availDays[0])} 19:00`, at: `${chipLabel(today)} 09:41`, status: 'รออนุมัติ' },
]

export const myLessons: MyLesson[] = [
  {
    id: 'L1',
    date: `${chipLabel(availDays[0])}.`,
    time: '17:00–18:00 น.',
    teacher: 'ครูแอร์ (เรียนสด 1:1)',
    status: 'pending',
    topic: 'เทคนิคการหายใจ + สเกลพื้นฐาน',
  },
  {
    id: 'L2',
    date: `${chipLabel(availDays[2] || availDays[0])}.`,
    time: '19:00–20:00 น.',
    teacher: 'ครูแอร์ (เรียนสด 1:1)',
    status: 'confirmed',
    topic: 'เพลงโปรด 1:1',
  },
]

export const notifications: AppNotification[] = [
  {
    id: 'N1',
    title: 'เตือนนัดเรียนพรุ่งนี้',
    body: `พรุ่งนี้ 17:00 น. มีคลาสเรียน — กดยืนยันการมาเรียนก่อนเข้าเรียน 1 วัน`,
    time: 'เมื่อ 2 ชม.ที่แล้ว',
    read: false,
    tone: 'pink',
  },
  {
    id: 'N2',
    title: 'ชำระเงินสำเร็จ',
    body: 'ซื้อแพ็กเกจ Pro 20 ชม. — เพิ่มชั่วโมงเข้าบัญชีแล้ว',
    time: 'เมื่อ 3 วันก่อน',
    read: true,
    tone: 'green',
  },
  {
    id: 'N3',
    title: 'ยินดีต้อนรับ',
    body: 'สมัครสมาชิกสำเร็จ เริ่มต้นเรียนกับครูแอร์ได้เลย',
    time: 'เมื่อ 1 สัปดาห์ก่อน',
    read: true,
    tone: 'blue',
  },
]

export const studentRows: StudentRow[] = [
  { name: 'มิ้นท์ สมชาย', info: '22 · ป.ตรี', pkg: 'Pro 20', left: 19, done: 12, state: 'active' },
  { name: 'เฟิร์น วงศ์', info: '19 · ม.ปลาย', pkg: 'Pro 20', left: 15, done: 5, state: 'active' },
  { name: 'มิน ใจดี', info: '25 · ป.โท', pkg: 'Beginner 10', left: 8, done: 2, state: 'active' },
  { name: 'ต้นน้ำ สุดา', info: '17 · ม.ปลาย', pkg: 'Master 30', left: 30, done: 0, state: 'new' },
  { name: 'พรีม พิมพ์', info: '28 · ป.ตรี', pkg: '—', left: 0, done: 20, state: 'expired' },
]

export const vouchers: Voucher[] = [
  { code: 'WELCOME10', type: '% 10% (สูงสุด 3,000)', expires: '31 ธ.ค. 2026', used: '3 / 100', state: 'active' },
  { code: 'SAVE1000', type: 'บาท 1,000', expires: '30 พ.ย. 2026', used: '12 / 50', state: 'active' },
  { code: 'BIRTHDAY500', type: 'บาท 500', expires: '—', used: '0 / —', state: 'draft' },
]

export const salesReport: SalesReport = {
  revenue: 152000,
  orders: 6,
  vouchersUsed: 3,
  newStudents: 4,
  monthly: [
    { label: 'ก.พ.', value: 11 },
    { label: 'มี.ค.', value: 15 },
    { label: 'เม.ย.', value: 14 },
    { label: 'พ.ค.', value: 20 },
    { label: 'มิ.ย.', value: 25 },
    { label: 'ก.ค.', value: 22 },
    { label: 'ส.ค.', value: 30 },
    { label: 'ก.ย.', value: 35 },
    { label: 'ต.ค.', value: 32 },
    { label: 'พ.ย.', value: 40 },
    { label: 'ธ.ค.', value: 38 },
    { label: 'ม.ค.', value: 42 },
  ],
  sales: [
    { date: '18 ส.ค. 2026', student: 'มิ้นท์', pkg: 'Pro 20', voucher: 'WELCOME10', amount: 37000, method: 'บัตร' },
    { date: '17 ส.ค. 2026', student: 'เฟิร์น', pkg: 'Pro 20', voucher: 'SAVE1000', amount: 39000, method: 'KBank' },
    { date: '15 ส.ค. 2026', student: 'ใหม่', pkg: 'Beginner 10', voucher: '—', amount: 22000, method: 'KBank' },
    { date: '12 ส.ค. 2026', student: 'มิน', pkg: 'Beginner 10', voucher: '—', amount: 22000, method: 'บัตร' },
    { date: '10 ส.ค. 2026', student: 'ต้นน้ำ', pkg: 'Master 30', voucher: 'SAVE1000', amount: 55000, method: 'KBank' },
    { date: '9 ส.ค. 2026', student: 'พลอย', pkg: 'Beginner 10', voucher: '—', amount: 22000, method: 'บัตร' },
  ],
}

export const voucherCodes: Record<string, (price: number) => number> = {
  SAVE1000: () => 1000,
  WELCOME10: (price) => Math.min(3000, Math.round(price * 0.1)),
}
