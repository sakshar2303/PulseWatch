# ==============================================================================
# PulseWatch Query/API Service Dockerfile
# Serves REST endpoints and live WebSocket metrics streaming.
# ==============================================================================

FROM golang:1.24-alpine AS builder

WORKDIR /build

RUN apk add --no-cache git ca-certificates tzdata

COPY pkg/ pkg/

COPY api/go.mod api/go.sum api/
WORKDIR /build/api
RUN go mod download

COPY api/ .
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w -extldflags '-static'" \
    -o /bin/api ./cmd/api/

FROM alpine:3.20

RUN apk --no-cache add ca-certificates tzdata curl && \
    addgroup -S pulsewatch && adduser -S pulsewatch -G pulsewatch

WORKDIR /app
COPY --from=builder /bin/api /app/api

USER pulsewatch

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

ENTRYPOINT ["/app/api"]
