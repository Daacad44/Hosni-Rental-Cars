# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Frontend image: build the Vite SPA, serve the static output with an
# unprivileged nginx. TLS and host routing are handled by the reverse proxy;
# this container only serves files on :8080 as a non-root user.
#
# Build context is the REPO ROOT. Build with:
#   docker build -f frontend/Dockerfile \
#     --build-arg VITE_API_BASE_URL=https://api.example.com/api/v1 \
#     -t hosni/frontend .
# ─────────────────────────────────────────────────────────────────────────────

FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN npm ci

COPY packages/shared ./packages/shared
COPY frontend ./frontend

# Vite inlines this at build time — it must point at the public API origin.
ARG VITE_API_BASE_URL=http://localhost:4000/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build --workspace packages/shared \
 && npm run build --workspace frontend

# nginxinc/nginx-unprivileged runs as a non-root user and listens on :8080.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
