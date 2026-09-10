# Multi-student same slot Implementation Plan

**Goal:** Unlimited separate student bookings on the same open teaching hour; teacher-only booking.

**Status:** Implemented 2026-09-07

### Done

- [x] Schema: `booking_slots` PK `(booking_id, slot_id)`; drop `UX_bookings_active_slot`; normalize `booked` → `open`
- [x] `lockSlotsForBooking` shareable hours (block only `closed`)
- [x] Cancel / reschedule / move / close without exclusive seat lock
- [x] Disable `POST /api/bookings` for students
- [x] Teacher Schedule lists multiple students per hour; book again on open hours
- [x] Hide student booking nav; Booking page shows teacher-schedules message

### Verify manually

- Restart backend so schema migration runs
- On Schedule: นัดนักเรียน 2 คน เวลาเดียวกัน
- Student: cannot self-book
