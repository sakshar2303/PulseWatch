"""Tests for the Isolation Forest model wrapper.

These are pure-Python unit tests — no database required.
"""

from __future__ import annotations

import math
import time
from typing import List, Tuple

import numpy as np
import pytest

from app.models.isolation_forest import ModelRegistry, _extract_features

Sample = Tuple[float, float]

# ---------------------------------------------------------------------------
# Feature extraction
# ---------------------------------------------------------------------------


def _linear_samples(n: int, slope: float = 1.0) -> List[Sample]:
    now = time.time()
    return [(now + i, slope * i + 50.0) for i in range(n)]


def test_extract_features_shape():
    samples = _linear_samples(20)
    X = _extract_features(samples)
    assert X.shape == (20, 4), "Expected (n, 4) feature matrix"


def test_extract_features_empty():
    X = _extract_features([])
    assert X.shape == (0, 4)


def test_extract_features_delta_first_row_is_zero():
    samples = _linear_samples(5)
    X = _extract_features(samples)
    assert X[0, 3] == 0.0, "Delta for first row must be 0"


def test_extract_features_delta_constant_series():
    """Constant series → all deltas 0 after first row."""
    now = time.time()
    samples = [(now + i, 42.0) for i in range(10)]
    X = _extract_features(samples)
    assert all(X[i, 3] == 0.0 for i in range(10))


# ---------------------------------------------------------------------------
# ModelRegistry.fit / predict
# ---------------------------------------------------------------------------


def _normal_samples(n: int, mean: float = 50.0, std: float = 2.0) -> List[Sample]:
    rng = np.random.default_rng(42)
    now = time.time()
    vals = rng.normal(mean, std, n)
    return [(now + i, float(v)) for i, v in enumerate(vals)]


def test_fit_too_few_samples_returns_zero():
    registry = ModelRegistry()
    samples = _normal_samples(5)   # min_train_samples default is 30
    result = registry.fit("cpu", samples)
    assert result == 0


def test_fit_sufficient_samples_returns_count():
    registry = ModelRegistry()
    samples = _normal_samples(50)
    result = registry.fit("cpu", samples)
    assert result == 50


def test_predict_before_fit_returns_none():
    registry = ModelRegistry()
    samples = _normal_samples(50)
    result = registry.predict("cpu_untrained", samples)
    assert result is None


def test_predict_normal_series_not_anomaly():
    """A perfectly normal series should not be flagged."""
    registry = ModelRegistry()
    samples = _normal_samples(200)
    registry.fit("cpu", samples)
    result = registry.predict("cpu", samples)
    assert result is not None
    assert result.is_anomaly is False


def test_predict_extreme_spike_is_anomaly():
    """Injecting a massive spike at the end should trigger an anomaly."""
    registry = ModelRegistry()
    samples = _normal_samples(200, mean=50.0, std=1.0)
    # Re-fit on normal data, then predict on data with a spike
    registry.fit("cpu_spike", samples)
    # Append an extreme outlier
    spiked = samples[:] + [(samples[-1][0] + 1, 500.0)]
    result = registry.predict("cpu_spike", spiked)
    assert result is not None
    assert result.is_anomaly is True


def test_is_trained_reflects_fit_state():
    registry = ModelRegistry()
    assert registry.is_trained("new_metric") is False
    registry.fit("new_metric", _normal_samples(50))
    assert registry.is_trained("new_metric") is True


def test_list_metrics():
    registry = ModelRegistry()
    registry.fit("m1", _normal_samples(50))
    registry.fit("m2", _normal_samples(50))
    metrics = registry.list_metrics()
    assert "m1" in metrics
    assert "m2" in metrics


def test_info_returns_none_for_unknown():
    registry = ModelRegistry()
    assert registry.info("does_not_exist") is None


def test_info_returns_dict_after_fit():
    registry = ModelRegistry()
    registry.fit("mem", _normal_samples(50))
    info = registry.info("mem")
    assert info is not None
    assert info["trained"] is True
    assert info["sample_count"] == 50
