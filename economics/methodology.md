# ADQ Resource Measurement Methodology

## 1. Objective & Principles

To obtain empirical unit economics for ADQ security operations without synthetic distortions, resource measurement must isolate the **incremental marginal cost** of each operation from the **fixed baseline platform overhead**.

### Core Principles:
1. **Zero Production Mutation**: Measurement harness operates non-invasively without modifying scanner logic, detection rules, or core routing.
2. **Idle vs Incremental Decoupling**: Baseline daemon consumption (idle API server, idle Celery/Redis workers) is measured separately and subtracted from total job execution resource footprint.
3. **Multi-Vector Telemetry**: Every operation is measured across 4 physical resource dimensions:
   - **Compute**: CPU user-time, system-time, vCPU utilization percentage.
   - **Memory**: Peak Resident Set Size (Peak RSS in MB).
   - **Network**: Exact egress and ingress payload volume (KB/MB).
   - **AI Tokens**: Exact prompt tokens and candidate generation tokens via API telemetry.

---

## 2. Measurement Dimensions & Instrumentation

| Resource Dimension | Measurement Primitive | Metric Unit | Tool / Source |
| :--- | :--- | :--- | :--- |
| **Wall-Clock Duration** | Monotonic High-Res Timer | Seconds ($s$) | `time.perf_counter()` |
| **CPU Time** | `getrusage(RUSAGE_CHILDREN)` / `/proc/[pid]/stat` | User $s$ + System $s$ | Linux `cgroups` / `/usr/bin/time -v` |
| **Peak Memory** | `ru_maxrss` / `memory.peak` | Megabytes ($MB$) | Linux Kernel cgroup v2 / `psutil` |
| **Network Ingress/Egress**| Socket I/O / `/proc/net/dev` / iptables byte counters | Megabytes ($MB$) | Linux Network Namespace / cgroup net |
| **AI Token In/Out** | `usage_metadata` in Gemini API response | Tokens ($N_{prompt}, N_{cand}$) | `google-genai` SDK response hook |

---

## 3. Idle Baseline vs Incremental Delta Formula

Let $R_{total}$ be the total resource measurement during an operation window $[t_0, t_1]$ with duration $\Delta t = t_1 - t_0$.
Let $\bar{r}_{idle}$ be the average idle rate of the background worker daemon per second.

The true incremental marginal resource consumption $\Delta R_{op}$ is calculated as:
$$\Delta R_{op} = R_{total} - (\bar{r}_{idle} \times \Delta t)$$

### Peak Memory Rule:
Memory is accounted as the incremental peak footprint above the worker baseline:
$$\Delta \text{Mem}_{peak} = \max(0, \text{Peak RSS}_{job} - \text{Baseline RSS}_{worker})$$

---

## 4. AI Token Instrumentation Protocol

For operations involving LLM inference (DAST Risk Assessment, Copilot Chat, One-Click Patch Generation), token usage is captured directly from the provider's structured telemetry:
- **Prompt Token Count ($N_{prompt}$)**: Characters in context window + system instructions + masked finding payloads.
- **Candidate Token Count ($N_{output}$)**: Output response tokens containing structured risk explanations or git-compatible patches.
- **Cost Calculation**:
$$C_{ai} = \left(\frac{N_{prompt}}{1,000,000} \times P_{input}\right) + \left(\frac{N_{output}}{1,000,000} \times P_{output}\right)$$

---

## 5. Statistical Rigor

For each standardized workload:
1. Execute $N = 3$ consecutive test runs against the local pinned test environment.
2. Record `mean` ($\mu$), `standard deviation` ($\sigma$), and `maximum` ($\max$) for each metric.
3. Compute 95% confidence intervals to ensure billing and rate-limiting models are resilient against tail latency.

