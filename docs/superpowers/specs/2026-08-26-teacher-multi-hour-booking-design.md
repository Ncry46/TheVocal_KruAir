# Design: Teacher-initiated multi-hour lessons (Set C)

**Date:** 2026-08-26  
**Status:** Approved for implementation  
**Approach:** A — one booking + start time + duration hours

## Goal

Teacher primarily schedules lessons for students (day + start time + duration hours). Student receives an in-app notification and must confirm. Hours are deducted by `duration_hours` when the teacher logs the class. Students may still self-book open 1-hour slots.

## Decisions

| Topic | Choice |
|-------|--------|
| Who books | Teacher primary; student can book open slots |
| Deduct hours | On class log (done / no-show), by duration |
| Multi-hour UI | Day + start time + hours count |
| Slot locking | Lock consecutive open slots for the duration |

## Data

- Add `bookings.duration_hours INT NOT NULL DEFAULT 1`
- Primary `slot_id` = start slot; consecutive slots on same day marked `booked`
- Cancel / expire reopens all slots in the duration block

## API

- `POST /api/teacher/bookings` — `{ studentId, day, time, hours, topic? }`
- Existing student confirm / cancel; optional reject uses cancel
- Class log deducts `duration_hours`
- Schedule + `/api/me/lessons` expose `hours` / end time

## Out of scope

LINE OA push, Google Calendar, QR payment (other sets)
