# ADQ Phase C2 — Empirical VPS & Telemetry Measurement Checklist

This document defines the exact checklist of empirical data to be measured on the production/staging VPS environment during **Phase C2**.

---

## 1. Category A: Infrastructure Invoice & Cloud Provider Configuration

| Item | Description | MEASUREMENT_METHOD | REQUIRED_ACCESS | OUTPUT_FIELD |
| :--- | :--- | :--- | :--- | :--- |
| **A1. VPS Compute** | Dedicated/Shared VPS monthly hosting cost | Provider billing invoice / active plan spec | Cloud console / billing receipt | `vps_monthly_cost_vnd` |
| **A2. PostgreSQL DB** | Database instance hosting / storage cost | Managed DB billing invoice or VPS slice allocation | Cloud console / billing receipt | `postgres_monthly_cost_vnd` |
| **A3. Redis Queue** | In-memory queue & state broker cost | Managed Redis billing or VPS resource allocation | Cloud console / billing receipt | `redis_monthly_cost_vnd` |
| **A4. Storage & Backups** | Persistent volume / S3 backup storage cost | Provider storage tier invoice | Cloud console / billing receipt | `storage_monthly_cost_vnd` |
| **A5. Bandwidth / Egress** | Included data transfer allowance & overage rate | Cloud provider network terms & usage meters | Cloud console / bandwidth terms | `egress_cost_per_gb_vnd` |

---

## 2. Category B: DAST Scan Empirical Measurement (Profile A on Target)

| Metric | Description | MEASUREMENT_METHOD | REQUIRED_ACCESS | OUTPUT_FIELD |
| :--- | :--- | :--- | :--- | :--- |
| **B1. Wall-Clock Duration** | End-to-end scan execution time | `time.perf_counter()` monotonic timestamp delta | Worker execution log | `dast_empirical_duration_seconds` |
| **B2. Worker CPU Delta** | Exact user + system CPU seconds consumed | Linux cgroup v2 (`cpu.stat` / `usage_usec`) or `/proc/[pid]/stat` | Root/sudo cgroup read or `getrusage()` | `dast_empirical_cpu_seconds` |
| **B3. Peak RAM RSS** | Maximum resident memory footprint | Linux cgroup `memory.peak` or `ru_maxrss` | Root/sudo cgroup read | `dast_empirical_peak_rss_mb` |
| **B4. Network TX / RX** | Exact bytes transmitted & received during scan | Container veth / iptables / `/proc/net/dev` byte counters | Network namespace access | `dast_empirical_egress_mb`, `dast_empirical_ingress_mb` |
| **B5. AI Token Telemetry** | Exact prompt & candidate token counts for risk assessment | Google GenAI SDK `response.usage_metadata` hook | Gemini API client logs | `dast_empirical_prompt_tokens`, `dast_empirical_candidate_tokens` |
| **B6. Scan Artifacts** | Disk footprint of logs, raw tool outputs, and report JSON | `os.stat` / `du -sb` on scan output directory | Local filesystem access | `dast_empirical_artifact_bytes` |

---

## 3. Category C: Layer 7 Stress Test Empirical Measurement

| Metric | Description | MEASUREMENT_METHOD | REQUIRED_ACCESS | OUTPUT_FIELD |
| :--- | :--- | :--- | :--- | :--- |
| **C1. Wall-Clock Duration** | Total load generation window | Monotonic start/stop timer delta | Orchestrator runner | `stress_empirical_duration_seconds` |
| **C2. Generator CPU Delta** | CPU consumption of async HTTP attack engine | Linux `getrusage(RUSAGE_CHILDREN)` / cgroup `cpu.stat` | Process supervisor | `stress_empirical_cpu_seconds` |
| **C3. Generator Peak RAM** | Peak memory of concurrent async worker pool | `ru_maxrss` / cgroup `memory.peak` | Process supervisor | `stress_empirical_peak_rss_mb` |
| **C4. Network TX / RX** | Exact bandwidth consumed by stress traffic | Socket layer byte counters / NIC packet metrics | Host network interface | `stress_empirical_egress_mb`, `stress_empirical_ingress_mb` |

---

## 4. Category D: AI Copilot & Automated Patch Empirical Telemetry

| Metric | Description | MEASUREMENT_METHOD | REQUIRED_ACCESS | OUTPUT_FIELD |
| :--- | :--- | :--- | :--- | :--- |
| **D1. Provider & Model** | Pinned LLM version serving requests | API config / response header verification | Backend env (`GEMINI_API_KEY`) | `ai_model_name` |
| **D2. Prompt Token Count** | Actual input tokens per chat turn and patch prompt | `response.usage_metadata.prompt_token_count` | LLM router wrapper | `copilot_empirical_prompt_tokens` |
| **D3. Output Token Count** | Actual candidate tokens generated per response | `response.usage_metadata.candidates_token_count` | LLM router wrapper | `copilot_empirical_candidate_tokens` |
| **D4. Cache Utilization** | Prompt caching hits/misses if applicable | `response.usage_metadata.cached_content_token_count` | GenAI SDK telemetry | `copilot_empirical_cached_tokens` |
| **D5. Interaction Frequency** | Empirical requests per active user session | Backend telemetry / request logger | Access log analytics | `copilot_empirical_requests_per_session` |

