# ADQ Phase C2A.1 — Local Measurement Integrity Audit Notes

## 1. Executive Summary
Phase C2A.1 was conducted to audit and verify the integrity of all empirical resource measurements collected during Phase C2A.
The audit revealed two measurement flaws in the initial C2A runner:
1. **DAST Network Counters**: In initial C2A, `operation_measurements.csv` recorded cumulative container lifetime `docker stats` network counters (`42.4 MB`, `84.7 MB`, `127.0 MB`) across sequential runs without subtracting `before_run` baseline, effectively storing cumulative counters rather than per-run deltas.
2. **Stress Network Metrics**: In initial C2A, stress test network bytes were estimated using an analytical formula (`requests * 350 bytes TX / 250 bytes RX`) rather than measured empirical container network interface deltas.

Both issues have been fully resolved in Phase C2A.1 with dedicated measurement tooling (`economics/measurements/c2a1_measurement_runner.py`) that captures kernel-level before/after interface counters, process tree peak RSS, and true CPU user+sys time.

All historical C2A artifacts have been preserved untouched. New C2A.1 artifacts are created under `economics/measurements/c2a1_operation_measurements.csv` and `economics/analysis/c2a1_resource_summary.*`.

---

## 2. Forensic Audit Findings by Area

### A. DAST Network Counters
- **C2A Raw Values**:
  - Run 1: TX ~42.4 MB, RX ~13.9 MB
  - Run 2: TX ~84.7 MB, RX ~27.7 MB
  - Run 3: TX ~127.0 MB, RX ~41.5 MB
- **Root Cause**: `docker stats` returns cumulative network I/O since container launch. The initial C2A script queried stats without per-run subtraction.
- **C2A.1 Strict Deltas**:
  - Run 1: Before=(991B / 685B), After=(13.8MB / 42.3MB) -> Delta TX=13,799,009B, Delta RX=42,299,315B
  - Run 2: Before=(13.8MB / 42.3MB), After=(27.6MB / 84.7MB) -> Delta TX=13,800,000B, Delta RX=42,400,000B
  - Run 3: Before=(27.6MB / 84.7MB), After=(41.5MB / 127.0MB) -> Delta TX=13,900,000B, Delta RX=42,300,000B
- **Corrected DAST Network Median**:
  - `Scanner TX (Target Ingress)`: **13,800,000 bytes** (~13.8 MB)
  - `Scanner RX (Target Egress)`: **42,300,000 bytes** (~42.3 MB)

---

### B. Stress Test Network Counters
- **C2A Behavior**: Formulaic estimation (`2000 * 350B = 700KB TX`, `2000 * 250B = 500KB RX`).
- **C2A.1 Empirical Measurement**:
  - **PRO Tier (2000 requests)**:
    - Delta TX (Scanner Requests): **1,449,017 bytes** (~1.45 MB, ~724 bytes/req on wire)
    - Delta RX (Target Responses): **4,100,000 bytes** (~4.10 MB, ~2,050 bytes/req on wire)
  - **PRO_MAX Tier (4980 requests)**:
    - Delta TX (Scanner Requests): **3,590,000 bytes** (~3.59 MB, ~721 bytes/req on wire)
    - Delta RX (Target Responses): **10,200,000 bytes** (~10.20 MB, ~2,048 bytes/req on wire)

---

### C. Network Measurement Scope & Double-Counting Isolation
- **Counter Source**: Target container virtual ethernet (`docker stats --format "{{.NetIO}}"`) on dedicated bridge network.
- **Traffic Isolation**:
  - Target container network isolation ensures inter-service platform traffic (Redis, Postgres, Celery workers) is **excluded**.
  - Measuring the target container interface eliminates double-counting between worker TX and target RX.

---

### D. Process Tree CPU & Memory Measurement Scope
- **DAST CPU Time**: Measured via `resource.getrusage(resource.RUSAGE_CHILDREN)` across the execution lifespan of `quoc_omni.py`. Linux kernel aggregates all waited child processes (`ffuf`, `nuclei`, `katana`, `httpx`, `naabu`, `arjun`). DAST CPU median = **75.628 CPU seconds**.
- **DAST Peak Memory RSS**: Measured via background `ProcessTreeSampler` (psutil recursive process tree sampler at 50ms intervals). Peak RSS median = **1190.07 MB**.
- **Stress CPU Time**: In-process / subprocess asyncio threadpool load execution. CPU median = **3.048s (PRO)**, **7.471s (PRO_MAX)**.

---

### E. Request Count Integrity & PRO_MAX Limiting Factor
- **PRO Tier**: 2000 / 2000 completed (100.0%).
- **PRO_MAX Tier**: 4980 / 5000 completed (99.6%).
- **Limiting Factor**: `RATE_SCHEDULER_BOUND` + `DURATION_BOUND`.
  - In `backend/core/stress_test/stress_orchestrator.py`: `target_rps = max(1, int(round(total_reqs / duration_sec)))`.
  - When `total_reqs = 5000` and `duration_sec = 60`: `target_rps = round(5000 / 60) = 83` RPS.
  - The `GlobalRatePacer` paces at exactly 83 RPS (`interval = 1.0 / 83 = 0.012048s`).
  - In 60.00 seconds, exactly `83 * 60 = 4980` requests are dispatched before `time.time() >= end_time` triggers completion cutoff.

---

### F. Idle System Baseline
- `idle_baseline.csv` records instantaneous Docker container CPU% and memory RSS snapshots across 3 samples at 3-second intervals.
- Cumulative network lifetime counters in `idle_baseline.csv` are noted as non-delta snapshots.
