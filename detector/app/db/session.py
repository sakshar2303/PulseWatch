"""Async TimescaleDB / PostgreSQL connection pool.

Provides a singleton ``asyncpg`` pool that every module in the detector
service should consume.  The pool is created once at application startup
(via the FastAPI lifespan hook) and closed cleanly on shutdown.

Usage::

    from app.db.session import get_pool

    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT …")
"""

from __future__ import annotations

import asyncpg

from app.config import settings

_pool: asyncpg.Pool | None = None


async def create_pool() -> asyncpg.Pool:
    """Create and cache the connection pool.  Called once at startup."""
    global _pool
    _pool = await asyncpg.create_pool(
        dsn=settings.db_url,
        min_size=2,
        max_size=10,
        command_timeout=30,
    )
    return _pool


async def get_pool() -> asyncpg.Pool:
    """Return the existing pool, or create it if not yet initialised."""
    global _pool
    if _pool is None:
        await create_pool()
    return _pool  # type: ignore[return-value]


async def close_pool() -> None:
    """Gracefully close the pool.  Called at application shutdown."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
