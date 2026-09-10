# Design: Fixed-time lesson / homework reminders

Date: 2026-09-07  
Status: approved (user: จัดการได้เลย)

## Rules (Asia/Bangkok)

1. **09:00 daily** — notify students with a lesson **tomorrow** (`slot_date = today + 1`)
2. **09:30 daily** — notify students with a lesson in **3 days** (`slot_date = today + 3`) to do homework / practice

## Behavior

- Jobs still tick every 5 minutes; each reminder type runs at most once per Bangkok calendar day when local time is in the matching window (09:00–09:04 / 09:30–09:34)
- Targets: bookings `pending` or `confirmed` only
- Day-1 uses existing `reminder_sent_at` + existing LINE/in-app delivery
- Day-3 uses new `homework_reminder_sent_at` + in-app notification (LINE optional same pattern if easy)

## Non-goals

- Changing confirm-expiry / low-hours / package-expiry jobs
- Exact second-level cron (5-minute tick is enough)
