# Design: Student receipts page (responsive)

Date: 2026-09-08  
Status: implemented (user approved C)

## Goal

Make the student **Receipts / Purchases** page easy to use on phone and desktop: clear hierarchy, scannable list, readable receipt detail — without a separate mobile/desktop component tree.

## Approach

**C — Single “receipt row / mini-statement” layout** that reflows:
- Narrow: stacked fields (date → package → amount → status → action)
- Wide: one horizontal row with the same fields aligned

No dense 7-column table.

## UI structure

### 1. Page header
- Title (i18n): receipts / purchase history
- Meta: total count badge
- Optional secondary: sum of successful payment amounts (same data already on list; no new API)

### 2. List
Each receipt item shows:
- Date
- Package name (+ hours already in `pkg` string)
- Amount (฿)
- Payment method (secondary / muted)
- Status badge (tone by status when possible; keep green for paid/success)
- Primary action: “View receipt”

Empty state: short message + link hint to packages if zero items.

### 3. Receipt modal
- Brand logo + “Electronic receipt” + ref no (`id`)
- Rows: date, package, voucher, method, payment ref (if present)
- Total amount emphasized
- Close via modal chrome; keep existing PDF button as toast-only mock (no real PDF in this change)

### 4. i18n
Replace hardcoded Thai strings with `translations.js` (`receipts.*`) for TH/EN.

## Non-goals
- Real PDF generation / download
- Filtering, search, or pagination
- Backend/API changes (reuse `GET /api/me/receipts`)
- Redesign of teacher payment pages

## Visual language
Stay inside existing app tokens (`Card`, `Badge`, `Button`, `Modal`, existing CSS variables). Prefer list/row patterns already used on booking/home — not a new marketing landing style.

## Success criteria
- Readable on ~360px width without horizontal scroll
- Desktop still scannable in one pass
- Open receipt detail in ≤2 taps
- TH/EN labels complete for visible strings
