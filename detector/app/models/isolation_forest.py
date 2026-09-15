"""Isolation Forest anomaly-detection model wrapper.

Wraps scikit-learn's ``IsolationForest`` with:

* Feature engineering — rolling mean, std, and delta extracted from a
  time-ordered list of ``(timestamp, value)`` pairs.
* Per-metric model registry so each metric has its own model state.
* Thread-safe (GIL-protected) fit / predict.  Async callers should run
  ``fit`` / ``predict`` inside ``asyncio.to_thread`` to avoid blocking.

Typical usage::

    from app.models.isolation_forest import ModelRegistry

    registry = ModelRegistry()
    registry.fit("cpu_usage", samples)
    result = registry.predict("cpu_usage", samples)
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

import numpy as np
from sklearn.ensemble import IsolationForest

from app.config import settings

# A sample is a (unix_timestamp_seconds, value) pair.
Sample = Tuple[float, float]


# ---------------------------------------------------------------------------
# Feature engineering
# ---------------------------------------------------------------------------

def _extract_features(samples: List[Sample], window: int = 10) -> np.ndarray:
    """Convert a list of (timestamp, value) pairs into a feature matrix.

    Features per data point:
        - raw value
        - rolling mean (last ``window`` values)
        - rolling std  (last ``window`` values, min_periods=2)
        - delta from previous value (0 for first point)

    Returns an ndarray of shape ``(len(samples), 4)``.
    """
    if len(samples) == 0:
        return np.empty((0, 4))

    values = np.array([v for _, v in samples], dtype=float)
    n = len(values)

    rolling_mean = np.zeros(n)
    rolling_std = np.zeros(n)
    deltas = np.zeros(n)

    for i in range(n):
        start = max(0, i - window + 1)
        window_vals = values[start : i + 1]
        rolling_mean[i] = window_vals.mean()
        rolling_std[i] = window_vals.std() if len(window_vals) >= 2 else 0.0
        deltas[i] = values[i] - values[i - 1] if i > 0 else 0.0

    return np.column_stack([values, rolling_mean, rolling_std, deltas])


# ---------------------------------------------------------------------------
# Per-metric model state
# ---------------------------------------------------------------------------

@dataclass
class _ModelState:
    model: IsolationForest
    trained: bool = False
    sample_count: int = 0


# ---------------------------------------------------------------------------
# Public registry
# ---------------------------------------------------------------------------

class ModelRegistry:
    """Thread-safe registry of per-metric Isolation Forest models."""

    def __init__(self) -> None:
        self._models: dict[str, _ModelState] = {}
        self._lock = threading.Lock()

    def _get_or_create(self, metric: str) -> _ModelState:
        with self._lock:
            if metric not in self._models:
                self._models[metric] = _ModelState(
                    model=IsolationForest(
                        n_estimators=settings.n_estimators,
                        contamination=settings.default_contamination,
                        random_state=42,
                        n_jobs=-1,
                    )
                )
            return self._models[metric]

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def fit(self, metric: str, samples: List[Sample]) -> int:
        """Fit (or re-fit) the model for *metric*.

        Returns the number of training samples used, or 0 if there were
        too few samples to train.
        """
        if len(samples) < settings.min_train_samples:
            return 0

        X = _extract_features(samples)
        state = self._get_or_create(metric)
        state.model.fit(X)
        state.trained = True
        state.sample_count = len(samples)
        return len(samples)

    @dataclass
    class PredictResult:
        score: float          # raw anomaly score (more negative = more anomalous)
        is_anomaly: bool
        severity: str         # 'info' | 'warning' | 'critical'
        features: List[float] = field(default_factory=list)

    def predict(self, metric: str, samples: List[Sample]) -> Optional["ModelRegistry.PredictResult"]:
        """Score the *last* sample in the window.

        Returns ``None`` if the model is not yet trained or samples are empty.
        """
        state = self._get_or_create(metric)
        if not state.trained or len(samples) == 0:
            return None

        X = _extract_features(samples)
        # Score all rows; anomaly score of the *last* point is what we care about.
        # decision_function yields >0 for inliers, <0 for outliers.
        scores: np.ndarray = state.model.decision_function(X)
        last_score = float(scores[-1])
        last_features = X[-1].tolist()

        is_anomaly = last_score < settings.score_warning_threshold
        if last_score <= settings.score_critical_threshold:
            severity = "critical"
        elif last_score <= settings.score_warning_threshold:
            severity = "warning"
        else:
            severity = "info"

        return ModelRegistry.PredictResult(
            score=last_score,
            is_anomaly=is_anomaly,
            severity=severity,
            features=last_features,
        )

    def is_trained(self, metric: str) -> bool:
        """Return True if the model for *metric* has been fitted."""
        with self._lock:
            state = self._models.get(metric)
            return state is not None and state.trained

    def list_metrics(self) -> List[str]:
        """Return all metric names that have a registered model."""
        with self._lock:
            return list(self._models.keys())

    def info(self, metric: str) -> Optional[dict]:
        """Return a JSON-serialisable info dict for *metric*."""
        with self._lock:
            state = self._models.get(metric)
            if state is None:
                return None
            return {
                "metric": metric,
                "trained": state.trained,
                "sample_count": state.sample_count,
                "n_estimators": settings.n_estimators,
                "contamination": settings.default_contamination,
            }


# ---------------------------------------------------------------------------
# Module-level singleton shared across the application
# ---------------------------------------------------------------------------
model_registry = ModelRegistry()
