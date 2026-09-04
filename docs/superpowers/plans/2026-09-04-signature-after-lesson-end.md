# Signature After Lesson End Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** Allow student signatures only when the teacher marked the class done and the scheduled lesson end time has passed.

**Architecture:** Reuse `slotStartAt` from `bookingPolicy.js` for Bangkok-local end time; enforce on pending list + POST; UI shows locked wait state when `canSign` is false.

**Tech Stack:** Node.js backend, Express, React frontend, node:test

## Global Constraints

- Both: teacher `outcome = done` AND `now >= lesson end`
- Timezone semantics match existing `slotStartAt` (local wall clock as used elsewhere)
- Multi-hour uses `duration_hours`
- Do not commit unless user asks

---

### Task 1: End-time helpers + tests

**Files:**
- Modify: `backend/src/bookingPolicy.js`
- Create/Modify: `backend/src/bookingPolicy.test.js`
- Modify: `backend/package.json` test script if needed (file already included)

- [ ] Add `lessonEndsAt(isoDate, hhmm, durationHours)` and `canSignLesson({ endsAt, now })`
- [ ] Tests: 1h and 2h; before / at / after end
- [ ] Run: `npm test --prefix backend`

### Task 2: API gate

**Files:**
- Modify: `backend/src/routes.js` (`GET /api/me/signatures/pending`)
- Modify: `backend/src/store.js` (`signLessonAndDeductHours`)

- [ ] Pending returns `endsAt`, `canSign`, duration-aware `time`
- [ ] POST rejects with clear Thai error if before end or not done

### Task 3: Frontend + i18n

**Files:**
- Modify: `frontend/src/pages/student/Homework.jsx`
- Modify: `frontend/src/i18n/translations.js`

- [ ] Show pad only when `canSign`; else wait message
- [ ] TH/EN `signature.waitUntilEnd` / `signature.tooEarly`

### Task 4: Verify

- [ ] Run backend unit tests
- [ ] Mark spec status approved in design doc if needed
