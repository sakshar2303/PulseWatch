#!/usr/bin/env bash
# ==============================================================================
# PulseWatch — Chaos Testing Framework
# ==============================================================================
# Automated fault injection suite that validates PulseWatch's resilience under
# failure conditions. Run this against a live Docker Compose deployment.
#
# Usage:
#   make docker-prod-up          # start the full stack
#   bash scripts/chaos/chaos_test.sh
#
# Each experiment:
#   1. Injects a fault (kill container, network partition, etc.)
#   2. Observes system behavior (health endpoints, logs)
#   3. Removes the fault
#   4. Verifies recovery
# ==============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

API_URL="http://localhost:8080"
DETECTOR_URL="http://localhost:8000"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

log_header() {
    echo ""
    echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}${BOLD}  EXPERIMENT: $1${NC}"
    echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

pass() {
    echo -e "  ${GREEN}✓ PASS${NC}: $1"
    PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
    echo -e "  ${RED}✗ FAIL${NC}: $1"
    FAIL_COUNT=$((FAIL_COUNT + 1))
}

skip() {
    echo -e "  ${YELLOW}⊘ SKIP${NC}: $1"
    SKIP_COUNT=$((SKIP_COUNT + 1))
}

wait_for_health() {
    local url=$1
    local max_wait=${2:-30}
    local elapsed=0
    while [ $elapsed -lt $max_wait ]; do
        if curl -sf "${url}/health" > /dev/null 2>&1; then
            return 0
        fi
        sleep 2
        elapsed=$((elapsed + 2))
    done
    return 1
}

# ---------------------------------------------------------------------------
# Pre-flight check
# ---------------------------------------------------------------------------

echo -e "${BOLD}PulseWatch Chaos Testing Framework${NC}"
echo -e "Testing against Docker Compose stack..."
echo ""

if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: docker is not installed${NC}"
    exit 1
fi

# Check that key containers are running
for svc in pulsewatch-api-prod pulsewatch-tsdb; do
    if ! docker ps --format '{{.Names}}' | grep -q "^${svc}\$" 2>/dev/null; then
        echo -e "${YELLOW}Warning: Container ${svc} is not running.${NC}"
        echo -e "${YELLOW}Some experiments may be skipped.${NC}"
    fi
done

# ---------------------------------------------------------------------------
# Experiment 1: NATS Failure & Recovery
# ---------------------------------------------------------------------------

log_header "NATS JetStream Failure & Recovery"

NATS_CONTAINER=$(docker ps --format '{{.Names}}' | grep -E 'nats' | head -1 || true)

if [ -n "$NATS_CONTAINER" ]; then
    echo "  Phase 1: Stopping NATS container ($NATS_CONTAINER)..."
    docker stop "$NATS_CONTAINER" > /dev/null 2>&1

    sleep 3

    echo "  Phase 2: Checking API health during NATS outage..."
    HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "${API_URL}/health" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "503" ]; then
        pass "API service responds during NATS outage (HTTP $HTTP_CODE)"
    else
        fail "API service unreachable during NATS outage (HTTP $HTTP_CODE)"
    fi

    echo "  Phase 3: Restarting NATS container..."
    docker start "$NATS_CONTAINER" > /dev/null 2>&1
    sleep 5

    echo "  Phase 4: Verifying full recovery..."
    if wait_for_health "$API_URL" 20; then
        pass "API service recovered after NATS restart"
    else
        fail "API service did not recover after NATS restart"
    fi
else
    skip "NATS container not found — skipping experiment"
fi

# ---------------------------------------------------------------------------
# Experiment 2: TimescaleDB Failure & Recovery
# ---------------------------------------------------------------------------

log_header "TimescaleDB Failure & Recovery"

TSDB_CONTAINER=$(docker ps --format '{{.Names}}' | grep -E 'tsdb' | head -1 || true)

if [ -n "$TSDB_CONTAINER" ]; then
    echo "  Phase 1: Stopping TimescaleDB container ($TSDB_CONTAINER)..."
    docker stop "$TSDB_CONTAINER" > /dev/null 2>&1

    sleep 3

    echo "  Phase 2: Checking API health during DB outage..."
    HEALTH_BODY=$(curl -sf "${API_URL}/health" 2>/dev/null || echo '{"status":"unreachable"}')
    if echo "$HEALTH_BODY" | grep -qi "degraded\|unhealthy"; then
        pass "API correctly reports degraded status during DB outage"
    elif echo "$HEALTH_BODY" | grep -qi "unreachable"; then
        fail "API is completely unreachable during DB outage"
    else
        pass "API responds during DB outage (may not have detected failure yet)"
    fi

    echo "  Phase 3: Verifying query endpoint fails gracefully..."
    QUERY_CODE=$(curl -sf -o /dev/null -w "%{http_code}" \
        "${API_URL}/api/v1/metrics/query?metric=cpu_usage_percent&range=5m" 2>/dev/null || echo "000")
    if [ "$QUERY_CODE" = "500" ] || [ "$QUERY_CODE" = "503" ] || [ "$QUERY_CODE" = "000" ]; then
        pass "Query endpoint fails gracefully during DB outage (HTTP $QUERY_CODE)"
    else
        fail "Query endpoint returned unexpected code during DB outage (HTTP $QUERY_CODE)"
    fi

    echo "  Phase 4: Restarting TimescaleDB container..."
    docker start "$TSDB_CONTAINER" > /dev/null 2>&1
    sleep 10

    echo "  Phase 5: Verifying full recovery..."
    if wait_for_health "$API_URL" 30; then
        HEALTH_BODY=$(curl -sf "${API_URL}/health" 2>/dev/null || echo '{}')
        if echo "$HEALTH_BODY" | grep -qi "healthy"; then
            pass "API fully recovered after TimescaleDB restart"
        else
            fail "API health check does not report healthy after DB restart"
        fi
    else
        fail "API did not recover after TimescaleDB restart"
    fi
else
    skip "TimescaleDB container not found — skipping experiment"
fi

# ---------------------------------------------------------------------------
# Experiment 3: Detector Service Crash & Recovery
# ---------------------------------------------------------------------------

log_header "Detector Service Crash & API Isolation"

DETECTOR_CONTAINER=$(docker ps --format '{{.Names}}' | grep -E 'detector' | head -1 || true)

if [ -n "$DETECTOR_CONTAINER" ]; then
    echo "  Phase 1: Killing detector service ($DETECTOR_CONTAINER)..."
    docker kill "$DETECTOR_CONTAINER" > /dev/null 2>&1

    sleep 3

    echo "  Phase 2: Verifying API continues serving..."
    HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "${API_URL}/api/v1/metrics/names" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        pass "API service continues serving while detector is down"
    else
        fail "API service affected by detector crash (HTTP $HTTP_CODE)"
    fi

    echo "  Phase 3: Restarting detector container..."
    docker start "$DETECTOR_CONTAINER" > /dev/null 2>&1
    sleep 8

    echo "  Phase 4: Verifying detector recovery..."
    if wait_for_health "$DETECTOR_URL" 20; then
        pass "Detector service recovered successfully"
    else
        fail "Detector service did not recover"
    fi
else
    skip "Detector container not found — skipping experiment"
fi

# ---------------------------------------------------------------------------
# Experiment 4: API Health Endpoint Under Load
# ---------------------------------------------------------------------------

log_header "API Resilience Under Concurrent Health Probes"

if command -v curl &> /dev/null; then
    echo "  Sending 50 concurrent health checks..."
    SUCCESS=0
    TOTAL=50
    for i in $(seq 1 $TOTAL); do
        curl -sf -o /dev/null "${API_URL}/health" 2>/dev/null && SUCCESS=$((SUCCESS + 1)) &
    done
    wait

    RATE=$((SUCCESS * 100 / TOTAL))
    if [ $RATE -ge 90 ]; then
        pass "Health endpoint handled concurrent probes ($SUCCESS/$TOTAL = ${RATE}% success)"
    else
        fail "Health endpoint dropped too many requests ($SUCCESS/$TOTAL = ${RATE}% success)"
    fi
else
    skip "curl not available"
fi

# ---------------------------------------------------------------------------
# Experiment 5: Network Partition (Detector ↔ Database)
# ---------------------------------------------------------------------------

log_header "Network Partition: Detector ↔ Database"

if [ -n "${DETECTOR_CONTAINER:-}" ] && [ -n "${TSDB_CONTAINER:-}" ]; then
    NETWORK=$(docker inspect "$DETECTOR_CONTAINER" --format '{{range $key, $val := .NetworkSettings.Networks}}{{$key}}{{end}}' 2>/dev/null | head -1 || true)

    if [ -n "$NETWORK" ]; then
        echo "  Phase 1: Disconnecting detector from network $NETWORK..."
        docker network disconnect "$NETWORK" "$DETECTOR_CONTAINER" 2>/dev/null || true

        sleep 3

        echo "  Phase 2: Verifying API is unaffected..."
        HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "${API_URL}/health" 2>/dev/null || echo "000")
        if [ "$HTTP_CODE" = "200" ]; then
            pass "API unaffected by detector network partition"
        else
            fail "API affected by detector partition (HTTP $HTTP_CODE)"
        fi

        echo "  Phase 3: Reconnecting detector to network..."
        docker network connect "$NETWORK" "$DETECTOR_CONTAINER" 2>/dev/null || true
        sleep 5

        echo "  Phase 4: Verifying detector recovers..."
        if wait_for_health "$DETECTOR_URL" 20; then
            pass "Detector recovered from network partition"
        else
            fail "Detector did not recover from network partition"
        fi
    else
        skip "Could not determine Docker network — skipping"
    fi
else
    skip "Detector or TSDB container not found — skipping experiment"
fi

# ---------------------------------------------------------------------------
# Summary Report
# ---------------------------------------------------------------------------

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  CHAOS TEST SUMMARY${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${GREEN}Passed${NC}:  $PASS_COUNT"
echo -e "  ${RED}Failed${NC}:  $FAIL_COUNT"
echo -e "  ${YELLOW}Skipped${NC}: $SKIP_COUNT"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "  ${GREEN}${BOLD}All chaos experiments passed! ✓${NC}"
    exit 0
else
    echo -e "  ${RED}${BOLD}Some experiments failed. Review above for details.${NC}"
    exit 1
fi
