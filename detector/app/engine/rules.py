"""Threshold-based alert rule evaluator.

Loads enabled ``alert_rules`` rows from PostgreSQL and evaluates each one
against a rolling window of recent metric data from the ``metrics`` table.

A rule **fires** when:
  1. The most-recent metric value satisfies the rule's condition (>, <, >=, <=, ==).
  2. *All* metric values within the rule's ``duration`` interval have also
     continuously satisfied the same condition — this prevents single-spike
     false positives.

If a rule fires the evaluator inserts a row into the ``anomalies`` table
(de-duplication is the responsibility of the caller / deduplicator).

Design note: every public method is async because they execute DB queries.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import List, Optional

import asyncpg

from app.db.session import get_pool
from app.engine.ai import verify_anomaly

log = logging.getLogger(__name__)

# Allowed condition operators (application-level validation mirrors the SQL table comment)
_VALID_CONDITIONS = frozenset({">", "<", ">=", "<=", "=="})


def _evaluate_condition(value: float, condition: str, threshold: float) -> bool:
    """Return True if *value* satisfies *condition* against *threshold*."""
    if condition == ">":
        return value > threshold
    if condition == "<":
        return value < threshold
    if condition == ">=":
        return value >= threshold
    if condition == "<=":
        return value <= threshold
    if condition == "==":
        return abs(value - threshold) < 1e-9
    # Unknown condition — conservatively return False
    log.warning("Unknown condition '%s'; skipping", condition)
    return False


# ---------------------------------------------------------------------------
# Data-transfer objects (plain dataclasses for speed)
# ---------------------------------------------------------------------------

from dataclasses import dataclass, field


@dataclass
class AlertRule:
    id: int
    name: str
    metric_name: str
    condition: str
    threshold: float
    duration_seconds: float   # extracted from PG INTERVAL
    severity: str
    service: Optional[str]
    host: Optional[str]


@dataclass
class RuleFiring:
    rule: AlertRule
    fired_at: datetime
    current_value: float
    host: str
    service: str
    description: str


# ---------------------------------------------------------------------------
# Query helpers
# ---------------------------------------------------------------------------

_LOAD_RULES_SQL = """
SELECT
    id,
    name,
    metric_name,
    condition,
    threshold,
    EXTRACT(EPOCH FROM duration)::FLOAT AS duration_seconds,
    severity,
    service,
    host
FROM alert_rules
WHERE enabled = TRUE
ORDER BY id
"""

_FETCH_WINDOW_SQL = """
SELECT value, host, service
FROM metrics
WHERE metric_name = $1
  AND time >= NOW() - $2 * INTERVAL '1 second'
  AND ($3::TEXT IS NULL OR service = $3)
  AND ($4::TEXT IS NULL OR host    = $4)
ORDER BY time ASC
"""

_INSERT_ANOMALY_SQL = """
INSERT INTO anomalies
    (detected_at, metric_name, host, service, severity, type, description, value, threshold, metadata)
VALUES
    ($1, $2, $3, $4, $5, 'threshold', $6, $7, $8, $9::jsonb)
RETURNING id
"""

_UPDATE_VERIFICATION_SQL = """
UPDATE anomalies 
SET metadata = metadata || $1::jsonb,
    resolved_at = CASE WHEN $2::boolean THEN resolved_at ELSE NOW() END
WHERE id = $3
"""


# ---------------------------------------------------------------------------
# Public evaluator
# ---------------------------------------------------------------------------

class RulesEvaluator:
    """Evaluates all enabled threshold rules and writes firing anomalies."""

    async def load_rules(self) -> List[AlertRule]:
        """Fetch all enabled rules from the DB."""
        pool = await get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(_LOAD_RULES_SQL)
        return [
            AlertRule(
                id=r["id"],
                name=r["name"],
                metric_name=r["metric_name"],
                condition=r["condition"],
                threshold=r["threshold"],
                duration_seconds=r["duration_seconds"],
                severity=r["severity"],
                service=r["service"],
                host=r["host"],
            )
            for r in rows
        ]

    async def evaluate(self, rule: AlertRule) -> List[RuleFiring]:
        """Evaluate a single rule.  Returns a list of firings (one per host/service combo)."""
        if rule.condition not in _VALID_CONDITIONS:
            log.warning("Rule %d has invalid condition '%s'; skipping", rule.id, rule.condition)
            return []

        pool = await get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                _FETCH_WINDOW_SQL,
                rule.metric_name,
                rule.duration_seconds,
                rule.service,
                rule.host,
            )

        if not rows:
            return []

        # Group by (host, service) to evaluate each series independently
        groups: dict[tuple[str, str], list[float]] = {}
        for row in rows:
            key = (row["host"], row["service"])
            groups.setdefault(key, []).append(row["value"])

        self._last_evaluated_groups = groups # hack to pass values to verify task
        
        firings: List[RuleFiring] = []
        now = datetime.now(timezone.utc)

        for (host, service), values in groups.items():
            if not values:
                continue
            # Rule fires only when *all* values in the duration window breach threshold
            all_breach = all(_evaluate_condition(v, rule.condition, rule.threshold) for v in values)
            if all_breach:
                current_value = values[-1]
                desc = (
                    f"[{rule.severity.upper()}] {rule.name}: "
                    f"{rule.metric_name} {rule.condition} {rule.threshold} "
                    f"for {rule.duration_seconds:.0f}s on {host}/{service} "
                    f"(current={current_value:.4f})"
                )
                firings.append(
                    RuleFiring(
                        rule=rule,
                        fired_at=now,
                        current_value=current_value,
                        host=host,
                        service=service,
                        description=desc,
                    )
                )

        return firings

    async def persist_firing(self, firing: RuleFiring) -> int:
        """Insert a firing into the anomalies table.  Returns the new anomaly id."""
        import json

        pool = await get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                _INSERT_ANOMALY_SQL,
                firing.fired_at,
                firing.rule.metric_name,
                firing.host,
                firing.service,
                firing.rule.severity,
                firing.description,
                firing.current_value,
                firing.rule.threshold,
                json.dumps({"rule_id": firing.rule.id, "rule_name": firing.rule.name}),
            )
        anomaly_id: int = row["id"]
        log.info(
            "Persisted threshold anomaly id=%d rule=%d metric=%s host=%s",
            anomaly_id, firing.rule.id, firing.rule.metric_name, firing.host,
        )
        return anomaly_id

    async def _verify_threshold_anomaly(
        self, 
        anomaly_id: int, 
        firing: RuleFiring, 
        samples: list[float]
    ):
        """Async task to verify threshold anomalies."""
        import json
        pool = await get_pool()
        
        # We need tuples of (timestamp, value). Since we only have values, 
        # we'll approximate the timestamps just for the LLM context.
        now_ts = firing.fired_at.timestamp()
        approx_samples = []
        for i, val in enumerate(reversed(samples)):
            approx_samples.insert(0, (now_ts - i*60, val)) # assume 1min step roughly
            
        verify_result = await verify_anomaly(
            metric=firing.rule.metric_name,
            host=firing.host,
            service=firing.service,
            severity=firing.rule.severity,
            current_value=firing.current_value,
            threshold=firing.rule.threshold,
            score=None,
            samples=approx_samples,
            description=firing.description
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
                log.info("Saved LLM verification for threshold anomaly %d (is_real=%s)", anomaly_id, is_real)
            except Exception as e:
                log.error("Failed to save verification for anomaly %d: %s", anomaly_id, e)

            # Autonomous Remediation if verified critical
            if is_real and firing.rule.severity == "critical":
                try:
                    from app.engine.remediation import remediation_engine
                    await remediation_engine.trigger(
                        service=firing.service,
                        host=firing.host,
                        metric_name=firing.rule.metric_name,
                        current_value=firing.current_value,
                        description=firing.description,
                        severity=firing.rule.severity,
                        anomaly_id=anomaly_id,
                        rca_summary=verify_result.get("reason"),
                        trigger_type="autonomous",
                        samples=approx_samples,
                    )
                    log.info("Autonomous remediation dispatched for critical threshold anomaly %d", anomaly_id)
                except Exception as e:
                    log.error("Failed to trigger autonomous remediation for anomaly %d: %s", anomaly_id, e)


    async def run_all(self) -> int:
        """Load all rules, evaluate each, persist firings.  Returns total firings count."""
        from app.engine.deduplicator import deduplicator

        rules = await self.load_rules()
        total = 0
        for rule in rules:
            try:
                firings = await self.evaluate(rule)
                firings_groups = getattr(self, '_last_evaluated_groups', {})
                for firing in firings:
                    if deduplicator.is_duplicate(
                        firing.rule.metric_name, firing.host, firing.service, "threshold"
                    ):
                        log.debug(
                            "Dedup: suppressing threshold alert for %s/%s/%s",
                            firing.rule.metric_name, firing.host, firing.service,
                        )
                        continue

                    anomaly_id = await self.persist_firing(firing)
                    
                    # Spawn async verification
                    import asyncio
                    asyncio.create_task(self._verify_threshold_anomaly(anomaly_id, firing, firings_groups[firing.host, firing.service]))
                    
                    deduplicator.mark_fired(
                        firing.rule.metric_name, firing.host, firing.service, "threshold"
                    )
                    total += 1
            except Exception:
                log.exception("Error evaluating rule id=%d name=%s", rule.id, rule.name)
        return total


# Module-level singleton
rules_evaluator = RulesEvaluator()
