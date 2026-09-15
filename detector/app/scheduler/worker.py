"""Background scheduler worker.

Runs two evaluation loops on a fixed cadence (``eval_interval_seconds``):
    1. Threshold rule evaluator (``RulesEvaluator.run_all``)
    2. ML Isolation Forest detector (``MLDetector.run_cycle``)

Both are guarded by the deduplicator so repeated firings within the cooldown
window are suppressed.

The worker is started as an ``asyncio.Task`` from the FastAPI lifespan hook
and cancelled on shutdown.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from app.config import settings
from app.engine.deduplicator import deduplicator
from app.engine.detector import ml_detector
from app.engine.rules import rules_evaluator

log = logging.getLogger(__name__)


async def _run_threshold_pass() -> None:
    """One pass of the threshold rules engine."""
    try:
        n = await rules_evaluator.run_all()
        if n:
            log.info("[scheduler] threshold pass fired %d anomalies", n)
        else:
            log.debug("[scheduler] threshold pass: no firings")
    except Exception:
        log.exception("[scheduler] threshold pass error")


async def _run_ml_pass() -> None:
    """One pass of the ML detector."""
    try:
        n = await ml_detector.run_cycle()
        if n:
            log.info("[scheduler] ML pass wrote %d anomalies", n)
        else:
            log.debug("[scheduler] ML pass: no anomalies")
    except Exception:
        log.exception("[scheduler] ML pass error")


async def evaluation_loop() -> None:
    """Main scheduler loop — runs indefinitely until cancelled."""
    log.info(
        "Evaluation scheduler started (interval=%ds, lookback=%dm)",
        settings.eval_interval_seconds,
        settings.lookback_minutes,
    )
    while True:
        cycle_start = datetime.now(timezone.utc)
        log.debug("[scheduler] starting evaluation cycle at %s", cycle_start.isoformat())

        # Run both passes concurrently
        await asyncio.gather(
            _run_threshold_pass(),
            _run_ml_pass(),
        )

        # Prune expired dedup entries once per cycle
        pruned = deduplicator.clear_expired()
        if pruned:
            log.debug("[scheduler] pruned %d expired dedup entries", pruned)

        elapsed = (datetime.now(timezone.utc) - cycle_start).total_seconds()
        sleep_for = max(0.0, settings.eval_interval_seconds - elapsed)
        log.debug("[scheduler] cycle took %.2fs, sleeping %.2fs", elapsed, sleep_for)
        await asyncio.sleep(sleep_for)
