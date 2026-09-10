# Design: Student sign-in + sign-out signatures

Date: 2026-09-07  
Status: approved (user chose A)

## Goal

On lesson day the student signs **twice**:

1. **Sign-in (เข้าเรียน)** — from scheduled start time onward  
2. **Sign-out (หลังเรียน)** — after scheduled end time  

Hours deduct **only on sign-out**.

## Timing (Asia/Bangkok)

| Kind | When allowed |
|------|----------------|
| Sign-in | `slot_date` = today AND `start <= now <= end` (ตามเวลาเรียนเท่านั้น) AND no sign-in yet |
| Sign-out | `slot_date` = today AND `end <= now <= end + 30 minutes` AND sign-in done AND no sign-out yet |

Must sign in before sign-out. Sign-out has a **30-minute grace** after lesson end.

## Data (`class_logs`)

- Keep `student_signature` / `signed_at` = **sign-out** (post-lesson; hours deduct here)  
- Add `student_checkin_signature` / `student_checked_in_at` = **sign-in**

## API

- `GET /api/me/signatures/pending` — today’s bookings needing sign-in and/or sign-out; each row: `kind: 'checkin' | 'checkout'`, `canSign`, times  
- `POST /api/me/signatures/:bookingId` — body `{ signature, kind }`  
  - `checkin` → save check-in pad; create stub log if needed (do **not** mark booking done / deduct)  
  - `checkout` → require prior check-in; save sign-out + deduct hours (existing logic)

## UI (Homework)

- Two pads when both pending (or one at a time by phase)  
- Labels: เซ็นเข้าเรียน / เซ็นหลังเรียน  
- Filter still defaults to today

## Teacher UI

- Show student checked-in + signed-out status (reuse chips)

## Non-goals

- Changing teacher check-in rules  
- Deducting hours on sign-in
