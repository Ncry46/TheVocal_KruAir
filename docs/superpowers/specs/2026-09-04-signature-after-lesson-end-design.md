# Design: Auto signature on lesson day

Date: 2026-09-04  
Status: approved (revised)

## Goal

On a day the student has a confirmed lesson, the signature pad appears **automatically** (no need to wait for the teacher to mark the class done first).

Signing is allowed **only on that calendar day** (`Asia/Bangkok` = `slot_date`).

## Rules

1. `GET /api/me/signatures/pending` lists today’s bookings with status `confirmed` / `moved` / `done` that still need a signature (no `class_logs` row, or `done` without `student_signature`). Excludes `no_show`.
2. `POST /api/me/signatures/:bookingId`:
   - Must be the lesson day
   - If no `class_logs` yet → create `done` log + save signature + mark booking done + deduct hours
   - If log exists unsigned → save signature + deduct hours if not charged
3. Teacher can still attach note / homework audio after the student signed first (update existing log).

## Frontend

- Filter defaults to today; list normally shows only today’s class(es)
