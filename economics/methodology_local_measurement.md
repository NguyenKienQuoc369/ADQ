# ADQ Local Resource Measurement Methodology (Phase C2A)

## 1. Scope & Objective
This document specifies the exact methodology for capturing **empirical resource utilization** for ADQ security operations within the local containerized environment.

> [!IMPORTANT]
> **LOCAL_EMPIRICAL != VPS_EMPIRICAL**
> All data gathered in Phase C2A represents local hardware/kernel performance characteristics (Intel Core Ultra 9 285H, 16 vCPUs, 32 GB RAM, Linux 6.12 Manjaro, Docker 29.7.2). These figures capture baseline execution behavior and resource envelopes, but are **not** production VPS cost evidence. No financial calculations, margins, or break-even derivations are performed in C2A.

---

## 2. Measurement Primitives & Tools

| Metric | Measurement Primitive | Tool / System Source | Unit |
| :--- | :--- | :--- | :--- |
| **Wall-Clock Time** | High-resolution monotonic clock | `time.perf_counter()` | Seconds ($s$) |
| **CPU Time** | User CPU + System CPU time | `/usr/bin/time -v` / `getrusage(RUSAGE_CHILDREN)` | Seconds ($s$) |
| **Peak Memory RSS** | Maximum resident set size | `/usr/bin/time -v` (`Maximum resident set size`) / cgroup `memory.peak` | Megabytes ($MB$) |
| **Network Egress (TX)** | Outbound bytes transmitted | Container network namespace / socket counters / `/proc/net/dev` | Bytes ($B$) |
| **Network Ingress (RX)**| Inbound bytes received | Container network namespace / socket counters / `/proc/net/dev` | Bytes ($B$) |
| **Artifact Footprint** | Cumulative size of generated logs, raw outputs, and JSON reports | `du -sb` / `os.scandir()` | Bytes ($B$) |
| **AI Token Telemetry** | Exact prompt & candidate token counts | Provider response metadata hook (`usageMetadata`) | Tokens |

---

## 3. Idle Baseline Measurement Protocol

1. Ensure the platform background containers are running:
   - `adq_api` (FastAPI Server)
   - `adq-worker-light-1` (Recon / Light Scan Worker)
   - `adq-worker-elite-1` (Elite DAST Worker)
   - `adq_worker_stress` (L7 Stress Worker)
   - `adq_postgres` (PostgreSQL 15 Database)
   - `adq_redis` (Redis 7 Broker)
2. In the absence of any active scanning or stress jobs, capture $N = 3$ consecutive samples separated by a 5-second interval.
3. Record idle CPU %, resident memory, and network background delta per container into `economics/measurements/idle_baseline.csv`.

---

## 4. Workload Execution Protocols

### Workload 1: DAST Security Scan (Profile A)
- **Target**: Pinned OWASP Juice Shop container (`bkimminich/juice-shop:v17.1.1` on port 3000).
- **Execution Engine**: `quoc_omni.py` unauthenticated blackbox Profile A scan.
- **Repetitions**: 3 independent runs with container healthcheck verification.
- **Metrics Collected**: Wall time, process tree CPU time (user+sys), peak RSS, target & scanner network TX/RX, artifact directory size (`recon_127_0_0_1_3000`).

### Workload 2: Layer 7 Stress Test (PRO Tier Limits)
- **Target**: Controlled local test target.
- **Parameters**: Duration $\le 30s$, Total Requests $\le 2,000$, Target RPS $\le 100$.
- **Repetitions**: 3 independent runs.
- **Metrics Collected**: Wall time, generator CPU time, peak RSS, network TX/RX bytes, confirmed request count.

### Workload 3: Layer 7 Stress Test (PRO_MAX Tier Limits)
- **Target**: Controlled local test target.
- **Parameters**: Duration $\le 60s$, Total Requests $\le 5,000$, Target RPS $\le 250$.
- **Repetitions**: 3 independent runs.
- **Metrics Collected**: Wall time, generator CPU time, peak RSS, network TX/RX bytes, confirmed request count.

---

## 5. Statistical Aggregation
For each workload, across 3 independent runs:
- `min`: Minimum observed value
- `median`: Median observed value (Run 2 of sorted 3)
- `max`: Maximum observed value

No P95 is calculated for $N = 3$ sample sets.

