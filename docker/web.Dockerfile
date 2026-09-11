# Build context = repo root:  docker build -f docker/web.Dockerfile -t ams-web .
FROM node:22-slim AS build
WORKDIR /app
COPY . .
RUN npm ci
# The app calls a same-origin "/api" which nginx proxies to the API container.
RUN npm run build --workspace @ams/shared && npm run build --workspace @ams/web

FROM nginx:1.27-alpine AS runtime
COPY docker/web-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
