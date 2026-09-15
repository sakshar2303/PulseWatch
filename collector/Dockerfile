# ==============================================================================
# PulseWatch Collector Agent Dockerfile
# Multi-stage build producing an ultra-lightweight, secure container.
# ==============================================================================

FROM golang:1.24-alpine AS builder

WORKDIR /build

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Copy shared library first for optimal layer caching
COPY pkg/ pkg/

# Copy Go module definitions and download dependencies
COPY collector/go.mod collector/go.sum collector/
WORKDIR /build/collector
RUN go mod download

# Copy source code and compile statically
COPY collector/ .
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w -extldflags '-static'" \
    -o /bin/collector ./cmd/collector/

# Minimal runtime image
FROM alpine:3.20

RUN apk --no-cache add ca-certificates tzdata && \
    addgroup -S pulsewatch && adduser -S pulsewatch -G pulsewatch

WORKDIR /app
COPY --from=builder /bin/collector /app/collector

# Run as non-root user (when not requiring host procfs access)
USER pulsewatch

ENTRYPOINT ["/app/collector"]
