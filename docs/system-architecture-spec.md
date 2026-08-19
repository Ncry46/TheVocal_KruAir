# System Architecture Specification — ระบบโรงเรียนสอนร้องเพลง "ครูแอร์"

> **เวอร์ชัน:** 1.0 (สำหรับทีม Developer / Designer นำไปพัฒนา)  
> **ขอบเขต:** Web Application (Responsive) + LINE Official Account (Messaging API / LIFF / LINE Login) + Payment Gateway (KBank)  
> **เอกสารอ้างอิง:** `design-spec.md` (ภาพรวม UX) · Prototype: `docs/web-app.html` (เว็บ) · `docs/prototype.html` (LINE)  
> **ระบบต้นแบบ (Reference Implementation):** `frontend/` (React + Vite) + `backend/` (Express + SQL Server)

---

## สารบัญ

1. [ภาพรวมระบบ & หลักการออกแบบ](#1-ภาพรวมระบบ--หลักการออกแบบ)
2. [System Architecture & Tech Stack](#2-system-architecture--tech-stack)
3. [Database Design (Schema + Data Dictionary)](#3-database-design)
4. [User Journeys & End-to-End Flows](#4-user-journeys--end-to-end-flows)
5. [UI/UX Wireframe & Screen Specification](#5-uiux-wireframe--screen-specification)
6. [Security · PDPA · Edge Cases](#6-security--pdpa--edge-cases)
7. [REST API Summary](#7-rest-api-summary)
8. [Checklist ส่งมอบงานให้ทีม](#8-checklist-ส่งมอบงาน)

---

## 1. ภาพรวมระบบ & หลักการออกแบบ

### 1.1 หลักการสำคัญ (Web-First)

> **เว็บแอปพลิเคชันคือระบบหลัก · LINE OA เป็นช่องทางเสริม (Push + เมนูลัด) · ฐานข้อมูลชุดเดียว**

- นักเรียนสมัคร/เข้าสู่ระบบผ่านเว็บเป็นหลัก (อีเมล/เบอร์ + รหัสผ่าน) — **LINE Login เป็นทางเลือกเสริม** สำหรับนักเรียนที่ใช้ LINE
- ทุกฟีเจอร์ทำงานครบในเว็บ: Landing Page + Student Portal + Admin Dashboard
- LINE OA ทำหน้าที่: **LINE Push Notification** (เตือนนัด 1 วัน / ใบเสร็จ / ผลอนุมัติ), **Rich Menu** (เมนู 6 ปุ่ม ลิงก์เข้า LIFF), **LIFF** (หน้าเว็บในกรอบ LINE สำหรับจอง/ซื้อ/ดูประวัติ)
- จองจากช่องทางไหน → เห็นพร้อมกันทุกช่องทาง (ฐานข้อมูลเดียว)

### 1.2 วงจรชีวิตนักเรียน (Core Loop)

```
สมัครสมาชิก (LINE Login / เว็บ)  →  ซื้อแพ็กเกจ (วอเชอร์ + ชำระ KBank)
→  จองเวลาเรียน (Calendar)       →  แจ้งเตือน 1 วัน + คอนเฟิร์มนัด
→  เข้าเรียน                     →  ครูบันทึก Class Log + หักชั่วโมงจริง
```

### 1.3 บทบาทผู้ใช้ (Roles)

| Role | สิทธิ์หลัก |
|---|---|
| **Student** | สมัคร/ล็อกอิน, ซื้อแพ็กเกจ + วอเชอร์ + จ่ายเงิน, จอง/เลื่อน/ยกเลิกนัด, คอนเฟิร์มนัด, ดูประวัติ/ชั่วโมงคงเหลือ/ใบเสร็จ |
| **Teacher (ครูแอร์)** | ดูตารางสอนรายวัน, เปิด/ปิดสล็อต, ดูข้อมูลนักเรียน, บันทึกผลการสอน (Class Log), ดูยอดขาย |
| **Admin** | จัดการนักเรียน/วอเชอร์/การจอง, ตรวจสอบการชำระเงิน, อนุมัติคำขอเลื่อน, รายงานยอดขาย/สถิติ, ตั้งค่าระบบ |

---

## 2. System Architecture & Tech Stack

### 2.1 สถาปัตยกรรมภาพรวม (Component Diagram)

```
                        ┌───────────────────────────────┐
                        │        ผู้ใช้งาน              │
                        │  นักเรียน / ครูแอร์ / แอดมิน   │
                        └──────┬───────────────┬───────┘
                               │ LINE App      │ Browser (Web Responsive)
                               ▼               ▼
┌──────────────────────────────────────────────────────────────────┐
│                        LINE Platform (OA)                       │
│  Messaging API (webhook/postback) · LIFF (webview) · LINE Login │
└───────────────────────────────┬──────────────────────────────────┘
                                │ HTTPS Webhook + LIFF URL
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                   Web Application (Frontend + Backend)          │
│                                                                  │
│  [Client] React + TypeScript + Vite                              │
│     ├─ Public Site (Landing)        ├─ Student Portal (LIFF-ready)│
│     └─ Admin Dashboard              └─ PWA/Responsive            │
│                                                                  │
│  [Server] Node.js (NestJS/Express) + REST API + Socket/SSE       │
│     ├─ Auth Service (JWT + OAuth2 LINE Login)                    │
│     ├─ Package / Voucher / Transaction Service                   │
│     ├─ Booking & Schedule Service (locking, state machine)       │
│     ├─ Payment Service (KBank Gateway client + webhook)          │
│     ├─ Notification Service (LINE Push + Flex + in-app)          │
│     └─ Job Scheduler (Cron): เตือน 1 วัน · ทวงคอนเฟิร์ม · expiry │
│                                                                  │
│  [Data] PostgreSQL 15 · Redis (cache/lock/queue) · S3 (ใบเสร็จ)  │
└──────┬─────────────────────┬───────────────────────┬────────────┘
       │ REST/Webhook        │ HTTPS + Signature      │ HTTPS
       ▼                     ▼                        ▼
┌──────────────┐     ┌────────────────────┐    ┌──────────────────┐
│   KBank      │     │  LINE API Server   │    │ 3rd Party        │
│ Payment GW   │     │  (push, profile,   │    │ - SMTP (อีเมล)    │
│ - บัตรเครดิต │     │   rich menu, LIFF) │    │ - OTP/SMS (เสริม) │
│ - QR / โอน   │     └────────────────────┘    └──────────────────┘
└──────────────┘
```

### 2.2 Tech Stack (กำหนดให้ชัดเจน)

| ชั้น | เทคโนโลยี | เหตุผล |
|---|---|---|
| **Frontend** | React 18 + Vite + React Router | ต้นแบบ `frontend/` + UI ร่วมใน `components/` |
| **UI** | CSS Modules/design tokens (ธีมชมพู-ขาว) · Kanit/Noto Serif Thai | ตรงกับธีมที่ครูแอร์อนุมัติ |
| **Backend** | Node.js + NestJS (TypeScript, DI, Modules) | โครงสร้างแยก Module ชัดเจน ตรงกับฟีเจอร์ |
| **API** | REST (JSON) + OpenAPI/Swagger · Validation (class-validator) | เอกสาร API อัตโนมัติ |
| **Auth** | JWT (Access + Refresh) · bcrypt/argon2 · **LINE Login (OAuth2.0 OpenID Connect)** | เข้า LINE ได้ 1 ปุ่ม |
| **Database** | **PostgreSQL 15** (แนะนำ) หรือ MySQL 8 | ธุรกรรมเงินต้อง ACID — เลือก PostgreSQL |
| **Cache/Queue** | Redis (session/rate-limit/distributed lock ของสล็อต) + BullMQ | ล็อกสล็อตกันซ้ำ + job เตือน |
| **File** | S3/Cloud Storage (ใบเสร็จ PDF, ไฟล์เสียงฟีดแบค) | ใบเสร็จ/คลิปเสียง |
| **Payment** | **KBank Payment Gateway** — บัตรเครดิต/เดบิต (3-D Secure) + QR/โอน (K+ e-Payment) | Webhook กลับเพื่อยืนยัน |
| **LINE** | Messaging API (webhook + postback) · LIFF SDK v2 · LINE Login · Rich Menu · Flex Message | Push/คอนเฟิร์ม/เมนู |
| **Deploy** | Docker + Nginx + PM2/ECS · CI: GitHub Actions · ENV: staging/prod แยก | สลับได้ไม่ติด vendor |
| **Monitoring** | Sentry (error) · Prometheus/Grafana (metric) · log (JSON) | แจ้งเตือน payment/webhook พัง |

### 2.3 ข้อกำหนด Non-Functional (สรุป)

- **ความเร็ว:** API < 300ms (p95) · หน้าเว็บ LCP < 2.5s · ใช้ CDN สำหรับ static
- **พร้อมใช้งาน:** 99.5% ต่อเดือน · webhook retry อย่างน้อย 5 ครั้ง (exponential backoff)
- **ความถูกต้องของเงิน:** ทุก transaction idempotent (key = payment_ref) · บันทึก audit ทุกรายการ
- **เวลา (เวลาไทย):** เก็บ UTC ใน DB, แสดงผล Asia/Bangkok · ตารางสอนอ้างอิง "วัน/เวลา" ของไทย

---

## 3. Database Design

### 3.1 Entity-Relationship (ER) ภาพรวม

```
users ──1:N── user_packages ──N:1── packages
users ──1:N── transactions ──1:N── payments
vouchers ──1:N── voucher_usages ──N:1── transactions
users ──1:N── bookings ──1:1── attendance
bookings ──N:1── teacher_availability (สล็อต)
users ──1:N── move_requests
users ──1:N── class_logs ──1:1── bookings
users ──1:N── notifications
users ──1:1── line_links (LINE userId ↔ user)
```

### 3.2 Data Dictionary (ตารางหลัก)

> นามสกุลไฟล์: `_id` = UUID (PK) · `_at` = TIMESTAMPTZ (UTC) · เงินเก็บเป็น **integer (สตางค์)** หรือ numeric(12,2)

#### 3.2.1 `users` — บัญชีนักเรียน/ครู/แอดมิน

| คอลัมน์ | ชนิด | คำอธิบาย | หมายเหตุ |
|---|---|---|---|
| id | UUID PK | | |
| role | ENUM(student/teacher/admin) | สิทธิ์ (RBAC) | |
| email | varchar(255) UNIQUE NULL | ล็อกอินหลัก | NULL ได้ถ้าใช้ LINE ล้วน |
| phone | varchar(20) UNIQUE NULL | เบอร์สำรอง/ล็อกอิน | |
| password_hash | varchar(255) NULL | bcrypt/argon2 | NULL สำหรับ LINE-only |
| name (ชื่อจริง) | varchar(100) | | |
| nickname (ชื่อเล่น) | varchar(50) | ใช้เรียกใน UI/LINE | |
| age | int | | |
| education | varchar(100) | ระดับการศึกษา | |
| genres | jsonb | แนวเพลงที่ชอบ [] | |
| reason | text | เหตุผลอยากเรียนร้องเพลง | |
| status | ENUM(active/suspended) | | |
| line_linked | boolean | ผูก LINE แล้ว? | คำนวณจาก line_links |
| consent_pdpa_at | timestamptz NULL | ยอมรับ PDPA เมื่อไหร่ | จำเป็น |
| created_at / updated_at | timestamptz | | |

#### 3.2.2 `line_links` — การผูก LINE userId

| คอลัมน์ | ชนิด | คำอธิบาย |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK→users | |
| line_user_id | varchar(255) UNIQUE | ได้จาก LINE Login/Messaging |
| line_display_name | varchar(255) | |
| linked_at | timestamptz | |

#### 3.2.3 `packages` — แคตตาล็อกแพ็กเกจ (Master Data)

| คอลัมน์ | ชนิด | คำอธิบาย |
|---|---|---|
| id | ENUM(beginner/pro/master) | |
| name | varchar(50) | |
| hours | int | 10 / 20 / 30 |
| price | numeric(12,2) | 22,000 / 40,000 / 56,000 |
| note | text | "เฉลี่ย X บาท/ชม. · เหมาะกับ..." |
| is_active | boolean | เปิดขาย? |

#### 3.2.4 `user_packages` — แพ็กเกจที่นักเรียนถืออยู่ (Balance + Expiry)

| คอลัมน์ | ชนิด | คำอธิบาย |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK→users | |
| package_id | FK→packages | |
| hours_total | int | จำนวนชม.ที่ซื้อ |
| hours_used | int | ใช้ไปแล้ว (หักเมื่อเรียนจริง) |
| hours_left | int | คงเหลือ (generated หรือคำนวณ) |
| expires_at | timestamptz | **ซื้อ + 6 เดือน** |
| status | ENUM(active/expired/refunded) | |
| source_transaction_id | FK→transactions | |

> **กฎ:** `hours_left = hours_total - hours_used` · ตรวจ `expires_at > now()` ก่อนจอง · หัก 1 ชม./คลาส **เมื่อครูบันทึกการสอนจริง** เท่านั้น (ไม่หักตอนจอง — ตาม Brief)

#### 3.2.5 `transactions` — คำสั่งซื้อ (Order)

| คอลัมน์ | ชนิด | คำอธิบาย |
|---|---|---|
| id | UUID PK | |
| ref_no | varchar(30) UNIQUE | เลขที่อ้างอิง "INV-2026-xxxx" ใช้แสดงบนใบเสร็จ |
| user_id | FK→users | |
| package_id | FK→packages | |
| gross_amount | numeric(12,2) | ราคาเต็ม |
| discount_amount | numeric(12,2) | จากวอเชอร์ |
| net_amount | numeric(12,2) | ยอดสุทธิ |
| voucher_code | varchar(30) NULL | |
| status | ENUM(created/payment_pending/success/failed/expired/refunded) | |
| created_at / paid_at | timestamptz | |

#### 3.2.6 `payments` — การชำระเงิน (KBank)

| คอลัมน์ | ชนิด | คำอธิบาย |
|---|---|---|
| id | UUID PK | |
| transaction_id | FK→transactions | |
| payment_ref | varchar(64) UNIQUE | idempotency key (ส่งให้ KBank) |
| method | ENUM(card/transfer) | บัตรเครดิต/เดบิต หรือ โอน/QR K+ |
| gateway_status | ENUM(created/pending/success/failed/cancelled) | |
| gateway_response | jsonb | response + webhook payload ดิบ (audit) |
| paid_at | timestamptz NULL | |
| refund_amount | numeric NULL | |

> **Webhook:** KBank ยิงกลับ → `payment_ref` → อัปเดต `payments` + `transactions` → สร้าง `user_packages` + ใบเสร็จ (PDF/S3) + LINE Push

#### 3.2.7 `vouchers` — วอเชอร์ส่วนลด

| คอลัมน์ | ชนิด | คำอธิบาย |
|---|---|---|
| id | UUID PK | |
| code | varchar(30) UNIQUE | เช่น SAVE1000, WELCOME10 |
| type | ENUM(fixed/percent) | เงินลด หรือ % |
| value | numeric(12,2) | |
| max_discount | numeric NULL | วงเงินสูงสุด (กรณี %) |
| valid_from / valid_to | timestamptz | |
| max_uses | int NULL | จำกัดจำนวนครั้ง |
| used_count | int | |
| is_active | boolean | |

#### 3.2.8 `voucher_usages` — ประวัติการใช้

| คอลัมน์ | ชนิด | คำอธิบาย |
|---|---|---|
| id | UUID PK | |
| voucher_id | FK→vouchers | |
| transaction_id | FK→transactions | |
| used_at | timestamptz | |

#### 3.2.9 `teacher_availability` — ตารางสล็อตของครู (เปิด/ปิด)

| คอลัมน์ | ชนิด | คำอธิบาย |
|---|---|---|
| id | UUID PK | |
| teacher_id | FK→users (role=teacher) | |
| slot_date | date | |
| slot_time | time | เช่น 17:00 |
| duration_min | int | 60 |
| status | ENUM(open/booked/closed) | ปิด = ครูไม่ว่าง |
| version | int | optimistic lock กันจองซ้ำ |

#### 3.2.10 `bookings` — การจองเรียน (หัวใจระบบ)

| คอลัมน์ | ชนิด | คำอธิบาย |
|---|---|---|
| id | UUID PK | |
| user_id | FK→users | |
| slot_id | FK→teacher_availability | |
| user_package_id | FK→user_packages | แพ็กเกจที่จะหัก |
| status | ENUM(**pending/confirmed/moved/done/no_show/cancelled**) | State machine ดูหัวข้อ 4.6 |
| confirm_deadline | timestamptz | 24 ชม.ก่อนนัด → รอคอนเฟิร์ม |
| confirmed_at | timestamptz NULL | |
| source | ENUM(web/line) | จองจากช่องทางไหน |
| created_at / updated_at | timestamptz | |
| UNIQUE(slot_id) | | กันจองซ้ำที่สล็อตเดียวกัน |

#### 3.2.11 `attendance` — การเข้าร่วมจริง

| คอลัมน์ | ชนิด | คำอธิบาย |
|---|---|---|
| id | UUID PK | |
| booking_id | FK→bookings UNIQUE | |
| status | ENUM(attended/no_show) | ครูบันทึกหลังเรียนจบ |
| recorded_by | FK→users | |
| recorded_at | timestamptz | |

#### 3.2.12 `class_logs` — บันทึกการสอน (หักชั่วโมงจริงตรงนี้)

| คอลัมน์ | ชนิด | คำอธิบาย |
|---|---|---|
| id | UUID PK | |
| booking_id | FK→bookings | |
| user_id | FK→users | |
| lesson_title | varchar(150) | เช่น "เทคนิคการหายใจ + สเกล" |
| note | text | ฟีดแบค/สิ่งที่ฝึก |
| feedback_audio_url | varchar NULL | ไฟล์เสียงฟีดแบค (S3) |
| hours_deducted | int | = 1 |
| created_at | timestamptz | |

> **Flow หักชั่วโมง:** บันทึก Class Log → `user_packages.hours_used += 1` → booking.status = done → ประวัติการเรียน

#### 3.2.13 `move_requests` — คำขอเลื่อนนัด

| คอลัมน์ | ชนิด | คำอธิบาย |
|---|---|---|
| id | UUID PK | |
| booking_id | FK→bookings | |
| user_id | FK→users | |
| requested_slot_id | FK→teacher_availability | สล็อตใหม่ที่ขอ |
| from_slot_text | varchar(60) | สล็อตเดิม (สำรองข้อมูล) |
| status | ENUM(pending/approved/rejected) | |
| decided_by / decided_at | FK→users / timestamptz | |

#### 3.2.14 `notifications` — แจ้งเตือนในเว็บ (in-app)

| คอลัมน์ | ชนิด | คำอธิบาย |
|---|---|---|
| id | UUID PK | |
| user_id | FK→users | |
| title / body | varchar / text | |
| type | ENUM(reminder/confirm/payment/move/class) | |
| read_at | timestamptz NULL | |
| created_at | timestamptz | |

#### 3.2.15 `line_push_logs` — ประวัติส่ง LINE (audit + retry)

| คอลัมน์ | ชนิด | คำอธิบาย |
|---|---|---|
| id | UUID PK | |
| user_id | FK→users | |
| line_user_id | varchar | |
| message_type | ENUM(text/flex/template) | |
| payload | jsonb | |
| status | ENUM(sent/failed/retrying) | |
| sent_at | timestamptz | |

#### 3.2.16 `audit_logs` — ตรวจสอบการเข้าถึง/การเงิน

| คอลัมน์ | ชนิด | คำอธิบาย |
|---|---|---|
| id | UUID PK | |
| actor_id | FK→users NULL | |
| action | varchar(100) | เช่น payment.approve |
| entity / entity_id | varchar | |
| before / after | jsonb | |
| ip / user_agent | varchar | |
| created_at | timestamptz | |

---

## 4. User Journeys & End-to-End Flows

> สัญลักษณ์: **[S]** = ฝั่ง Server · **[W]** = Web · **[L]** = LINE · **[P]** = Payment Gateway

### 4.1 Flow A — สมัครสมาชิกผ่าน LINE Login + จัดการ Profile

```
1. [W/L] นักเรียนกด "สมัครสมาชิก" (เว็บ) หรือ Rich Menu > สมัคร (LIFF)
2. [L] ทางเลือก "เข้าสู่ระบบด้วย LINE": LINE Login (OAuth2 + OpenID) →
     รับ line_user_id + profile (ชื่อ, รูป) → ผูก/สร้างบัญชี
3. [W] ฟอร์มสมัคร (6 ฟิลด์ตาม Brief): ชื่อจริง · ชื่อเล่น · อายุ ·
     ระดับการศึกษา · แนวเพลงที่ชอบ (หลายตัวเลือก) · เหตุผลอยากเรียนร้องเพลง
4. [W] ยอมรับ PDPA (checkbox) → [S] สร้าง users + line_links + consent_pdpa_at
5. [S] ส่งอีเมล/OTP ยืนยัน (ถ้าใช้อีเมล) → JWT ลงชื่อเข้าใช้ทันที
6. [S] สร้างการแจ้งเตือนต้อนรับ (ในเว็บ + LINE Push) → [W] เข้าสู่ Student Portal
7. การแก้ไข Profile: [W] หน้า Profile → แก้ชื่อเล่น/แนวเพลง/การศึกษา/เป้า →
     [S] audit log → แจ้งเตือนยืนยัน
```

**เงื่อนไข:** email/เบอร์ซ้ำ → บอก "มีบัญชีอยู่แล้ว → เข้าสู่ระบบ" · LINE userId ซ้ำ → ผูกกับบัญชีเดิม

### 4.2 Flow B — ซื้อแพ็กเกจ + วอเชอร์ + ชำระเงิน KBank

```
1. [W/L] เลือกแพ็กเกจ (10/20/30 ชม.) จากหน้าแพ็กเกจ
2. [W] ใส่วอเชอร์ (ถ้ามี) → [S] validate: รหัสถูก? ในช่วงเวลา? ยังไม่เกิน max_uses? →
     คำนวณส่วนลด → แสดงยอดสุทธิแบบเรียลไทม์
3. [W] เลือกช่องทาง: (ก) บัตรเครดิต/เดบิต 3-D Secure หรือ (ข) โอน/QR K+ (e-Payment)
4. [S] สร้าง transactions(status=payment_pending) + payments(payment_ref, idempotency key)
5. [P] Redirect ไปหน้า KBank (บัตร: 3-D Secure · โอน: แสดง QR/เลขบัญชีอ้างอิง)
6. [P] นักเรียนชำระ → KBank webhook ยิงกลับ → [S] ตรวจ signature + payment_ref
7. [S] อัปเดต payment=success, transaction=success → สร้าง user_packages
     (hours_total + expires_at = now+6 เดือน) + voucher_usages (ถ้าใช้โค้ด)
8. [S] สร้างใบเสร็จ PDF (เลขที่ INV-xxxx, เก็บ S3) + [L] LINE Push Flex ใบเสร็จ + [W] แจ้งเตือนในเว็บ
9. [W] หน้าใบเสร็จ/ประวัติการซื้ออัปเดตทันที — ชั่วโมงคงเหลือเพิ่ม
```

**Idempotency:** ถ้า webhook ซ้ำ/การันตี double-click → `payment_ref` เดิมถูกใช้แล้ว → ตอบ success เดิม ไม่สร้างซ้ำ

### 4.3 Flow C — จองเวลาเรียนผ่าน Calendar + หักชั่วโมง + เตือน 1 วัน

```
1. [W/L] หน้า "จองเวลาเรียน" → แสดง 7 วันถัดไป + สล็อต 60 นาที
     (สล็อตเต็ม/ปิด = disabled) — ข้อมูลจาก teacher_availability
2. [W] เลือกวัน-เวลา → [S] ล็อกสล็อต (transaction + row lock / Redis lock):
     ตรวจ (ก) สล็อตยังว่าง (ข) user_packages ยังไม่หมดอายุ (ค) hours_left > 0
3. [S] สำเร็จ → สร้าง bookings(status=pending) + กันสล็อต
     **ยังไม่หักชั่วโมง** (หักเมื่อเรียนจริงตาม Brief)
4. [S] แจ้งเตือน "จองสำเร็จ" (ในเว็บ + LINE)
5. [S] Cron ทุก 5 นาที: คำนวณนัดที่เหลือ < 24 ชม. → status=pending
     → ส่ง LINE Push "พรุ่งนี้มีคลาส X น. — กดคอนเฟิร์ม" + ปุ่ม Flex
6. [L/W] นักเรียนกดคอนเฟิร์ม (ปุ่ม postback/LIFF หรือหน้าเว็บ) → booking=confirmed
7. ถ้าไม่คอนเฟิร์มภายใน 6 ชม.ก่อนเรียน → [S] ทวงถามอีกครั้ง (LINE) → ยังไม่ตอบ
     → ขึ้น "ยังไม่คอนเฟิร์ม" ในตารางครู (เตือนให้ครูโทรเช็ค)
```

### 4.4 Flow D — คอนเฟิร์ม / ขอเลื่อนนัดผ่าน LINE OA

```
คอนเฟิร์ม:
  [L] LINE Push (Flex: ปุ่ม "ยืนยันมาเรียน ✅" / "ขอเลื่อนนัด 🔄")
  [L] postback → [S] verify + booking=confirmed → LINE Push "แล้วพบกันนะครับ" + อัปเดตตารางครู

ขอเลื่อนนัด:
  [L] กด "ขอเลื่อนนัด" → LIFF หน้าเลือกวัน-เวลาใหม่ (สล็อตที่ว่างเท่านั้น)
  [S] สร้าง move_requests(pending) + booking.status=moved (กันสล็อตเดิมถูกจองซ้ำ)
  [S] แจ้งเตือนแอดมิน (ในเว็บ badge + LINE แจ้งครู)
  [S] แอดมิน อนุมัติ → ย้ายสล็อต: booking ใหม่ = สล็อตที่ขอ, ปล่อยสล็อตเดิม
      → LINE Push นักเรียน "ยืนยันเวลใหม่แล้ว"
      / ปฏิเสธ → booking กลับเป็น pending (นัดเดิม) → LINE Push แจ้ง + ให้ติดต่อครู
```

### 4.5 Flow E — หลังเรียนจบ: Class Log + หักชั่วโมงจริง

```
1. [W] ครูแอร์ หน้า "ตารางสอน" → การ์ดคลาส → กด "บันทึกการสอน"
2. [W] ฟอร์ม: หัวข้อที่สอน · หมายเหตุ/ฟีดแบค · (อัปโหลดไฟล์เสียงฟีดแบคได้)
3. [S] สร้าง class_logs + attendance=attended
4. [S] user_packages.hours_used += 1 (hours_left -= 1) — **หักตรงนี้เท่านั้น**
5. [S] booking.status = done → ประวัติการเรียน + ชั่วโมงคงเหลืออัปเดต
6. [L/W] แจ้งเตือนนักเรียน "จบคลาสแล้ว — เหลือ X ชม." + ฟีดแบคครู
กรณีไม่มา: กด "No-show" → attendance=no_show, booking=no_show — **ไม่หักชั่วโมง**
```

### 4.6 State Machine (หัวใจระบบ — ใช้กับทั้งเว็บและ LINE)

```
bookings.status:

        จองสำเร็จ               คอนเฟิร์ม             ครูบันทึก
pending ──────────► confirmed ──────────► done
   │                  ▲  │                  │
   │ ขอเลื่อน          │  │ เลื่อน(อนุมัติ)   │ ครูบันทึกไม่มา
   ▼                  │  ▼                  ▼
 moved ───────────────┘  (ย้ายไปสล็อตใหม่)  no_show
   │ ปฏิเสธคำขอ
   ▼
 pending (กลับนัดเดิม)

payments.status:  created → payment_pending → success | failed | expired(15 นาที)
transactions:     created → payment_pending → success | failed/expired → (refundable)
move_requests:    pending → approved | rejected
vouchers:         active → used (เมื่อ max_uses ครบ) / expired (เลย valid_to)
```

---

## 5. UI/UX Wireframe & Screen Specification

### 5.1 LINE OA — Rich Menu (เมนูหลัก 6 ปุ่ม สำหรับนักเรียน)

```
┌─────────────────────────────────────────────┐
│  ครูแอร์ Singing School  (แชตหน้าแรก)        │
│  [ข้อความต้อนรับ + ปุ่มเริ่มใช้งาน]           │
├─────────────────────────────────────────────┤
│  Rich Menu (2 แถว × 3 คอลัมน์)              │
│  ┌──────────┬──────────┬──────────┐         │
│  │ 📅 จองเวลา│ 🎒 แพ็กเกจ│ 📖 ประวัติ │         │
│  ├──────────┼──────────┼──────────┤         │
│  │ 👤 Profile│ 🛒 ซื้อ    │ 💬 ติดต่อ  │         │
│  └──────────┴──────────┴──────────┘         │
└─────────────────────────────────────────────┘
```

| ปุ่ม | พฤติกรรม |
|---|---|
| จองเวลาเรียน | เปิด LIFF `liff://booking` (ปฏิทิน 7 วัน) |
| แพ็กเกจของฉัน | LIFF หน้าแพ็กเกจ — ชั่วโมงคงเหลือ + ซื้อเพิ่ม |
| ประวัติการเรียน | LIFF หน้าประวัติ (ตารางคลาส + บันทึกครู) |
| Profile | LIFF หน้าโปรไฟล์ (แก้ไข + เชื่อมต่อ LINE) |
| ซื้อแพ็กเกจ | LIFF หน้าแพ็กเกจ (วอเชอร์ + ชำระ) |
| ติดต่อครูแอร์ | ส่งข้อความหา OA (แชต) |

**Flex Message ที่ต้องทำ:** (1) เตือนนัด 1 วัน + ปุ่มยืนยัน/เลื่อน (2) ใบเสร็จหลังชำระ (3) แจ้งผลอนุมัติเลื่อน (4) สรุปหลังเรียนจบ + ฟีดแบค

### 5.2 Web App / LIFF — Screen Specification (ทุกหน้าต้อง Responsive)

#### 5.2.1 Landing Page (Public)
- Navbar (ลิงก์: แพ็กเกจ/วิธีเรียน/ทำไมต้องเรา/รีวิว/ติดต่อ + เข้าสู่ระบบ + สมัคร) · Hero (หัวข้อ + CTA + สถิติ + เส้นโน้ต) · แพ็กเกจ 3 การ์ด + เงื่อนไข · วิธีเรียน 4 ขั้น · ทำไมต้องเรา 6 จุดเด่น · พบครูแอร์ · รีวิว · ติดต่อ + ฟอร์มสอบถาม · Footer
- **องค์ประกอบ/พฤติกรรม:** scroll-reveal animation · hover การ์ด · ปุ่ม CTA → /register

#### 5.2.2 สมัครสมาชิก (`/register`) — LIFF-ready
- ฟิลด์: ชื่อจริง · ชื่อเล่น · อายุ (number) · ระดับการศึกษา (select) · แนวเพลงที่ชอบ (chips หลายตัว) · เหตุผลอยากเรียน (textarea) · ยอมรับ PDPA (checkbox)
- ปุ่ม: "สมัครสมาชิก" + ทางเลือก "สมัครด้วย LINE (LIFF)" — ถ้าผ่าน LINE มา จะเติมชื่อ/รูปให้อัตโนมัติ
- Validation: ครบทุกช่อง + consent → error inline

#### 5.2.3 เข้าสู่ระบบ (`/login`)
- อีเมล/เบอร์ + รหัสผ่าน · "เข้าสู่ระบบด้วย LINE" · ลิงก์สมัคร · demo hint (admin)

#### 5.2.4 ซื้อแพ็กเกจ (`/app/packages`)
- การ์ด 3 แพ็กเกจ (10/20/30 ชม. + ราคา + คุ้มค่า) → **Modal ซื้อ:** เลือกแพ็กเกจ → วอเชอร์ (validate เรียลไทม์) → สรุปยอด (ราคา − ส่วนลด) → ช่องทางชำระ (บัตร / KBank) → จ่าย → ใบเสร็จ
- แสดงชั่วโมงคงเหลือปัจจุบัน

#### 5.2.5 จองเวลาเรียน (`/app/booking`) — ปฏิทิน
- 7 วัน (chips) → สล็อต 60 นาที (เต็ม/ปิด = disabled) → การ์ดสรุป (วัน-เวลา, ครู, วิธีหักชั่วโมง, ชั่วโมงคงเหลือ) → "ยืนยันการจอง"
- กันสล็อต: ถ้าโดนจองก่อน → toast error + refresh

#### 5.2.6 นัดหมายของฉัน (Home / นัดถัดไป)
- การ์ด "นัดถัดไป" + สถานะ (รอคอนเฟิร์ม/ยืนยันแล้ว/รอเลื่อน) + ปุ่ม **ยืนยันการมาเรียน / ขอเลื่อนนัด**
- Modal ขอเลื่อน: เลือกวัน-เวลาใหม่ → ส่งคำขอ → ขึ้นสถานะ "รอเลื่อนนัด"

#### 5.2.7 ประวัติการเรียน (`/app/history`)
- ตาราง: วันที่ · คลาส · บันทึกครู · ชั่วโมงที่ใช้ · สถานะ

#### 5.2.8 ใบเสร็จ (`/app/receipts`)
- ตารางการซื้อ (เลขที่, วันที่, แพ็กเกจ, วอเชอร์, ยอด, ช่องทาง) → Modal ใบเสร็จ (โลโก้ + รายการ + ยอด) → ดาวน์โหลด PDF

#### 5.2.9 Profile (`/app/profile`)
- แสดง 6 ฟิลด์ + ป้าย LINE (เชื่อม/ยังไม่เชื่อม) + ปุ่ม "เชื่อมต่อ LINE" (LIFF liff.login) + แก้ไขข้อมูล + PDPA note

#### 5.2.10 Admin / Teacher Dashboard (Desktop-first, responsive)

| หน้า | องค์ประกอบ |
|---|---|
| **ตารางสอน** | รายการสล็อตรายวัน + สถานะ (ยืนยันแล้ว/รอคอนเฟิร์ม/ว่าง/ปิด) · ปุ่มบันทึกการสอน / No-show / ปิดสล็อต · แบนเนอร์นัดยังไม่คอนเฟิร์ม |
| **คำขอเลื่อนนัด** | ตารางคำขอ + badge จำนวนรอ · ปุ่ม อนุมัติ/ปฏิเสธ → แจ้งนักเรียนอัตโนมัติ |
| **นักเรียน** | ตาราง + ค้นหาเรียลไทม์ + สถานะแพ็กเกจ/ชั่วโมงคงเหลือ |
| **ยอดขาย** | KPI (รายได้/ออเดอร์/วอเชอร์/นักเรียนใหม่) + กราฟ 12 เดือน + ตารางขายล่าสุด |
| **วอเชอร์** | ตารางโค้ด/ใช้แล้ว/สถานะ + ฟอร์มสร้างวอเชอร์ |
| **ตั้งค่า** | แพ็กเกจ · สล็อตสอน (เปิด/ปิด) · ข้อความอัตโนมัติ · ช่องทางแจ้งเตือน · ความปลอดภัย/PDPA |

---

## 6. Security · PDPA · Edge Cases

### 6.1 Security (กำหนดมาตรการ)

| หมวด | มาตรการ |
|---|---|
| **Transport** | HTTPS บังคับ · HSTS · TLS 1.2+ |
| **Auth** | Argon2/bcrypt (cost ≥ 12) · JWT อายุสั้น (15 นาที) + Refresh rotate · rate-limit ล็อกอิน (5 ครั้ง/15 นาที) + ล็อก IP |
| **RBAC** | Middleware ตรวจ role (student/teacher/admin) ทุก route · หน้าแอดมินห้าม student เข้า (guard) |
| **API** | Input validation ทุก endpoint · SQL parameterized (ORM) · กัน XSS/CSRF (CORS + SameSite + token) · ไม่ leak id (ใช้ UUID) |
| **เงิน** | Webhook signature (HMAC/KBank key) ตรวจทุกครั้ง · idempotency `payment_ref` · เงินเก็บเป็น numeric เท่านั้น · audit log ทุกการเปลี่ยนสถานะ |
| **LINE** | ตรวจ `X-Line-Signature` ทุก webhook · `liff.init` verify · ไม่เชื่อ payload จาก client (เฉพาะ userId จาก server) |
| **Data-at-rest** | เข้ารหัสไฟล์ (S3 SSE) · คอลัมน์ sensitive (email/เบอร์/line_user_id) encrypt column หรือ DB-level |
| **Secrets** | .env ไม่ commit · Key Vault · แยก key staging/prod · หมดอายุคีย์ KBank ตามสัญญา |

### 6.2 PDPA (กฎหมายคุ้มครองข้อมูลส่วนบุคคล)

1. **ฐานการประมวลผล:** ยินยอม (Consent) — checkbox แยกจากเงื่อนไขใช้บริการ + บันทึกวัน/เวลา (consent_pdpa_at)
2. **คำชี้แจงความเป็นส่วนตัว:** หน้านโยบาย PDPA ชัดเจน: เก็บอะไร (ชื่อ/อายุ/การศึกษา/แนวเพลง/เหตุผล/ข้อมูล LINE/ธุรกรรมการเงิน), ใช้ทำอะไร, เก็บนานแค่ไหน, ส่งให้ใคร (KBank/LINE)
3. **Data Minimization:** เก็บเฉพาะที่จำเป็น — เหตุผลอยากเรียนใช้เพื่อออกแบบคอร์สเท่านั้น
4. **ระยะเวลาเก็บ:** บัญชี/ธุรกรรมเงิน เก็บตามกฎหมาย (≥ 10 ปี) · ข้อมูลส่วนเกินลบเมื่อเลิกเป็นนักเรียน
5. **สิทธิ์เจ้าของข้อมูล (DSR):** หน้า/ช่องทาง ขอสำเนา · แก้ไข · ลบ (ลบ = anonymize ข้อมูล, เก็บธุรกรรมเงินแบบไม่ระบุตัวตน) — SLA ตอบกลับภายใน 30 วัน
6. **การรั่วไหล:** แผนแจ้ง สคส. ภายใน 72 ชม. + แจ้งเจ้าของข้อมูลหากเสี่ยงสูง
7. **ผู้ประมวลผลภายนอก:** สัญญา DPA กับ KBank / LINE / cloud provider
8. **Audit:** log การเข้าถึงข้อมูลนักเรียนทุกครั้ง (ใคร/เมื่อไหร่/ดูอะไร) — ป้องกันพนักงานแอบดู

### 6.3 Edge Cases (ตารางจัดการ — ต้อง implement ทุกข้อ)

| # | สถานการณ์ | การจัดการ |
|---|---|---|
| 1 | **ขอเลื่อนนัดกะทันหัน (< 24 ชม.ก่อนเรียน)** | อนุญาตแต่ขอสล็อตใหม่ → ต้องให้ครูอนุมัติ · ระบบแจ้งครูทันที (LINE) + flag ด่วน |
| 2 | **ยกเลิกนัดกะทันหัน** | ไม่อนุญาตอัตโนมัติ < 24 ชม. → บังคับติดต่อครู/แจ้ง no-show policy (ไม่หักชั่วโมงแต่ต้องแจ้ง) |
| 3 | **แพ็กเกจหมดอายุ 6 เดือน** | จองไม่ได้ (ตรวจ expires_at) · หน้าจองแสดง "หมดอายุแล้ว — ซื้อเพิ่ม" · Cron แจ้งเตือนก่อนหมดอายุ 14/7/1 วัน |
| 4 | **ชั่วโมงไม่พอจอง** | บล็อก + แนะนำซื้อแพ็กเกจ · กันจองเกิน (ตรวจ hours_left ตอนจอง) |
| 5 | **ชำระเงิน timeout / ไม่อัปเดต webhook** | payment.expired หลัง 15 นาที · Job ตรวจ pending ค้าง → ถาม KBank (status query API) · ถ้ายอดเข้าแต่ webhook ตก → reconcile อัตโนมัติ |
| 6 | **จ่ายซ้ำ / double click** | idempotency `payment_ref` → ครั้งที่ 2 ตอบ success เดิม ไม่สร้างแพ็กเกจซ้ำ |
| 7 | **สล็อตโดนจองพร้อมกัน (race condition)** | ล็อกแถว + Redis lock + `version` optimistic → คนแพ้เห็น "สล็อตเพิ่งถูกจอง" |
| 8 | **ครูปิดสล็อต/ยกเลิกคาบ** | ปิดสล็อต → booking ที่ค้างอยู่แจ้งนักเรียนย้าย/เลื่อน · กันจองสล็อตที่ปิด |
| 9 | **นักเรียนไม่มา (no-show)** | ครูบันทึก no-show → ไม่หักชั่วโมง (ตาม Brief) → นัดถัดไป ระบบแจ้งเตือนเพิ่ม |
| 10 | **วอเชอร์ใช้ซ้ำ/หมดอายุ** | ตรวจ code+ช่วงเวลา+max_uses ฝั่ง server เท่านั้น · ห้าม client คำนวณส่วนลด |
| 11 | **LINE ไม่ผูก / ยกเลิกผูก LINE** | Push ส่งไม่ได้ → fallback: อีเมล + แจ้งเตือนในเว็บ · แจ้ง "ผูก LINE เพื่อรับแจ้งเตือน" |
| 12 | **วันหยุด/ปิดเทอมของครู** | ครูตั้ง "ปิดสล็อต" ล่วงหน้าได้ทั้งช่วง (bulk close) · ปฏิทินไม่แสดงสล็อตที่ปิด |
| 13 | **นักเรียนลบข้อมูล (PDPA)** | ลบ/anonymize แต่คงธุรกรรมเงินแบบนิรนาม + ปิดบัญชีทันที |
| 14 | **ผู้ใช้แชร์ลิงก์จ่ายเงิน** | ลิงก์จ่ายผูก session/user → หมดอายุ 15 นาที · กันจ่ายแทนกัน (ตรวจ ownership) |
| 15 | **เวลาต่างโซน/การเปลี่ยนเวลา (DST)** | เก็บ UTC, แสดง Asia/Bangkok ผ่าน lib กลาง (date-fns-tz/Luxon) |

---

## 7. REST API Summary

| Method | Endpoint | บทบาท | คำอธิบาย |
|---|---|---|---|
| POST | `/api/auth/register` | public | สมัคร (หรือ `/auth/line` ผ่าน LINE Login) |
| POST | `/api/auth/login` | public | ล็อกอิน → JWT |
| GET | `/api/me` | student | โปรไฟล์ + แก้ไข (PATCH) |
| GET | `/api/packages` | all | แคตตาล็อกแพ็กเกจ |
| POST | `/api/transactions` | student | สร้างคำสั่งซื้อ (ตรวจวอเชอร์) |
| POST | `/api/transactions/:id/pay` | student | สร้าง payment → ส่งไป KBank |
| POST | `/api/webhooks/kbank` | public+sign | รับผลชำระเงิน |
| POST | `/api/webhooks/line` | public+sign | รับ postback/message |
| GET | `/api/slots?date=...` | student | สล็อตที่ว่าง (7 วัน) |
| POST | `/api/bookings` | student | จอง (ล็อกสล็อต) |
| POST | `/api/bookings/:id/confirm` | student | คอนเฟิร์มนัด |
| POST | `/api/bookings/:id/move` | student | ขอเลื่อนนัด |
| GET | `/api/me/lessons` | student | นัดหมายของฉัน |
| GET | `/api/me/history` / `receipts` | student | ประวัติ/ใบเสร็จ |
| GET/POST | `/api/admin/slots` | teacher/admin | ตารางสอน + เปิด/ปิดสล็อต |
| POST | `/api/admin/lessons/:id/log` | teacher | บันทึก Class Log + หักชั่วโมง |
| GET/POST | `/api/admin/move-requests/:id/decide` | admin | ดู/ตัดสินคำขอเลื่อน |
| GET | `/api/admin/students` | admin | นักเรียน + ค้นหา |
| GET | `/api/admin/reports/sales` | admin | ยอดขาย/สถิติ |
| GET/POST | `/api/admin/vouchers` | admin | วอเชอร์ |

> Webhook ทั้ง KBank และ LINE ต้อง: ตรวจ signature → ตอบ 200 เร็ว → process แบบ async (queue)

---

## 8. Checklist ส่งมอบงาน

### ทีม Developer
- [ ] Scaffold: React+Vite (ใช้ `webapp/` เป็นฐาน) + NestJS + PostgreSQL (schema จากหัวข้อ 3)
- [ ] Auth: JWT + RBAC + LINE Login (LIFF `liff.login()` + Messaging `linkRichMenu`)
- [ ] Module: Package/Voucher → Transaction → Payment (KBank sandbox) → Webhook
- [ ] Module: Booking (lock สล็อต) + State machine (หัวข้อ 4.6) + Cron เตือน/ทวง/expiry
- [ ] LINE: Rich Menu 6 ปุ่ม · Flex Message 4 แบบ · LIFF 5 หน้า · `X-Line-Signature`
- [ ] Admin: ตารางสอน/Class Log/คำขอเลื่อน/รายงาน/วอเชอร์
- [ ] Security checklist (หัวข้อ 6.1) + Edge case ทดสอบครบ (หัวข้อ 6.3)
- [ ] UAT กับครูแอร์บน staging + ทดสอบ KBank sandbox จริง (บัตรทดสอบ + QR)

### ทีม Designer
- [ ] Design tokens ธีมชมพู-ขาว (จาก `webapp/src/index.css`) → Figma
- [ ] Wireframe→Hi-fi: 10 หน้าจอเว็บ (หัวข้อ 5.2) + LIFF 5 หน้า + Admin 6 หน้า
- [ ] Rich Menu art (6 ปุ่ม 1080×810) + Flex Message template 4 แบบ + โลโก้ K-monogram
- [ ] Responsive breakpoint: 375 / 768 / 1280

---

*เอกสารนี้ใช้เป็นข้อกำหนดกลาง (Single Source of Truth) — กรณีขัดแย้งกับ design-spec.md ให้ยึดเอกสารนี้ แล้วอัปเดต design-spec ให้ตรงกัน*
