# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Backend image. The worker runs from THIS SAME image with a different command
# (see compose), so the API and the worker can never drift in dependencies or in
# the Prisma schema/migrations they carry.
#
# Build context is the REPO ROOT (this is a workspaces monorepo). Build with:
#   docker build -f backend/Dockerfile -t hosni/backend .
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: install + build (has the full dev toolchain) ────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Manifests first for a cached dependency layer.
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN npm ci

# Sources needed to build the backend (frontend is built in its own image).
COPY packages/shared ./packages/shared
COPY backend ./backend

# Build the shared package, generate the Prisma client, compile the backend,
# then strip dev dependencies so only production deps remain in node_modules.
RUN npm run build --workspace packages/shared \
 && npm run prisma:generate --workspace backend \
 && npm run build --workspace backend \
 && npm prune --omit=dev

# ── Stage 2: runtime (production dependencies only, non-root) ─────────────────
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# tini for correct signal handling (graceful SIGTERM on deploy).
RUN apk add --no-cache tini \
 && addgroup -S app && adduser -S app -G app

# Pruned production node_modules (includes @prisma/client, the generated client,
# and the prisma CLI used for `migrate deploy` — prisma is a runtime dep here).
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder --chown=app:app /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=app:app /app/backend/package.json ./backend/package.json
COPY --from=builder --chown=app:app /app/backend/dist ./backend/dist
COPY --from=builder --chown=app:app /app/backend/prisma ./backend/prisma

USER app
WORKDIR /app/backend
EXPOSE 4000

# The API. The worker overrides this with: node dist/worker.js
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
