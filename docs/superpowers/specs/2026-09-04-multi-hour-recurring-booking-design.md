# Multi-hour booking + teacher weekly schedule

**Date:** 2026-09-04  
**Status:** Approved

## Goals
1. Students and teachers can book lessons longer than 1 hour (consecutive open slots).
2. Teachers can set recurring weekly days/times for a regular student and generate upcoming bookings.

## Multi-hour booking
- Student booking UI: choose duration 1–N hours, capped by remaining package hours.
- Start time must have N consecutive open teacher slots within business hours (10:00–19:00).
- API `POST /api/bookings` accepts `hours` (integer ≥ 1); reuses existing `createLessonBooking` / `duration_hours`.
- Hours deducted after lesson signature remain based on `duration_hours`.

## Weekly recurring (teacher only)
- Teacher manages rules on student profile: weekday + start time + duration + studio/online.
- Multiple weekdays allowed (e.g. Mon + Wed).
- Generate up to **4 occurrences per rule** ahead, chronologically across all rules, **stopping when remaining hours are insufficient**.
- Conflict/closed slots: skip that occurrence; report skips to teacher.
- Deleting a rule does not auto-cancel already created bookings.
- Creating/updating rules can trigger generate; also explicit “Generate next 4 weeks” action.

## Out of scope
- Student-created recurring schedules
- Unlimited auto-generation beyond 4 weeks
- Auto-cancel of existing bookings when a rule is removed
