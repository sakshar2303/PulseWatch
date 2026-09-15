"""OpenTelemetry tracing setup for the PulseWatch detector service.

Initialises an OTLP gRPC exporter when ``OTEL_EXPORTER_OTLP_ENDPOINT`` is set
(e.g. ``jaeger:4317``).  Otherwise uses a console exporter for local
development.

Usage (inside FastAPI lifespan)::

    from app.tracing import setup_tracing, shutdown_tracing

    @asynccontextmanager
    async def _lifespan(app):
        setup_tracing("pulsewatch-detector")
        ...
        yield
        shutdown_tracing()
"""

from __future__ import annotations

import logging
import os
from typing import Optional

try:
    from opentelemetry import trace
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import (
        BatchSpanProcessor,
        ConsoleSpanExporter,
    )
    HAS_OTEL = True
except ImportError:
    HAS_OTEL = False
    TracerProvider = object  # type: ignore

log = logging.getLogger(__name__)

_provider: Optional[TracerProvider] = None


def setup_tracing(service_name: str = "pulsewatch-detector") -> None:
    """Configure the global TracerProvider and auto-instrument FastAPI."""
    global _provider
    if not HAS_OTEL:
        log.info("OTEL packages not installed — distributed tracing disabled")
        return

    resource = Resource.create({"service.name": service_name, "service.version": "1.0.0"})

    endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "")
    if endpoint:
        exporter = OTLPSpanExporter(endpoint=endpoint, insecure=True)
        log.info("OTEL OTLP exporter configured → %s", endpoint)
    else:
        exporter = ConsoleSpanExporter()
        log.info("OTEL No OTLP endpoint — using console exporter")

    _provider = TracerProvider(resource=resource)
    _provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(_provider)


def instrument_app(app) -> None:
    """Auto-instrument a FastAPI application with OpenTelemetry."""
    if not HAS_OTEL:
        return
    FastAPIInstrumentor.instrument_app(app)
    log.info("FastAPI auto-instrumented with OpenTelemetry")


def shutdown_tracing() -> None:
    """Flush pending spans and shut down the tracer provider."""
    global _provider
    if not HAS_OTEL:
        return
    if _provider is not None:
        _provider.shutdown()
        _provider = None
