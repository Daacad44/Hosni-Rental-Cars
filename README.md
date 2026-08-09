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
- Remaining modules (fleet, customers, pricing, reservations, agreements,
  invoicing, maintenance, expenses, alerts, reports) are scaffolded in the
  navigation and built in order.
