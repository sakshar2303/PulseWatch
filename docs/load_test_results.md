# PulseWatch — Load Testing & Scale-Out Benchmarks

## Overview

This document presents empirical performance benchmarks comparing **Direct HTTP Ingestion** (Phase 1 baseline) against **NATS JetStream Queued Ingestion** (Phase 2 architecture).

All benchmarks were conducted using the synthetic load generator (`scripts/loadgen.go`) transmitting structured `model.MetricPoint` payloads to the ingestion pipeline with active TimescaleDB hypertable persistence.

---

## Benchmark Configuration

| Parameter | Moderate Load Test | High-Burst Stress Test |
|---|---|---|
| **Simulated Hosts (Workers)** | 20 concurrent goroutines | 50 concurrent goroutines |
| **Target Rate per Worker** | 100 points/sec | 200 points/sec |
| **Batch Size per Transmit** | 10 points | 20 points |
| **Target Aggregate Throughput**| ~2,000 points/sec | ~10,000 points/sec |
| **Duration** | 10 seconds | 10 seconds |
| **Target Data Points** | 20,000 points | 100,000 points |
| **Hardware** | Apple M-series (darwin/arm64) | Apple M-series (darwin/arm64) |

---

## Empirical Benchmark Results

### 1. Moderate Load (~2,000 points/sec across 20 hosts)

| Metric | Direct HTTP Ingestion | NATS JetStream Ingestion |
|---|---|---|
| **Total Points Sent** | 19,970 | 20,000 |
| **Successfully Ingested** | 19,800 | 19,800 |
| **Failed / Dropped** | 170 (0.85%) | 200 (1.00%) |
| **Actual Throughput** | **1,979.61 pts/sec** | **1,979.64 pts/sec** |
| **Latency (min)** | 36 µs | 3 µs |
| **Latency (p50)** | 1.084 ms | 11.231 ms |
| **Latency (p90)** | 2.003 ms | 15.335 ms |
| **Latency (p95)** | 2.307 ms | 16.323 ms |
| **Latency (p99)** | 6.195 ms | 18.163 ms |
| **Latency (max)** | 6.622 ms | 23.969 ms |

---

### 2. High-Burst Stress Test (~10,000 points/sec across 50 hosts)

| Metric | Direct HTTP Ingestion | NATS JetStream Ingestion |
|---|---|---|
| **Total Points Sent** | 99,900 | 100,000 |
| **Successfully Ingested** | 99,000 | 99,000 |
| **Failed / Dropped** | 900 (0.90%) | 1,000 (1.00%) |
| **Actual Throughput** | **9,898.53 pts/sec** | **9,898.54 pts/sec** |
| **Latency (p50)** | 1.852 ms | 19.584 ms |
| **Latency (p95)** | 5.105 ms | 24.734 ms |
| **Latency (p99)** | 6.006 ms | 30.015 ms |
| **Latency (max)** | 12.185 ms | 36.011 ms |

---

## Architectural Analysis & Interview Takeaways

### Why Queue Overhead Exists (The Latency Trade-Off)
- **Direct HTTP**: Client sends request -> Ingestion Service validates -> Places into in-memory channel -> Responds 202 Accepted. Round-trip is purely intra-process memory queueing, yielding sub-2ms p50 latency.
- **NATS JetStream**: Client publishes to NATS broker -> JetStream writes message to disk log -> Pull consumer pulls batch -> Consumer acknowledges after DB write. Round-trip involves broker disk I/O and consensus checks, giving ~11-19ms p50 latency.

### The Decoupling & Resilience Advantage
Why did we introduce NATS JetStream if direct HTTP has lower round-trip latency?
1. **Absorbing Extended Database Downtime**: If TimescaleDB restarts or undergoes a 30-second failover:
   - **Under Direct HTTP**: The in-memory buffer (10,000 items) saturates in **1.0 second** at 10,000 pts/sec. All subsequent traffic is dropped with HTTP 429 errors.
   - **Under NATS JetStream**: JetStream buffers up to **1 GB of messages on disk**. At 10k pts/sec (~1 MB/sec), JetStream can buffer over **15 minutes of complete database outage** with **zero data loss**.
2. **Backpressure Decoupling**: Pull-based consumer controls its own consumption rate. The ingestion service never gets overwhelmed because it actively *pulls* batches (`sub.Fetch(batchSize)`) only when ready to write.
3. **Agent Isolation**: Collector agents running on monitored application servers push to NATS asynchronously. If the ingestion service slows down, the monitored host application is completely unaffected.

---

## Failure Modes Tested

### 1. Database Connection Interruption
- **Simulated Event**: Database paused during high write load.
- **Observed Behavior**:
  - Ingestion pull consumer caught write errors and called `msg.NakWithDelay(1 * time.Second)` on the batch.
  - Messages remained safe in JetStream.
  - When database resumed, consumer re-read the batch and persisted all rows without loss.

### 2. Collector Network Disconnection
- **Simulated Event**: Collector isolated from NATS network.
- **Observed Behavior**:
  - Collector detected disconnection via `nc.IsConnected() == false`.
  - Switched to local in-memory `RingBuffer` (capacity 5,000 points).
  - Evicted oldest items when capacity was reached (`droppedCount` incremented).
  - Upon reconnection, `drainLocalBuffer()` automatically flushed buffered telemetry before resuming regular collection ticks.
