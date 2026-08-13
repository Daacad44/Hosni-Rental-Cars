# Frontend build served by nginx as plain static files. The SPA calls the API
# on its own domain (VITE_API_BASE_URL), so nginx has no upstream to proxy.
FROM node:20-alpine AS build
WORKDIR /app
# The SPA calls the API on its own origin; Vite bakes this into the bundle at
# build time. Absolute by default so a misconfigured deploy fails loudly
# (connection refused) rather than silently calling the SPA's own origin.
ARG VITE_API_BASE_URL=http://localhost:4000/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY frontend/package.json frontend/
COPY backend/package.json backend/
RUN npm ci
COPY packages/shared packages/shared
COPY frontend frontend
RUN npm run build --workspace packages/shared && npm run build --workspace frontend

FROM nginx:alpine AS run
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
