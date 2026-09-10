# Design: Teacher batch-book multiple students (same slot)

Date: 2026-09-07  
Status: approved (user: same day/time, one save)

## Goal

Teacher picks **many students** + one day/time/hours → **one Save** creates separate bookings.

## Behavior

- UI: multi-select checklist of students
- Shared: day, time, hours, topic
- API: `POST /api/teacher/bookings` accepts `studentIds: number[]` (also still accepts single `studentId`)
- Each student gets own booking; skip failures (e.g. not enough hours) and return `{ created, failed: [{ studentId, name, error }] }`
- Toast summarizes success / partial failure

## Non-goals

- Different times per student in one submit
- Drag-and-drop UI beyond checkbox multi-select
