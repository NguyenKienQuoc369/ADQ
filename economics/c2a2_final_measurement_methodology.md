# ADQ Unit Economics Empirical Measurement Methodology (C2B Specification)

## 1. Scope and Objective
This document formalizes the rigorous measurement methodology for extracting empirical resource consumption (CPU time, peak memory RSS, network I/O, artifacts, and AI tokens) on local environments (Phase C2A / C2A.1 / C2A.2) and staging/production VPS environments (Phase C2B).

All measurements are strictly confined to hardware/system metrics (`LOCAL_EMPIRICAL` or `VPS_EMPIRICAL`).
No monetary cost conversions, gross margin derivations, or break-even calculations may be performed until explicit empirical invoice and pricing inputs are provided.

---

## 2. Metric Measurement Specifications

### A. Compute / CPU Time
- **Metric**: CPU User + System seconds consumed by the workload execution.
- **Method**:
  - For standalone CLI/subprocess scanner (`quoc_omni.py`): measured via `resource.getrusage(resource.RUSAGE_CHILDREN)` capturing the complete waited process tree (including all child engines: `ffuf`, `nuclei`, `katana`, `httpx`, `naabu`, `arjun`).
  - For worker containers: container cgroup `cpu.stat` delta before and after job execution:
    $$\Delta \text{CPU}_{\text{gross}} = \text{CPU}_{\text{after}} - \text{CPU}_{\text{before}}$$
  - **Net Incremental CPU**:
    $$\Delta \text{CPU}_{\text{incremental}} = \max(0, \Delta \text{CPU}_{\text{gross}} - (\text{Idle CPU Rate} \times \text{Duration}))$$

### B. Memory / RAM RSS
- **Metric**: Peak Resident Set Size (RSS) in Megabytes.
- **Method**:
  - Sampled recursively across the active workload process tree at 50ms intervals using `psutil`.
  - **Isolation Rule**: Do NOT use `getrusage(RUSAGE_CHILDREN).ru_maxrss` within a long-running process across different sequential workloads, because `ru_maxrss` on Linux is a monotonically non-decreasing process-lifetime high-water mark.
  - **Reporting Format**:
    1. `Idle Baseline Memory`: Snapshot of steady-state container RSS.
    2. `Workload Peak Memory`: Absolute peak RSS reached during execution.
    3. `Incremental Peak Memory`:
       $$\text{Incremental Peak RAM} = \max(0, \text{Workload Peak RAM} - \text{Idle Baseline RAM})$$

### C. Network I/O (Egress & Ingress)
- **Metric**: Bytes Transmitted (TX) and Received (RX) over the wire.
- **Perspective**: Always defined from the **ADQ Application / Scanner Perspective**:
  - $\text{Scanner TX (Egress)} = \text{Target RX (Bytes Received by Target)}$
  - $\text{Scanner RX (Ingress)} = \text{Target TX (Bytes Transmitted by Target)}$
- **Method**:
  - Read network device counters (`/proc/<pid>/net/dev` or isolated container interface `docker stats`) immediately before and after the workload run:
    $$\Delta \text{TX} = \text{TX}_{\text{after}} - \text{TX}_{\text{before}}$$
    $$\Delta \text{RX} = \text{RX}_{\text{after}} - \text{RX}_{\text{before}}$$
  - Subtract background idle network chatter where material.

### D. Job Runtime
- **Metric**: Wall-clock duration in seconds ($T_{\text{end}} - T_{\text{start}}$) measured using monotonic clock (`time.perf_counter()`).

### E. AI Telemetry
- **Metric**: Token counts (`prompt_tokens`, `output_tokens`, `cached_tokens`).
- **Policy**:
  - When AI engine metadata is provided by the provider SDK (`google-genai` `usageMetadata`), extract and record exact integer tokens.
  - When tests run in offline/local mock mode without active LLM API keys, record strictly as `null` with `ai_usage_source = "unavailable"`.

---

## 3. Empirical Verification Matrix (C2A.2 Summary)

| Workload | Runtime Median | CPU Seconds Median | Peak RAM RSS Median | Network TX Median | Network RX Median | Classification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **DAST Profile-A** | `200.55s` | `75.63s` | `1190.07 MB` | `13.80 MB` | `42.30 MB` | `LOCAL_EMPIRICAL` |
| **Stress PRO** | `30.65s` | `3.05s` | `99.79 MB` | `1.45 MB` | `4.10 MB` | `LOCAL_EMPIRICAL` |
| **Stress PRO_MAX** | `60.89s` | `7.47s` | `100.11 MB` | `3.59 MB` | `10.20 MB` | `LOCAL_EMPIRICAL` |

---

## 4. Idle Baseline Summary (6 Core Services, 10s Interval)

| Service | Median Idle CPU Delta / 10s | Median Idle Net RX Delta / 10s | Median Idle Net TX Delta / 10s | Median Idle Memory RSS |
| :--- | :--- | :--- | :--- | :--- |
| **API Server (`adq_api`)** | `0.0100s` | `0 bytes` | `0 bytes` | `101.68 MB` |
| **Worker Light (`adq-worker-light-1`)** | `0.0000s` | `1492 bytes` | `2412 bytes` | `80.05 MB` |
| **Worker Elite (`adq-worker-elite-1`)** | `0.0000s` | `1492 bytes` | `2419 bytes` | `79.41 MB` |
| **Worker Stress (`adq_worker_stress`)** | `0.0000s` | `1492 bytes` | `2392 bytes` | `87.61 MB` |
| **Redis Broker (`adq_redis`)** | `0.0500s` | `12,407 bytes` | `6,331 bytes` | `13.55 MB` |
| **PostgreSQL (`adq_postgres`)** | `0.0000s` | `0 bytes` | `0 bytes` | `62.75 MB` |
