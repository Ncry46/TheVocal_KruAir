# Design: Teacher check-in after class (with student signature)

Date: 2026-09-07  
Status: approved

## Goal

After a class finishes, **both sides** confirm attendance:

- **Student** — existing signature on lesson day (unchanged)
- **Teacher** — new **check-in** button, separate from “บันทึกคลาส / โน้ตการบ้าน”

## When teacher can check in

- Lesson calendar day = today (`Asia/Bangkok`)
- **And** current time ≥ scheduled lesson end (`slot_start + duration_hours`)
- Booking status: `confirmed` / `moved` / `done` (not cancelled / no_show)
- Not already checked in

## Data

On `class_logs` (or booking if no log yet):

- `teacher_checked_in_at DATETIME2 NULL`

If teacher checks in before any `class_logs` row exists, create a minimal `done` log (or attach check-in on booking then copy to log later). Prefer storing on `class_logs` and creating a stub log when needed so one place holds attendance.

## API

- `POST /api/teacher/bookings/:id/check-in` — teacher/admin only; validates time window; sets `teacher_checked_in_at`
- Teacher today / schedule / student profile payloads include:
  - `teacherCheckedIn` / `teacherCheckedInAt`
  - `studentSigned` (existing)
  - `canCheckIn` (bool for UI)

## UI

- **Today** and **Schedule** lesson cards: show status chips (นักเรียนเซ็นแล้ว / ครูเช็คอินแล้ว) + **เช็คอิน** button when `canCheckIn`
- Keep existing “บันทึกคลาส” for notes / no-show / homework audio — not required for check-in
- Student Homework signature flow unchanged; hours still deduct on **student signature**

## Non-goals

- Replacing student signature with a plain button
- Blocking hour deduction until teacher check-in (unless requested later)
- Teacher signature pad

## Self-review

- Matches choice A (separate teacher check-in) + timing A (after end on lesson day)
- No conflict with student day-signature rules
