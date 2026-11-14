FROM node:26-alpine AS deps
WORKDIR /app

# Install dependencies first so this layer is cached until the lockfile changes.
COPY package.json package-lock.json ./
RUN npm ci

# Development: the Vite dev server with hot reload. The source is mounted in by
# docker-compose.dev.yml, so nothing else is copied here.
FROM deps AS dev
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM deps AS build
COPY . .
RUN npm run build

# Default: the built app, served by nginx.
FROM nginx:1.30-alpine
# Base URL of an OTLP/HTTP collector for browser telemetry. Empty disables it.
ENV OTLP_UPSTREAM=""
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
