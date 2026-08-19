export type Role = 'student' | 'teacher' | 'admin'

export type PackageId = 'beginner' | 'pro' | 'master'

export interface Student {
  id: string
  name: string
  nickname: string
  age: number
  education: string
  genres: string[]
  reason: string
  email: string
  lineLinked: boolean
  role: Role
}

export interface PackagePlan {
  id: PackageId
  name: string
  hours: number
  price: number
  tag?: string
  note: string
  tone: 'pink' | 'navy' | 'purple'
}

export interface PackageStatus {
  name: string
  hours: number
  used: number
  left: number
  expiresAt: string
}

export interface Purchase {
  id: string
  date: string
  pkg: string
  voucher: string
  amount: number
  method: string
  status: 'สำเร็จ'
}

export interface LessonHistory {
  date: string
  time: string
  lesson: string
  note: string
  usedHours: number
}

export interface DaySlot {
  time: string
  status: 'ว่าง' | 'เต็ม'
}

export interface BookingSummary {
  day: string
  time: string
  teacher: string
  leftHours: number
}

export interface AdminSlot {
  time: string
  student: string
  status: 'ยืนยันแล้ว' | 'รอคอนเฟิร์ม' | 'ว่าง'
  lesson: string
}

export interface MoveRequest {
  id: string
  student: string
  from: string
  to: string
  at: string
  status: 'รออนุมัติ' | 'อนุมัติแล้ว' | 'ปฏิเสธ'
  lessonId?: string
  newDay?: string
  newTime?: string
}

export type LessonStatus = 'pending' | 'confirmed' | 'moved' | 'done'

export interface MyLesson {
  id: string
  date: string
  time: string
  teacher: string
  status: LessonStatus
  topic: string
}

export interface AppNotification {
  id: string
  title: string
  body: string
  time: string
  read: boolean
  tone: 'pink' | 'green' | 'blue'
}

export interface StudentRow {
  name: string
  info: string
  pkg: string
  left: number
  done: number
  state: 'active' | 'new' | 'expired'
}

export interface Voucher {
  code: string
  type: string
  expires: string
  used: string
  state: 'active' | 'draft'
}

export interface Sale {
  date: string
  student: string
  pkg: string
  voucher: string
  amount: number
  method: string
}

export interface SalesReport {
  revenue: number
  orders: number
  vouchersUsed: number
  newStudents: number
  monthly: { label: string; value: number }[]
  sales: Sale[]
}

export interface LoginInput {
  id: string
  password: string
}

export interface RegisterInput {
  name: string
  nickname: string
  age: number
  education: string
  genres: string[]
  reason: string
  consent: boolean
  email: string
  password: string
}
