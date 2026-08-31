# Design: Catalog & per-student course offers (Set A)

**Date:** 2026-08-26  
**Status:** Approved for spec review  
**Scope:** Pricing / courses only (Set A). Payments QR/installments, teacher-initiated booking, LINE OA, Google Calendar, signatures, homework, and report export are out of scope.

## Goal

Replace the old public package catalog with a teacher-managed standard catalog (including a 1-hour ฿2,500 option), and let the teacher create per-student course offers at custom prices—either granting hours immediately or leaving them pending payment for a later payment set.

## Decisions (locked)

| Decision | Choice |
|----------|--------|
| Model | Standard catalog **and** per-student offers |
| Old packages (beginner / pro / master) | Stop selling (`is_active = N`); do not delete rows |
| Existing student hour balances | Keep as-is |
| Public / student package page | Show active standard packages (1h ฿2,500 + teacher-defined packs) |
| Per-student offer on create | Teacher chooses **grant now** or **pending payment** |
| Data approach | Catalog in `packages` + new `student_offers`; hours still via `user_packages` |

## Architecture

```
packages (standard, teacher-editable)
    └─ student buys (existing purchase flow; mock until Set B)
         └─ user_packages (hours)

student_offers (private, per user)
    ├─ grantNow=true  → user_packages + status=granted
    └─ grantNow=false → status=pending_payment (Set B collects payment later)
```

Isolation:

- **Catalog service** — list/update standard packages for Settings and public/student package pages.
- **Offers service** — create/list/cancel student offers; grant path writes `user_packages`.
- **Existing purchase + package-status** — unchanged contracts where possible; only catalog content and new offer endpoints change.

## Data model

### `dbo.packages` (existing)

No structural change required beyond seed/content.

| Field | Use |
|-------|-----|
| `id` | Stable string id (e.g. `single` for 1 hour) |
| `name` / `name_en` | Display |
| `hours` | Integer hours |
| `price` | Integer THB |
| `note` / `note_en`, `tag` / `tag_en`, `tone` | Marketing copy |
| `is_active` | `Y` = sellable / visible on public+student catalog |

**Seed / migration**

1. Set `is_active = N` for `beginner`, `pro`, `master` (and any other legacy sellable packs except the new catalog).
2. Upsert package `single` (or equivalent): 1 hour, price **2500**, active, bilingual labels (e.g. Thai “เรียน 1 ชั่วโมง”, EN “1-hour lesson”).
3. Teacher may add more standard packages later via Settings (new ids generated server-side, e.g. `pkg-…`).

Historical `transactions` / `user_packages` that reference inactive package ids remain valid.

### `dbo.student_offers` (new)

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT identity PK | |
| `public_id` | NVARCHAR(40) unique | External id |
| `user_id` | INT FK → users | Student |
| `title` / `title_en` | NVARCHAR | Course label |
| `hours` | INT | > 0 |
| `price` | INT | ≥ 0, whole baht |
| `note` / `note_en` | NVARCHAR NULL | Optional |
| `status` | NVARCHAR(20) | `pending_payment` \| `granted` \| `cancelled` |
| `user_package_id` | INT NULL FK | Set when granted |
| `created_by` | INT FK → users | Teacher |
| `created_at` / `updated_at` | DATETIME2 | |

Rules:

- Only the owning student and staff (teacher/admin) can read an offer.
- Cancel allowed when `status = pending_payment` (and optionally never-granted only).
- Granting does **not** auto-revoke hours if an offer is later cancelled after `granted`; staff adjust account manually if needed.
- One grant creates **one** `user_packages` row (hours_total = offer.hours, hours_used = 0, status active, sensible expiry policy matching existing packages or “no expiry” if that is already the app default—follow existing `user_packages` creation pattern).

## API

### Standard catalog (staff)

- `GET /api/admin/packages` — list all packages including inactive (Settings).
- `POST /api/admin/packages` — create standard package.
- `PATCH /api/admin/packages/:id` — update fields / toggle `is_active`.

Auth: `requireRole(['teacher', 'admin'])` (same staff gate as other admin APIs).

### Public / student catalog

- `GET /api/packages` — active packages only (`is_active = Y`), used by Landing and `/app/packages`.

### Student offers

- `POST /api/teacher/students/:id/offers`  
  Body: `{ title, titleEn?, hours, price, note?, noteEn?, grantNow: boolean }`  
  - Validates target is an active student.  
  - If `grantNow`: insert offer `granted` + `user_packages` + link `user_package_id`.  
  - Else: insert `pending_payment`.
- `GET /api/teacher/students/:id/offers` — list offers for that student.
- `PATCH /api/teacher/offers/:publicId` — `{ status: 'cancelled' }` when cancellable.
- `GET /api/me/offers` — current student’s offers (all non-cancelled, or include cancelled for history—default: exclude `cancelled`).

Purchase of **standard** packages continues via existing `createPackagePurchase` / checkout UI until Set B replaces mock payment. Pending offers are **display + status only** in Set A (pay button may be disabled or labeled “รอชำระ” without charging).

## UI

### Student

- `/app/packages` and Landing `#packages`: render active standard catalog (must show 1h ฿2,500).
- Same area or adjacent card: “คอร์สที่ครูจัดให้” from `GET /api/me/offers` with status badges (`รอชำระ` / `เพิ่มชั่วโมงแล้ว`).
- Home / package-status unchanged for remaining hours.

### Teacher

- **Settings → Packages:** CRUD for standard catalog (replace hard-coded legacy assumptions).
- **Students (or user row actions):** “เพิ่มคอร์สให้คนนี้” modal → title, hours, price, grant now vs pending payment; list existing offers with cancel for pending.

### Content / seed files

- Update `data/packages.json` (and any seed scripts) to match the new catalog so local/docker seeds stay consistent.
- i18n strings for new UI labels (TH/EN).

## Error handling

| Case | Behavior |
|------|----------|
| Create offer for non-student / inactive user | 400 |
| hours ≤ 0 or price < 0 | 400 |
| Cancel already granted / cancelled | 400 with clear message |
| Student requests another student’s offers | 403 / empty via auth scope |
| Legacy inactive package id in old receipt | Still displayable via joins; not listed in sellable catalog |

## Testing

- Migration: legacy packs inactive; `single` active at 2500 / 1h; existing `user_packages` row counts unchanged.
- `GET /api/packages` returns only active; does not return beginner/pro/master.
- Staff can create/update standard package; inactive disappears from public list.
- Offer grantNow=true increases student hours via package-status.
- Offer grantNow=false appears on `GET /api/me/offers` as pending; hours unchanged.
- Cancel pending removes it from student active offers; cancel after grant rejected.
- Role checks: student cannot create offers; teacher can.

## Out of scope (explicit)

- Real QR / bank transfer / installment links (Set B)
- Teacher-initiated booking + student accept (Set C)
- Post-lesson signature, homework (Set D)
- Google Calendar, LINE OA push (Set E)
- Report file export (Set F)
- Auto-refund or clawback of granted hours

## Success criteria

1. Old packages no longer offered for sale; existing hours preserved.
2. Catalog shows 1-hour ฿2,500 and teacher-managed standard packs.
3. Teacher can add a custom course per student with grant-now or pending-payment.
4. Students see their private offers; pending does not add hours until granted (or paid in Set B).
