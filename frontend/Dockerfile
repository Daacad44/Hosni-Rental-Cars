# Frontend build served by nginx, which also reverse-proxies /api to the API.
FROM node:20-alpine AS build
WORKDIR /app
# Same-origin API path behind nginx; the SPA calls /api/v1/*.
ARG VITE_API_BASE_URL=/api/v1
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
ENV API_UPSTREAM=api:4000
ENV NGINX_ENVSUBST_FILTER=API_UPSTREAM
COPY frontend/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
