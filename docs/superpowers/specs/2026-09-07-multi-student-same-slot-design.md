# Design: Multi-student same time slot (teacher-only booking)

Date: 2026-09-07  
Status: approved (approach A — simple)

## Goal

Allow **many students in the same teaching hour**, each as a **separate booking** (own hours deduct, own sign-in/out, own teacher check-in).  
Students **can self-book** again; teachers can also book. Open hours are shareable (not exclusive).

## Product rules

| Rule | Detail |
|------|--------|
| Capacity | Unlimited students per open hour |
| Booking ownership | One booking = one student |
| Hours / signatures | Per booking (unchanged dual student sign + teacher check-in) |
| Who books | Teacher/admin **and** student self-book |
| Student self-book | Enabled (same as before; open hours are shareable) |
| Slot meaning | `open` = teachable hour; `closed` = not bookable. Do **not** treat “has bookings” as full |

## Slot model change

**Before:** one active booking per hour → slot becomes `booked` → full.  
**After:** slot stays `open` while teachable; bookings stack on that hour; only `closed` blocks new bookings.

### Data / constraints to change

1. Stop flipping availability to exclusive `booked` when creating a booking (or stop using `booked` as capacity lock).
2. Relax / replace:
   - `booking_slots` PK on `slot_id` alone → allow multiple bookings per slot (e.g. PK `(booking_id, slot_id)`)
   - filtered unique `UX_bookings_active_slot` on `bookings.slot_id`
3. `lockSlotsForBooking`: require each hour `status = open` (not `closed`); do **not** reject because another booking already uses that hour; do **not** CAS the whole hour to exclusive `booked`.
4. Cancel / expire: remove that booking’s `booking_slots` rows; **do not** close or “unbook” the hour for everyone else. Hour stays `open` unless teacher closed it.
5. Closing a slot: still blocks **new** bookings; decide UX for existing bookings that day (keep existing cancel-on-close behavior or leave existing bookings — prefer **leave existing bookings**, only block new; if current code cancels on close, document chosen behavior in implementation plan and keep it simple).

### Multi-hour lessons

If `duration_hours > 1`, require every hour in the span to be `open` (not `closed`). Each hour may already have other students. Link all hours in `booking_slots` for that booking only.

## API

- Keep student `POST /api/bookings` and teacher `POST /api/teacher/bookings`.
- `GET /api/slots` / student day pickers: `full` only when slot is `closed` (open hours stay bookable even with other students).
- Teacher schedule payload: **multiple lessons** at the same `slot_time` (list, not 1:1 with slot row).

## UI

### Teacher Schedule (primary)

- Same hour can list several students.
- “นัดนักเรียน” works even when that hour already has students (as long as slot is open).
- Selecting one student shows that booking’s chips/actions (check-in, log, cancel) only for that person.

### Student

- Self-booking UI restored (calendar + time slots + confirm).
- Open hours remain selectable even if another student already booked that hour.

## Non-goals (this round)

- Group class (one booking, many students)
- Configurable capacity limit
- Reworking payment or package rules beyond per-booking deduct

## Self-review

- Matches: unlimited, separate bookings, shareable open hours; student self-book restored
- No conflict with dual student signatures or teacher check-in (still per booking)
- Scope stays on availability + schedule UX + booking create paths
