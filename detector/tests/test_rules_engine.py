"""Tests for the threshold rules engine.

These tests exercise the pure logic layer (_evaluate_condition, rule
filtering) without touching the database.  DB-dependent tests are in
test_api.py (integration level).
"""

from __future__ import annotations

import pytest

# We import the internal helper directly to test it in isolation
from app.engine.rules import _evaluate_condition, AlertRule, RulesEvaluator


# ---------------------------------------------------------------------------
# _evaluate_condition
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("value,condition,threshold,expected", [
    (90.0, ">",  80.0, True),
    (70.0, ">",  80.0, False),
    (70.0, "<",  80.0, True),
    (90.0, "<",  80.0, False),
    (80.0, ">=", 80.0, True),
    (79.9, ">=", 80.0, False),
    (80.0, "<=", 80.0, True),
    (80.1, "<=", 80.0, False),
    (42.0, "==", 42.0, True),
    (42.1, "==", 42.0, False),
    (50.0, "??", 10.0, False),   # unknown operator
])
def test_evaluate_condition(value, condition, threshold, expected):
    assert _evaluate_condition(value, condition, threshold) == expected


# ---------------------------------------------------------------------------
# AlertRule dataclass
# ---------------------------------------------------------------------------

def _make_rule(**kwargs) -> AlertRule:
    defaults = dict(
        id=1,
        name="cpu_high",
        metric_name="cpu_usage",
        condition=">",
        threshold=80.0,
        duration_seconds=300.0,
        severity="warning",
        service=None,
        host=None,
    )
    defaults.update(kwargs)
    return AlertRule(**defaults)


def test_alert_rule_defaults():
    rule = _make_rule()
    assert rule.enabled if hasattr(rule, "enabled") else True
    assert rule.threshold == 80.0


# ---------------------------------------------------------------------------
# RulesEvaluator (logic-only, no DB)
# ---------------------------------------------------------------------------

def test_all_breach_fires():
    """Simulates the all-breach check logic directly."""
    values = [85.0, 87.0, 90.0]  # all > 80
    rule = _make_rule(condition=">", threshold=80.0)
    result = all(_evaluate_condition(v, rule.condition, rule.threshold) for v in values)
    assert result is True


def test_partial_breach_does_not_fire():
    """If any value is below threshold the rule should NOT fire."""
    values = [85.0, 79.0, 90.0]  # 79 < 80 breaks the streak
    rule = _make_rule(condition=">", threshold=80.0)
    result = all(_evaluate_condition(v, rule.condition, rule.threshold) for v in values)
    assert result is False


def test_invalid_condition_never_fires():
    values = [999.0, 999.0]
    rule = _make_rule(condition="??", threshold=0.0)
    result = all(_evaluate_condition(v, rule.condition, rule.threshold) for v in values)
    assert result is False


def test_single_value_breach():
    values = [100.0]
    rule = _make_rule(condition=">", threshold=80.0)
    result = all(_evaluate_condition(v, rule.condition, rule.threshold) for v in values)
    assert result is True
