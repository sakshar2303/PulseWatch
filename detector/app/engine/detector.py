"""ML-based anomaly detector.

Fetches recent time-series windows per metric from TimescaleDB, feeds them
into the per-metric Isolation Forest model, and persists any detected
anomalies back into the ``anomalies`` table.

Flow per evaluation cycle:
    1. Discover distinct (metric_name, host, service) combos active in the
       last ``lookback_minutes``.
    2. For each combo, fetch the ordered (time, value) window.
    3. Train / re-train the model if enough samples exist and the model is
       either new or the sample count has grown significantly.
    4. Predict on the latest window.  If an anomaly is flagged, persist it.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import List, Tuple

from app.config import settings
from app.db.session import get_pool
from app.models.isolation_forest import model_registry
from app.engine.ai import generate_rca_summary, verify_anomaly

log = logging.getLogger(__name__)

Sample = Tuple[float, float]  # (unix_ts, value)

_DISCOVER_SERIES_SQL = """
SELECT DISTINCT metric_name, host, service
FROM metrics
WHERE time >= NOW() - INTERVAL '1 minute' * $1
"""

_FETCH_SERIES_SQL = """
SELECT EXTRACT(EPOCH FROM time)::FLOAT AS ts, value
FROM metrics
WHERE metric_name = $1
  AND host = $2
  AND service = $3
  AND time >= NOW() - INTERVAL '1 minute' * $4
ORDER BY time ASC
"""

_INSERT_ML_ANOMALY_SQL = """
INSERT INTO anomalies
    (detected_at, metric_name, host, service, severity, type, description, value, score, metadata)
VALUES
    ($1, $2, $3, $4, $5, 'ml_isolation_forest', $6, $7, $8, $9::jsonb)
RETURNING id
"""

_UPDATE_RCA_SQL = """
UPDATE anomalies SET rca_summary = $1 WHERE id = $2
"""

_UPDATE_VERIFICATION_SQL = """
UPDATE anomalies 
SET metadata = metadata || $1::jsonb,
    resolved_at = CASE WHEN $2::boolean THEN resolved_at ELSE NOW() END
WHERE id = $3
"""


class MLDetector:
    """Run Isolation Forest detection across all active metric series."""

    async def _fetch_series(
        self,
        conn,
        metric: str,
        host: str,
        service: str,
    ) -> List[Sample]:
        rows = await conn.fetch(
            _FETCH_SERIES_SQL,
            metric,
            host,
            service,
            settings.lookback_minutes,
        )
        return [(r["ts"], r["value"]) for r in rows]

    async def run_cycle(self) -> int:
        """Execute one full ML detection cycle.  Returns number of anomalies written."""
        pool = await get_pool()
        total_anomalies = 0

        async with pool.acquire() as conn:
            series_rows = await conn.fetch(_DISCOVER_SERIES_SQL, settings.lookback_minutes)

        for row in series_rows:
            metric, host, service = row["metric_name"], row["host"], row["service"]
            try:
                async with pool.acquire() as conn:
                    samples = await self._fetch_series(conn, metric, host, service)

                if len(samples) < settings.min_train_samples:
                    log.debug(
                        "Skipping %s/%s/%s — only %d samples (need %d)",
                        metric, host, service, len(samples), settings.min_train_samples,
                    )
                    continue

                # Train in thread to avoid blocking the event loop
                n_trained = await asyncio.to_thread(model_registry.fit, metric, samples)
                if n_trained == 0:
                    continue

                result = await asyncio.to_thread(model_registry.predict, metric, samples)
                if result is None or not result.is_anomaly:
                    continue

                from app.engine.deduplicator import deduplicator

                if deduplicator.is_duplicate(metric, host, service, "ml_isolation_forest"):
                    log.debug(
                        "Dedup: suppressing ML alert for %s/%s/%s",
                        metric, host, service,
                    )
                    continue

                # Persist the anomaly
                current_value = samples[-1][1]
                desc = (
                    f"[ML/{result.severity.upper()}] IsolationForest detected anomaly "
                    f"for {metric} on {host}/{service} "
                    f"(score={result.score:.4f}, value={current_value:.4f})"
                )
                now = datetime.now(timezone.utc)
                meta = json.dumps({
                    "score": result.score,
                    "features": result.features,
                    "model": "IsolationForest",
                    "n_estimators": settings.n_estimators,
                })
                pool2 = await get_pool()
                async with pool2.acquire() as conn:
                    row_out = await conn.fetchrow(
                        _INSERT_ML_ANOMALY_SQL,
                        now, metric, host, service,
                        result.severity, desc,
                        current_value, result.score,
                        meta,
                    )
                anomaly_id = row_out["id"]
                deduplicator.mark_fired(metric, host, service, "ml_isolation_forest")
                log.info(
                    "ML anomaly id=%d metric=%s host=%s score=%.4f severity=%s",
                    anomaly_id, metric, host, result.score, result.severity,
                )
                total_anomalies += 1

                # Async RCA & Verification generation
                asyncio.create_task(self._verify_and_generate_rca(
                    anomaly_id=anomaly_id,
                    metric=metric,
                    host=host,
                    service=service,
                    severity=result.severity,
                    current_value=current_value,
                    score=result.score,
                    samples=samples,
                    description=desc,
                ))

            except Exception:
                log.exception("MLDetector error for series %s/%s/%s", metric, host, service)

        return total_anomalies

    async def _verify_and_generate_rca(self, anomaly_id: int, **kwargs):
        """Helper to generate RCA via LLM and verify anomaly without blocking."""
        pool = await get_pool()
        
        # 1. Verify Anomaly
        verify_result = await verify_anomaly(
            metric=kwargs["metric"],
            host=kwargs["host"],
            service=kwargs["service"],
            severity=kwargs["severity"],
            current_value=kwargs["current_value"],
            threshold=None,
            score=kwargs["score"],
            samples=kwargs["samples"],
            description=kwargs["description"]
        )

        if verify_result:
            is_real = verify_result.get("is_real", True)
            meta_update = json.dumps({
                "llm_verified": is_real,
                "llm_reason": verify_result.get("reason", "")
            })
            try:
                async with pool.acquire() as conn:
                    await conn.execute(_UPDATE_VERIFICATION_SQL, meta_update, is_real, anomaly_id)
                log.info("Saved LLM verification for anomaly %d (is_real=%s)", anomaly_id, is_real)
            except Exception as e:
                log.error("Failed to save verification for anomaly %d: %s", anomaly_id, e)
            
            # If not real, stop here
            if not is_real:
                return

        # 2. Generate RCA (only if real or verification failed to respond)
        kwargs.pop("description", None) # remove description before passing to RCA
        rca = await generate_rca_summary(**kwargs)
        if rca:
            try:
                async with pool.acquire() as conn:
                    await conn.execute(_UPDATE_RCA_SQL, rca, anomaly_id)
                log.info("Saved LLM RCA for anomaly %d", anomaly_id)
            except Exception as e:
                log.error("Failed to save RCA for anomaly %d: %s", anomaly_id, e)


# Module-level singleton
ml_detector = MLDetector()
