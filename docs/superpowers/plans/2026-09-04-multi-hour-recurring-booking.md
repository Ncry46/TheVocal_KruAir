# Multi-hour + Recurring Weekly Booking Implementation Plan

> **For agentic workers:** Implement task-by-task. Checkboxes track progress.

**Goal:** Let students book multi-hour lessons and let teachers set weekly recurring schedules that generate up to 4 weeks of bookings (capped by remaining hours).

**Architecture:** Reuse `createLessonBooking` + consecutive slots. Add `student_recurring_schedules` table and teacher CRUD/generate APIs. Student booking UI gains an hours selector; student profile gains weekly schedule management.

**Tech Stack:** Express, SQL Server, React

## Global Constraints
- Weekday uses JS `getDay()` (0=Sun … 6=Sat)
- Max generate horizon: 4 occurrences per rule
- Do not exceed remaining package hours
- Skip conflicts; do not fail the whole generate batch

---

### Task 1: Student multi-hour booking
- [ ] Accept `hours` on `POST /api/bookings`
- [ ] Pass hours from `apiClient.createBooking`
- [ ] Hours picker on `Booking.jsx` + consecutive-slot validation
- [ ] i18n strings

### Task 2: Recurring schedule backend
- [ ] Schema + store helpers in `recurringSchedule.js`
- [ ] Teacher list/create/delete/generate routes
- [ ] Wire schema ensure on startup path

### Task 3: Teacher UI
- [ ] Weekly schedule card on `StudentProfile.jsx`
- [ ] apiClient methods + translations + light CSS
