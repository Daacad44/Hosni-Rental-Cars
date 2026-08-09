# Hosni Rental Cars

Car rental management system for a multi-branch rental company. Staff-facing
internal dashboard: fleet register, reservations, rental contracts, and the
money attached to both.

## Stack

- **Frontend:** React 18 + TypeScript + Vite, Tailwind (CSS-variable tokens),
  React Router v6 (lazy routes), TanStack Query, React Hook Form + Zod,
  `lucide-react`, `date-fns`, `recharts`, `i18next` (`so` + `en`).
- **Backend:** Node 20 + Express + TypeScript, layered
  `routes → controller → service → prisma`.
- **Database:** PostgreSQL 16 via Prisma.
- **Cache & jobs:** Redis + BullMQ in a separate worker process.
- **Auth:** JWT access (15 min) + refresh (7 day) in httpOnly, secure,
  sameSite=lax cookies. bcrypt cost 12.

## Layout

```
packages/shared   Zod schemas, inferred types, error-code union — validated on both sides
backend           Express API + Prisma + BullMQ worker
frontend          React SPA
```

## Getting started

```bash
# 1. Datastores
docker compose up -d

# 2. Environment
cp .env.example .env            # fill JWT secrets (>= 32 chars each)
cp .env backend/.env            # backend reads its own .env

# 3. Install
npm install

# 4. Database
npm run build --workspace packages/shared
cd backend && npx prisma migrate deploy && npx prisma db seed && cd ..

# 5. Run (three processes)
npm run dev:backend             # API on :4000
npm run dev --workspace frontend   # SPA on :5173
cd backend && npm run worker    # background jobs
```

Seed logins (password `ChangeMe123!`): `owner@hosni.test`, `manager@hosni.test`,
`agent@hosni.test`, `mechanic@hosni.test`.

## Checks

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

## Progress

- **Module 1 — Authentication & staff accounts:** ✅ login/refresh/logout/me,
  refresh rotation with grace window, login rate limiting by IP and account,
  role middleware, user CRUD + deactivation (last-owner guarded), audit log.
- **Module 2 — Fleet & vehicles:** ✅ vehicle CRUD with derived status,
  OUT_OF_SERVICE override, monotonic odometer with manager override + audit,
  soft delete, documents with expiry, up to 10 photos via signed URLs (local +
  S3 storage adapters), list filters (search / status / branch / documents
  expiring), branch list endpoint. Detail tabs for rentals, maintenance,
  damages, expenses and profitability are stubbed until their modules land.
- **Module 3 — Customers:** ✅ CRUD, forgiving trigram search, block/unblock,
  licence-expiry guard, manager-only merge.
- **Module 4 — Pricing & rate cards:** ✅ pure, exhaustively-tested pricing
  service; rate cards with effective-dating and vehicle overrides; quotes.
- **Module 5 — Reservations:** ✅ transactional availability with a DB exclusion
  constraint, status flow, stored quote, calendar.
- **Modules 6-8 — Agreements, inspections, invoicing:** ✅ check-out/check-in
  wizards, pure settlement, gapless numbers, idempotent payments, void, cash
  summary.
- **Module 9 — Maintenance:** ✅ scheduling that blocks availability, completion
  computing next-due, severe-damage auto-scheduling.
- **Module 10 — Expenses & fines:** ✅ expenses with CSV export, fines that
  suggest the active agreement and charge to a customer's invoice.
- **Module 11 — Alerts & jobs:** ✅ BullMQ worker running idempotent document-
  expiry, overdue, service-due, no-show, and cleanup jobs.
- **Module 12 — Dashboard & reports:** ✅ KPI dashboard with alert panel;
  revenue, profitability, outstanding and overdue reports with chart + table +
  CSV, aggregated in SQL.

Run the worker alongside the API: `cd backend && npm run worker`.
