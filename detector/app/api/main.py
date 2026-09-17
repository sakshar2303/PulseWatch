"""Detector FastAPI application.

Entrypoint — exposes:
    GET  /health
    POST /api/v1/detect        — ad-hoc single-sample ML scoring
    POST /api/v1/train         — trigger immediate re-training for a metric
    GET  /api/v1/models        — list registered models and their status
    GET  /api/v1/anomalies     — recent anomalies (pagination)
    GET  /api/v1/rules         — list alert rules (proxy to DB read)
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel

from app.config import settings
from app.db.session import close_pool, create_pool, get_pool
from app.engine.rules import rules_evaluator
from app.models.isolation_forest import model_registry
from app.scheduler.worker import evaluation_loop
from app.tracing import instrument_app, setup_tracing, shutdown_tracing

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def _lifespan(app: FastAPI):
    """Startup: create DB pool, init tracing, and launch background scheduler."""
    setup_tracing("pulsewatch-detector")
    instrument_app(app)
    await create_pool()
    log.info("DB pool created")
    task = asyncio.create_task(evaluation_loop(), name="evaluation_loop")
    log.info("Evaluation loop task started")
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    await close_pool()
    shutdown_tracing()
    log.info("Detector service shutdown complete")


app = FastAPI(
    title="PulseWatch Detector",
    description="Dual-engine anomaly detection service (threshold rules + Isolation Forest)",
    version="1.0.0",
    lifespan=_lifespan,
)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health", tags=["ops"])
async def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "service": "detector",
        "models_trained": len(model_registry.list_metrics()),
        "eval_interval_seconds": settings.eval_interval_seconds,
    }


# ---------------------------------------------------------------------------
# /api/v1/detect  — ad-hoc ML scoring
# ---------------------------------------------------------------------------

class SampleIn(BaseModel):
    timestamp: float   # unix seconds
    value: float


class DetectRequest(BaseModel):
    metric: str
    samples: List[SampleIn]


class DetectResponse(BaseModel):
    metric: str
    is_anomaly: bool
    score: Optional[float]
    severity: str
    trained: bool


@app.post("/api/v1/detect", response_model=DetectResponse, tags=["detection"])
async def detect(req: DetectRequest) -> DetectResponse:
    """Score the last point in the provided sample window using the ML model."""
    raw = [(s.timestamp, s.value) for s in req.samples]

    if not model_registry.is_trained(req.metric):
        # Attempt an immediate train if we have enough samples
        n = await asyncio.to_thread(model_registry.fit, req.metric, raw)
        if n == 0:
            return DetectResponse(
                metric=req.metric,
                is_anomaly=False,
                score=None,
                severity="info",
                trained=False,
            )

    result = await asyncio.to_thread(model_registry.predict, req.metric, raw)
    if result is None:
        return DetectResponse(
            metric=req.metric, is_anomaly=False, score=None, severity="info", trained=False
        )

    return DetectResponse(
        metric=req.metric,
        is_anomaly=result.is_anomaly,
        score=result.score,
        severity=result.severity,
        trained=True,
    )


# ---------------------------------------------------------------------------
# /api/v1/train  — trigger immediate (re-)training for a metric
# ---------------------------------------------------------------------------

class TrainRequest(BaseModel):
    metric: str
    samples: List[SampleIn]


class TrainResponse(BaseModel):
    metric: str
    trained: bool
    sample_count: int


@app.post("/api/v1/train", response_model=TrainResponse, tags=["models"])
async def train(req: TrainRequest) -> TrainResponse:
    """Train (or re-train) the Isolation Forest model for the specified metric."""
    raw = [(s.timestamp, s.value) for s in req.samples]
    n = await asyncio.to_thread(model_registry.fit, req.metric, raw)
    return TrainResponse(metric=req.metric, trained=n > 0, sample_count=n)


# ---------------------------------------------------------------------------
# /api/v1/models  — model registry info
# ---------------------------------------------------------------------------

@app.get("/api/v1/models", tags=["models"])
async def list_models() -> List[Dict[str, Any]]:
    """Return status of all registered per-metric models."""
    return [model_registry.info(m) for m in model_registry.list_metrics()]


# ---------------------------------------------------------------------------
# /api/v1/anomalies  — recent anomalies (read-only, paginated)
# ---------------------------------------------------------------------------

_FETCH_ANOMALIES_SQL = """
SELECT id, detected_at, metric_name, host, service, severity, type, description,
       value, threshold, score, resolved_at, metadata
FROM anomalies
ORDER BY detected_at DESC
LIMIT $1 OFFSET $2
"""


@app.get("/api/v1/anomalies", tags=["anomalies"])
async def list_anomalies(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> List[Dict[str, Any]]:
    """Return the most recent anomalies, newest first."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(_FETCH_ANOMALIES_SQL, limit, offset)
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# /api/v1/rules  — list alert rules (read-only, delegates to RulesEvaluator)
# ---------------------------------------------------------------------------

@app.get("/api/v1/rules", tags=["rules"])
async def list_rules() -> List[Dict[str, Any]]:
    """Return all enabled alert rules from the database."""
    rules = await rules_evaluator.load_rules()
    return [
        {
            "id": r.id,
            "name": r.name,
            "metric_name": r.metric_name,
            "condition": r.condition,
            "threshold": r.threshold,
            "duration_seconds": r.duration_seconds,
            "severity": r.severity,
            "service": r.service,
            "host": r.host,
        }
        for r in rules
    ]


# ---------------------------------------------------------------------------
# /api/v1/remediate/trigger — trigger remediation on demand
# ---------------------------------------------------------------------------

class RemediateRequest(BaseModel):
    service: str
    host: str
    metric_name: str
    current_value: float = 0.0
    description: str = "Manual operator remediation trigger"
    severity: str = "warning"
    anomaly_id: Optional[int] = None
    rca_summary: Optional[str] = None
    trigger_type: str = "manual"


@app.post("/api/v1/remediate/trigger", tags=["remediation"])
async def trigger_remediation(req: RemediateRequest) -> Dict[str, Any]:
    """Trigger an autonomous or manual self-healing remediation workflow."""
    from app.engine.remediation import remediation_engine
    rem_id = await remediation_engine.trigger(
        service=req.service,
        host=req.host,
        metric_name=req.metric_name,
        current_value=req.current_value,
        description=req.description,
        severity=req.severity,
        anomaly_id=req.anomaly_id,
        rca_summary=req.rca_summary,
        trigger_type=req.trigger_type,
    )
    return {"status": "dispatched", "remediation_id": rem_id}

