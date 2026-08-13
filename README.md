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

## Production deploy

The SPA and the API are served on **separate domains**. The frontend image is
plain static nginx with no reverse proxy — it has no upstream and therefore
cannot crash-loop when the API is missing. The SPA reaches the API by its own
absolute origin, baked into the bundle at build time via `VITE_API_BASE_URL`.

### Coolify (production)

Two applications from this one repo, plus a worker, each built with the **repo
root** as the build context:

| | Application | Dockerfile | Port | Domain |
|---|---|---|---|---|
| API | `Backend-Hosni` | `/backend/Dockerfile` | 4000 | `https://api.hosni.botandev.com` |
| SPA | `hosni-rental-frontend` | `/frontend/Dockerfile` | 80 | `https://hosni.botandev.com` |

Plus a **worker** application: the same image as the API, **Start Command:**
`node dist/worker.js`, with no port, no domain and no healthcheck.

`hosni.botandev.com` and `api.hosni.botandev.com` share the registrable domain
`botandev.com`, so they are same-site. The refresh cookie (`httpOnly`,
`secure`, `sameSite=lax`) is host-only on the API domain and flows on the
same-site requests the SPA makes — do **not** set `COOKIE_DOMAIN`.

Environment variables:

```
# API — runtime-only, every one of them
NODE_ENV=production
PORT=4000
DATABASE_URL=…                            # managed Postgres, internal hostname
REDIS_URL=…                               # managed Redis, internal hostname
JWT_ACCESS_SECRET=…                       # >= 32 chars
JWT_REFRESH_SECRET=…                      # >= 32 chars
CORS_ORIGIN=https://hosni.botandev.com    # the SPA's origin, not the API's
TRUST_PROXY_HOPS=1                        # Traefik only, now that nginx is gone
STORAGE_DRIVER=local
UPLOAD_DIR=/app/backend/uploads           # requires a persistent volume

# SPA
VITE_API_BASE_URL=https://api.hosni.botandev.com/api/v1   # BUILD-TIME
```

Three things that have each already cost a deploy:

- **`VITE_API_BASE_URL` must be a build-time variable.** Vite bakes it into the
  bundle; set as a runtime variable it never reaches the browser and the SPA
  silently falls back to calling `localhost:4000`.
- **Everything else must be runtime-only.** Coolify turns build-time variables
  into `ARG`s, baking secrets into image layers that `docker history` reads
  back.
- **Migrations run per rollout** as a pre-deployment command on the API app:
  `cd /app/backend && npx prisma migrate deploy`.

### Local production testing

```bash
cp .env.example .env        # fill DATABASE_URL, JWT secrets, S3, CORS_ORIGIN…
docker compose -f docker-compose.prod.yml up -d --build
```

The stack is postgres + redis + a one-shot `migrate` (runs `prisma migrate
deploy`) + `api` + `worker` + `web` (nginx). The `api` service publishes port
4000 and `web` is built with `VITE_API_BASE_URL=http://localhost:4000/api/v1`;
`localhost:80` and `localhost:4000` are same-site, so cookies behave locally as
they do in production. Rate limiting uses a Redis store in production so
counters are correct across multiple API instances; in dev/test it falls back
to in-memory, so no Redis is needed to run the suite.

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
