# ADQ Phase C2B.1 — Financial Claim Hygiene & Economic Evidence Boundaries

## 1. Objective and Policy
Phase C2B.1 establishes strict separation between:
1. **Measured Empirical Engineering Facts** (Wall time, CPU-seconds, Peak RSS, Network bytes, Request throughput).
2. **User-Supplied Fixed Infrastructure Rates** (Hourly VPS invoice rate).
3. **Modelled Resource Attributions** (Mathematical allocation of fixed hosting rates across measured CPU-seconds).
4. **Unmeasured Financial Claims** (Full business break-even, all-in marginal costs, AI API variable costs, final gross margins).

Under no circumstances may a mathematical resource attribution model be presented as an actual invoice charge or provider-billed cost per operation.

---

## 2. Infrastructure Billing vs Resource Attribution

### A. Actual Provider Fixed Hosting Cost
- **Rate**: `1,790 VND / hour` (`USER_SUPPLIED_BILLING_INPUT`).
- **Billing Nature**: The VPS provider bills based on **wall-clock uptime hours**, regardless of whether the server is 100% busy or 0% idle.
- **Modelled Full-Month Continuous Uptime Cost**:
  - 30-day month (720 hours): $720 \times 1,790\text{ VND} = \mathbf{1,288,800\text{ VND / month}}$.
  - 31-day month (744 hours): $744 \times 1,790\text{ VND} = \mathbf{1,331,760\text{ VND / month}}$.
- **Local Supporting Services**: PostgreSQL and Redis run locally inside Docker containers on the same VPS instance (`EXTERNAL_POSTGRES_COST = 0`, `EXTERNAL_REDIS_COST = 0`).

### B. Modelled Resource Attribution Model
Because the provider does not bill per CPU-second or per scan, the per-operation figures are **modelled resource allocations**:
$$\text{Cost per vCPU-Second} = \frac{1,790\text{ VND / hr}}{3,600\text{ s} \times 4\text{ vCPUs}} \approx 0.1243\text{ VND / vCPU-s}$$
$$\text{Modelled Resource Attribution} = \text{Measured CPU-seconds} \times 0.1243\text{ VND / vCPU-s}$$

| Workload | Measured Median CPU-s | **Modelled Resource Attribution** | Reclassification Status |
| :--- | :--- | :--- | :--- |
| **DAST Profile-A** | `39.249 s` | **`4.88 VND`** | `MODELLED_RESOURCE_ATTRIBUTION_VND` (Not direct provider bill) |
| **L7 Stress PRO** | `4.201 s` | **`0.52 VND`** | `MODELLED_RESOURCE_ATTRIBUTION_VND` (Not direct provider bill) |
| **L7 Stress PRO_MAX** | `8.780 s` | **`1.09 VND`** | `MODELLED_RESOURCE_ATTRIBUTION_VND` (Not direct provider bill) |

- `ACTUAL_PROVIDER_COST_PER_OPERATION = NOT_DIRECTLY_OBSERVABLE`
- `RESOURCE_ATTRIBUTION_MODEL_AVAILABLE = YES`

---

## 3. Break-Even Classification
The calculated ratio between fixed hosting and listed product prices ($199,000$ VND for PRO, $499,000$ VND for PRO_MAX):
- `PRO Tier`: $\lceil 1,288,800 / 199,000 \rceil = \mathbf{7\text{ subscribers}}$
- `PRO_MAX Tier`: $\lceil 1,288,800 / 499,000 \rceil = \mathbf{3\text{ subscribers}}$

**Strict Label**: `FIXED_HOSTING_ONLY_BREAK_EVEN`.
This is **NOT** a full business break-even because it excludes:
1. LLM / AI token API billing
2. Payment gateway / transaction fees
3. Domain registration & DNS renewal
4. External backups and offsite snapshot storage
5. Operational engineering and customer support
6. Corporate tax and accounting overhead

---

## 4. AI Cost Gap & Margin Status
- `AI_COST_DATA_AVAILABLE = NO`
- `FULL_VARIABLE_COST_PER_DAST = UNKNOWN`
- `FULL_VARIABLE_COST_PER_COPILOT = UNKNOWN`
- `FULL_GROSS_MARGIN = UNKNOWN`
- `FULL_BUSINESS_BREAK_EVEN = UNKNOWN`

---

## 5. Competition-Safe Evidence Register

### A. Supported Facts
- VPS Hardware: 4 vCPUs Intel Xeon Gold 5117 @ 2.00GHz, 3,910 MB RAM, 50 GB Disk on Ubuntu 26.04 LTS.
- Actual VPS billing rate is 1,790 VND/hour (`USER_SUPPLIED_BILLING_INPUT`).
- At continuous 30-day uptime (720h), modelled server hosting cost is 1,288,800 VND/month.
- Empirical DAST Profile-A consumed median 39.249 CPU-seconds on the measured VPS.
- Empirical Stress PRO consumed median 4.201 CPU-seconds with 2000 completed requests.
- Empirical Stress PRO_MAX consumed median 8.780 CPU-seconds with 4980 completed requests (duration/rate-scheduler bound).
- Fixed-hosting-only break-even is 7 PRO or 3 PRO_MAX subscriptions (excluding secondary expenses).

### B. Unsupported / Disallowed Claims
- Claiming 4.88 VND is the "true all-in cost" of a DAST scan.
- Claiming a final corporate gross margin percentage.
- Claiming full business break-even at 7 subscribers.
- Claiming measured AI token economics without provider billing invoices.
