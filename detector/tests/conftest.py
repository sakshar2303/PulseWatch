"""Pytest configuration for the detector test suite."""

import pytest


# Make pytest-asyncio use auto mode so async tests don't need explicit markers.
# (Alternatively configured via pyproject.toml asyncio_mode = "auto".)
