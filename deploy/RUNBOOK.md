# Deploy runbook — Hosni Rental Cars (single VPS)

Everything runs from `deploy/` with Docker Compose. The backend and worker share
one image (`hosni/backend`); Postgres and Redis are internal-only; Caddy is the
only thing exposed (80/443) and provisions TLS automatically.

```
deploy/
  docker-compose.prod.yml
  Caddyfile
  .env.prod            # created from .env.prod.example — NEVER commit
```

Shorthand used below:

```bash
alias dc='docker compose -f docker-compose.prod.yml --env-file .env.prod'
```

## 0. First-time setup

1. Point DNS: `app.<domain>` and `api.<domain>` → this host (A/AAAA). Open 80 and 443.
2. `cp .env.prod.example .env.prod` and fill it in. Generate each secret with
   `openssl rand -base64 48`. Keep `DATABASE_URL`'s user/password/db in sync with
   the `POSTGRES_*` values. Set `CORS_ORIGIN=https://app.<domain>`.
3. Build and start:
   ```bash
   dc build backend            # builds hosni/backend (worker reuses it)
   dc build frontend backend
   dc up -d postgres redis
   dc run --rm backend npm run migrate:deploy    # apply migrations
   dc up -d
   ```
4. Seed the first org/owner (one-off): `dc run --rm backend npx prisma db seed`.
5. Verify: `curl -fsS https://api.<domain>/api/v1/health` returns `{"data":{"status":"ok"}}`
   and `https://app.<domain>` loads the login screen. Run the §11 manual smoke test.

## 1. Deploy a new version

```bash
git pull
dc build backend frontend            # rebuild both images
dc run --rm backend npm run migrate:deploy   # migrations are forward-only & idempotent
dc up -d                             # recreates changed services; tini handles SIGTERM
dc ps                                # all healthy?
curl -fsS https://api.<domain>/api/v1/health
```

Migrations run **before** `up -d` so a new schema is in place before new code
serves traffic. `prisma migrate deploy` only applies already-generated
migrations — it never prompts and never drops data.

## 2. Rollback

Application code — redeploy the previous image:

```bash
git checkout <previous-good-tag-or-sha>
dc build backend frontend
dc up -d
```

Rollback does **not** revert migrations (forward-only by design). If a bad
migration shipped, roll the database forward with a new corrective migration, or
restore from backup (§4) if the data is damaged. Never hand-edit a released
migration.

If a deploy is unhealthy and you need the previous container back immediately and
the image is still present locally:

```bash
dc up -d --no-build --force-recreate backend frontend worker
```

## 3. Backup (nightly + before every deploy)

Postgres is the only stateful thing that matters (uploads live on the `uploads`
volume — back that up too if using local storage instead of S3).

```bash
# Database dump (custom format, compressed).
dc exec -T postgres pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB" \
  > backups/hosni-$(date +%Y%m%d-%H%M%S).dump

# Uploads volume (only needed when STORAGE_DRIVER=local).
docker run --rm -v hosni_uploads:/data -v "$PWD/backups":/out alpine \
  tar czf /out/uploads-$(date +%Y%m%d-%H%M%S).tar.gz -C /data .
```

Automate with cron (02:30 daily), keep 14 daily + 8 weekly copies, and ship them
off-box (S3, rsync). A backup you cannot reach when the VPS dies is not a backup.

## 4. Restore — TESTED procedure

Practice this on a throwaway host or a scratch database; do not first learn it
during an incident. The dump above restores cleanly into an empty database.

**Dry run (safe — into a scratch database, no downtime):**

```bash
dc exec -T postgres psql -U "$POSTGRES_USER" -d postgres -c 'CREATE DATABASE restore_test;'
dc exec -T postgres pg_restore -U "$POSTGRES_USER" -d restore_test --clean --if-exists \
  < backups/hosni-YYYYMMDD-HHMMSS.dump
# sanity check row counts, then drop it
dc exec -T postgres psql -U "$POSTGRES_USER" -d restore_test -c \
  'SELECT (SELECT count(*) FROM "Organization") orgs, (SELECT count(*) FROM "Agreement") agreements;'
dc exec -T postgres psql -U "$POSTGRES_USER" -d postgres -c 'DROP DATABASE restore_test;'
```

**Real restore (destructive — the app must be stopped):**

```bash
dc stop backend worker frontend
dc exec -T postgres pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists \
  < backups/hosni-YYYYMMDD-HHMMSS.dump
dc run --rm backend npm run migrate:deploy    # re-apply any migrations newer than the dump
dc up -d
curl -fsS https://api.<domain>/api/v1/health
```

Uploads (local driver only):

```bash
docker run --rm -v hosni_uploads:/data -v "$PWD/backups":/in alpine \
  sh -c 'rm -rf /data/* && tar xzf /in/uploads-YYYYMMDD-HHMMSS.tar.gz -C /data'
```

## 5. Operating notes

- **Logs**: `dc logs -f backend` / `worker`. Every line is JSON with a `reqId`;
  grep a request across services with `dc logs backend worker | grep <reqId>`.
  The API also returns `X-Request-Id` on every response — ask users for it.
- **Errors**: set `SENTRY_DSN` in `.env.prod` to send unexpected 5xx and unhandled
  exceptions to Sentry. Empty DSN = disabled (a warning is logged at boot).
- **Rate limits** live in Redis, so they survive deploys and span instances.
  Clearing them (e.g. to unblock a locked-out user) is intentional and manual:
  `dc exec redis redis-cli --scan --pattern 'rl:*' | xargs -r dc exec -T redis redis-cli del`.
- **Trust proxy**: the API sets `trust proxy = 1` (one hop = Caddy). Do not raise
  `TRUST_PROXY_HOPS` without adding real proxy hops, or clients can spoof
  `X-Forwarded-For` and evade rate limiting.
- **Datastores have no published ports** by design. Reach them only via
  `dc exec postgres …` / `dc exec redis …`.
- **TLS** is automatic via Caddy. Certificates persist in the `caddy_data` volume;
  don't delete it casually or you'll re-hit Let's Encrypt rate limits.
