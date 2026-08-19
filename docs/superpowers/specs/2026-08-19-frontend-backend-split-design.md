# Frontend / Backend Split Design

Date: 2026-08-19

## Goal
Split the KruAir web app so the React UI talks to a real Express API, and all student/teacher/admin data lives in SQL Server (SSMS, Windows Authentication). Local first, deploy later. No LINE or KBank yet.

## Architecture
- `frontend/` — React + Vite on port 5173. `src/services/apiClient.js` calls `/api/*` with JWT.
- `components/` — shared UI (Button, layout, icons).
- `sql/` — SQL Server schema for SSMS.
- `data/` — seed JSON for packages, accounts, reviews.
- `backend/` — Express on port 3001. Routes, JWT, bcrypt, `mssql` + `msnodesqlv8`.
- SQL Server database `BD_AIR` created by `sql/schema.sql`.

## Auth
- Login/register return JWT (7 days).
- Passwords stored as bcrypt hashes.
- Role guards: student / teacher / admin.

## Data
Tables: users, packages, user_packages, transactions, vouchers, voucher_usages, teacher_availability, bookings, class_logs, move_requests, notifications.

Hours are deducted only when a teacher records a class log.

## Run
See `.freebuff/run.md`.
