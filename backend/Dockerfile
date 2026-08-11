# Backend API + worker image. Build context is the repo root so the shared
# workspace and the lockfile are available. The same image runs the API
# (default CMD) and the worker (compose overrides the command).
FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci
COPY packages/shared packages/shared
COPY backend backend
RUN npm run build --workspace packages/shared \
  && npm run prisma:generate --workspace backend \
  && npm run build --workspace backend \
  && npm prune --omit=dev

FROM node:20-alpine AS run
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/backend/prisma ./backend/prisma
WORKDIR /app/backend
EXPOSE 4000
# The API. The worker service overrides this with: node dist/worker.js
CMD ["node", "dist/index.js"]
