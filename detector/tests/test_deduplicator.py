"""Tests for the anomaly deduplicator."""

from __future__ import annotations

import time
from app.engine.deduplicator import AnomalyDeduplicator


def test_dedup_initial_state_not_duplicate():
    dedup = AnomalyDeduplicator(cooldown_seconds=60)
    assert not dedup.is_duplicate("cpu", "host1", "svc1", "threshold")


def test_dedup_mark_fired_makes_it_duplicate():
    dedup = AnomalyDeduplicator(cooldown_seconds=60)
    dedup.mark_fired("cpu", "host1", "svc1", "threshold")
    assert dedup.is_duplicate("cpu", "host1", "svc1", "threshold")


def test_dedup_different_keys_are_independent():
    dedup = AnomalyDeduplicator(cooldown_seconds=60)
    dedup.mark_fired("cpu", "host1", "svc1", "threshold")
    # Different metric
    assert not dedup.is_duplicate("mem", "host1", "svc1", "threshold")
    # Different host
    assert not dedup.is_duplicate("cpu", "host2", "svc1", "threshold")
    # Different type
    assert not dedup.is_duplicate("cpu", "host1", "svc1", "ml_isolation_forest")


def test_dedup_expired_cooldown():
    dedup = AnomalyDeduplicator(cooldown_seconds=1)
    dedup.mark_fired("cpu", "host1", "svc1", "threshold")
    assert dedup.is_duplicate("cpu", "host1", "svc1", "threshold")
    time.sleep(1.1)
    assert not dedup.is_duplicate("cpu", "host1", "svc1", "threshold")
    removed = dedup.clear_expired()
    assert removed == 1
    assert dedup.active_count == 0
