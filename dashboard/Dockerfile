# ==============================================================================
# PulseWatch Dashboard Dockerfile
# Multi-stage build: Node.js 20 build -> Nginx Alpine reverse proxy.
# ==============================================================================

FROM node:20-alpine AS builder

WORKDIR /app

COPY dashboard/package*.json ./
RUN npm ci

COPY dashboard/ ./
RUN npm run build

# Production Nginx image
FROM nginx:alpine

# Remove default configuration and copy custom config
RUN rm -rf /etc/nginx/conf.d/default.conf
COPY dashboard/nginx.conf /etc/nginx/conf.d/pulsewatch.conf

# Copy compiled static bundle
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
    CMD wget -q -O /dev/null http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
