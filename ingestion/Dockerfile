# ==============================================================================
# PulseWatch Ingestion Service Dockerfile
# High-throughput batch writer consuming NATS JetStream -> TimescaleDB.
# ==============================================================================

FROM golang:1.24-alpine AS builder

WORKDIR /build

RUN apk add --no-cache git ca-certificates tzdata

COPY pkg/ pkg/

COPY ingestion/go.mod ingestion/go.sum ingestion/
WORKDIR /build/ingestion
RUN go mod download

COPY ingestion/ .
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w -extldflags '-static'" \
    -o /bin/ingestion ./cmd/ingestion/

FROM alpine:3.20

RUN apk --no-cache add ca-certificates tzdata curl && \
    addgroup -S pulsewatch && adduser -S pulsewatch -G pulsewatch

WORKDIR /app
COPY --from=builder /bin/ingestion /app/ingestion

USER pulsewatch

EXPOSE 8081

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8081/health || exit 1

ENTRYPOINT ["/app/ingestion"]
