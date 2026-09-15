"""Anomaly deduplicator.

Prevents flooding the ``anomalies`` table with duplicate rows when the same
condition persists across multiple evaluation cycles.

Strategy — *cooldown window*:
    After an anomaly fires for a given key ``(metric, host, service, type)``,
    no additional anomaly of the same key is written until a configurable
    cooldown period has elapsed.

The deduplicator is intentionally simple (in-memory dict) because:
    - The detector service is a single-process worker; there is no need for
      distributed coordination at this scale.
    - If the process restarts, the cooldown resets — a brief burst of
      duplicate anomalies is acceptable immediately after a crash.

For a multi-replica deployment, replace ``_cooldowns`` with a Redis SETNX
call and this module's interface stays the same.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Tuple

log = logging.getLogger(__name__)

# Key: (metric_name, host, service, anomaly_type)
_CooldownKey = Tuple[str, str, str, str]

# Default cooldown: do not re-fire the same anomaly within this window.
_DEFAULT_COOLDOWN_SECONDS = 300  # 5 minutes


class AnomalyDeduplicator:
    """In-memory cooldown registry for anomaly deduplication."""

    def __init__(self, cooldown_seconds: int = _DEFAULT_COOLDOWN_SECONDS) -> None:
        self._cooldown = timedelta(seconds=cooldown_seconds)
        self._last_fired: Dict[_CooldownKey, datetime] = {}

    def is_duplicate(
        self,
        metric: str,
        host: str,
        service: str,
        anomaly_type: str,
    ) -> bool:
        """Return True if this anomaly key is within its cooldown window."""
        key: _CooldownKey = (metric, host, service, anomaly_type)
        last = self._last_fired.get(key)
        if last is None:
            return False
        return datetime.now(timezone.utc) - last < self._cooldown

    def mark_fired(
        self,
        metric: str,
        host: str,
        service: str,
        anomaly_type: str,
    ) -> None:
        """Record that this anomaly key just fired."""
        key: _CooldownKey = (metric, host, service, anomaly_type)
        self._last_fired[key] = datetime.now(timezone.utc)
        log.debug("Dedup: marked %s as fired", key)

    def clear_expired(self) -> int:
        """Prune entries whose cooldown has elapsed.  Returns number removed."""
        now = datetime.now(timezone.utc)
        expired = [k for k, v in self._last_fired.items() if now - v >= self._cooldown]
        for k in expired:
            del self._last_fired[k]
        return len(expired)

    @property
    def active_count(self) -> int:
        return len(self._last_fired)


# Module-level singleton
deduplicator = AnomalyDeduplicator()
