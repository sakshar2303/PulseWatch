"""FastAPI integration tests for the detector service.

Uses httpx.AsyncClient with the FastAPI test transport so no real server
or database is needed.  DB calls are monkey-patched at the pool level.
"""

from __future__ import annotations

import time
from typing import Any, Dict, List
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient


class _FakeConn:
    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        pass

    async def fetch(self, *a, **kw):
        return []

    async def fetchrow(self, *a, **kw):
        return {"id": 1}


class _FakePool:
    def acquire(self):
        return _FakeConn()


# Patch the DB pool and scheduler before importing the app
@pytest.fixture(autouse=True)
def patch_db_and_scheduler(monkeypatch):
    """Prevent real DB connections and scheduler from starting during tests."""
    async def fake_create_pool():
        pass

    async def fake_close_pool():
        pass

    fake_pool = _FakePool()

    async def fake_get_pool():
        return fake_pool

    # Patch before app import caches references
    monkeypatch.setattr("app.db.session.create_pool", fake_create_pool)
    monkeypatch.setattr("app.db.session.close_pool", fake_close_pool)
    monkeypatch.setattr("app.db.session.get_pool", fake_get_pool)
    monkeypatch.setattr("app.api.main.create_pool", fake_create_pool)
    monkeypatch.setattr("app.api.main.close_pool", fake_close_pool)
    monkeypatch.setattr("app.api.main.get_pool", fake_get_pool)
    monkeypatch.setattr("app.engine.rules.get_pool", fake_get_pool)
    monkeypatch.setattr("app.engine.detector.get_pool", fake_get_pool)
    # Prevent the background evaluation_loop from running
    monkeypatch.setattr("app.api.main.evaluation_loop", _noop_loop)


async def _noop_loop():
    import asyncio
    await asyncio.sleep(9999)


@pytest_asyncio.fixture
async def client():
    from app.api.main import app
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# ---------------------------------------------------------------------------
# /health
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_health_returns_ok(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["service"] == "detector"


# ---------------------------------------------------------------------------
# /api/v1/models
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_models_empty(client):
    resp = await client.get("/api/v1/models")
    assert resp.status_code == 200
    # Fresh registry — list may be empty or populated by other tests in the session
    assert isinstance(resp.json(), list)


# ---------------------------------------------------------------------------
# /api/v1/train
# ---------------------------------------------------------------------------

def _make_samples(n: int = 60):
    now = time.time()
    return [{"timestamp": now + i, "value": 50.0 + i * 0.1} for i in range(n)]


@pytest.mark.asyncio
async def test_train_sufficient_samples(client):
    samples = _make_samples(60)
    resp = await client.post(
        "/api/v1/train",
        json={"metric": "test_cpu", "samples": samples},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["trained"] is True
    assert body["sample_count"] == 60


@pytest.mark.asyncio
async def test_train_too_few_samples(client):
    samples = _make_samples(5)
    resp = await client.post(
        "/api/v1/train",
        json={"metric": "test_cpu_small", "samples": samples},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["trained"] is False
    assert body["sample_count"] == 0


# ---------------------------------------------------------------------------
# /api/v1/detect
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_detect_after_train(client):
    samples = _make_samples(60)
    # Train first
    await client.post(
        "/api/v1/train",
        json={"metric": "test_detect", "samples": samples},
    )
    resp = await client.post(
        "/api/v1/detect",
        json={"metric": "test_detect", "samples": samples},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "is_anomaly" in body
    assert body["trained"] is True


@pytest.mark.asyncio
async def test_detect_untrained_metric_returns_not_anomaly(client):
    samples = _make_samples(5)  # too few to auto-train
    resp = await client.post(
        "/api/v1/detect",
        json={"metric": "totally_new_metric_xyz", "samples": samples},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["is_anomaly"] is False
    assert body["trained"] is False


# ---------------------------------------------------------------------------
# /api/v1/anomalies  (stubbed DB returns [])
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_anomalies_empty(client):
    resp = await client.get("/api/v1/anomalies")
    assert resp.status_code == 200
    assert resp.json() == []


# ---------------------------------------------------------------------------
# /api/v1/rules  (stubbed DB returns [])
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_rules_empty(client):
    resp = await client.get("/api/v1/rules")
    assert resp.status_code == 200
    assert resp.json() == []
