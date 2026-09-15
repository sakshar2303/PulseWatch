# ==============================================================================
# PulseWatch Anomaly Detector Service Dockerfile
# Python 3.11-slim container running FastAPI & scikit-learn IsolationForest.
# ==============================================================================

FROM python:3.11-slim AS builder

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential gcc curl && \
    rm -rf /var/lib/apt/lists/*

COPY detector/requirements.txt .
RUN pip install --prefix=/install -r requirements.txt

# Final runtime image
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd -r pulsewatch && useradd -r -g pulsewatch pulsewatch

# Copy installed wheels and dependencies from builder
COPY --from=builder /install /usr/local

# Copy application source code
COPY detector/app /app/app

USER pulsewatch

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

ENTRYPOINT ["uvicorn", "app.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
