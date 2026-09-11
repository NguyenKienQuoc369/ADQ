# ADQ Unit Economics & Cost Instrumentation Framework

## 1. Overview & Objective
This directory provides a reproducible unit economics and cost measurement architecture for **ADQ (Automated Dynamic & DAST Security Platform)**.

### Strict Evidence Hygiene Principles (Phase C1.1):
1. **MEASURED_FACT**: Metrics directly obtained through system profilers, kernel cgroups, network socket telemetry, or verified provider API usage metadata.
2. **SOURCE_CONFIG**: Hard boundaries defined in production source code (quotas, feature gates, listed model prices).
3. **USER_SUPPLIED_INPUT**: Infrastructure invoices, VPS plan costs, database pricing, or FX rates provided by operator configuration.
4. **ASSUMPTION / ESTIMATE**: Hypothetical scenarios or heuristic engineering estimates (e.g. hypothetical scan volumes, pre-telemetry token heuristics). Never presented as empirical evidence.
5. **DERIVED**: Mathematical outputs computed strictly from validated inputs. If inputs are unmeasured/null, output defaults to `null` / `N/A`.

---

## 2. Directory Structure

```
economics/
├── README.md                                 # Framework overview and classification rules
├── methodology.md                           # Measurement methodology (idle vs incremental resource profiling)
├── c2_measurement_checklist.md              # Empirical checklist for VPS & Telemetry data collection
├── config/
│   └── cost_inputs.example.json             # Configurable pricing template (defaults to null for unmeasured costs)
├── workloads/
│   ├── dast_workload.json                   # Standard DAST benchmark profile definition
│   ├── stress_workload.json                 # L7 Stress test tiered profiles (PRO vs PRO_MAX)
│   └── copilot_workload.json                # Copilot & AI Risk Assessment token workload profiles
└── analysis/
    ├── evidence_register.csv                # Classification register for every metric in the model
    ├── theoretical_tier_bounds.json         # Exact quota boundaries and unbounded exposure definitions
    └── unit_economics_formulas.py           # Formula calculation engine with strict null propagation
```

---

## 3. Product Model & Tier Source of Truth

| Tier | Listed Model Price (VND/month) | DAST Entitlement | L7 Stress Entitlement | AI Risk Assessment | AI Copilot Chat & Patch |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FREE** | 0 VNĐ | 2 lifetime scans | 0 (Locked) | Disabled (`skip_ai=True`) | Locked |
| **PRO** | 199.000 VNĐ | Unlimited scans (`UNBOUNDED_BY_PRODUCT_QUOTA`) | 1 test / day (max 2k reqs, 30s, 100 RPS) | Enabled (Gemini analysis) | Locked |
| **PRO_MAX** | 499.000 VNĐ | Unlimited scans (`UNBOUNDED_BY_PRODUCT_QUOTA`) | 10 tests / day (max 5k reqs, 60s, 250 RPS) | Enabled (Gemini analysis) | Full Access (`UNBOUNDED_BY_PRODUCT_QUOTA`) |

*Note: Listed prices are model pricing figures; license activation is redeem-code based without payment gateway.*

---

## 4. Usage Instructions

To run the unit economics calculation engine:
```bash
python3 economics/analysis/unit_economics_formulas.py
```
To validate workload and bound schemas:
```bash
python3 -c "import json; [json.load(open(f)) for f in ['economics/config/cost_inputs.example.json', 'economics/workloads/dast_workload.json', 'economics/workloads/stress_workload.json', 'economics/workloads/copilot_workload.json', 'economics/analysis/theoretical_tier_bounds.json']]; print('Schemas Validated!')"
```
