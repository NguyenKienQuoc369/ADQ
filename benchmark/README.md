# ADQ DAST Accuracy Benchmark Suite

## 1. Overview & Methodology
This benchmark suite provides an independent, deterministic accuracy harness evaluating the ADQ Web/DAST vulnerability scanner against standardized vulnerable web applications.

### Key Evaluation Rules (Phase A2.1 / A3 Standards)
- **Positive Controls (Ground Truth)**: Real known vulnerabilities mapped by category, endpoint, and parameters.
- **Negative Controls (Ground Truth)**: Deterministic safe endpoints / services verified via source code analysis.
- **Three-Way Classification**:
  - `TRUE_POSITIVE` (TP): Correctly identified vulnerability matching positive ground truth.
  - `FALSE_POSITIVE` (FP): Finding incorrectly matching an explicit negative control.
  - `UNKNOWN` / `UNSCORABLE`: Finding outside positive/negative ground truth coverage. Does **NOT** penalize the precision denominator.
  - `FALSE_NEGATIVE` (FN): Positive ground truth vulnerability missed by the scanner.
- **Statistical Safety**: Undefined metrics (`TP + FP == 0` or `TP + FN == 0`) evaluate strictly to `null` / `N/A`.
- **Deduplication**: Multiple scanner alerts matching the same ground truth entry are counted once (`TRUE_POSITIVE` for first, `DUPLICATE_POSITIVE` for subsequent).

---

## 2. Pinned Benchmark Targets
| Target Application | Container Image & Pinned Tag | Exact Image Digest | Local Bound Address | Type |
| :--- | :--- | :--- | :--- | :--- |
| **OWASP Juice Shop** | `bkimminich/juice-shop:v17.1.1` | `sha256:9e437b456e444ff001d1663e4f6f05c796fe02f1058dd2651d6791a15b43dfeb` | `http://127.0.0.1:3000` | Modern SPA / Node.js API |
| **DVWA** | `vulnerables/web-dvwa:1.9` | `sha256:14c929ec1a99edb77326201f7f0fb431d1b3dd099c09ddeaf46312ab0ff53cfe` | `http://127.0.0.1:8081` | Classic PHP / MySQL Monolith |

---

## 3. Benchmark Execution Metadata
- **Execution Timestamp**: `2026-09-09T19:33:42Z`
- **ADQ Git Commit**: `a0b3618`
- **Runs per Target**: 3 repeated runs (`RUNS_PER_TARGET = 3`)
- **Total Executed Runs**: 6
- **Scanner Profile**: `ADQ_STANDARD_FULL_DAST` (`quoc_omni.py` engine + Nuclei v3.8.0 + FFuf v2.1.0 + HTTPX v1.9.0)

---

## 4. Benchmark Results Summary

### Micro Aggregate Metrics
- **Micro True Positives (TP)**: `12` (across 6 runs)
- **Micro False Positives (FP)**: `0`
- **Micro False Negatives (FN)**: `45`
- **Micro Precision**: `1.0000` (100.0%)
- **Micro Recall**: `0.2105` (21.05%)
- **Micro F1-Score**: `0.3478`
- **Severity Concordance Rate**: `0.5000` (50.0% exact severity match on TP)
- **Unique Unknown Findings**: `67` (unscorable outside ground truth coverage)
- **Failed Runs**: `0`

### Per-Target Results Matrix
| Target | Run | TP | FP | FN | UNKNOWN | Precision | Recall | F1 Score | Runtime (s) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **OWASP Juice Shop** | run-01 | 2 | 0 | 9 | 25 | 1.0000 | 0.1818 | 0.3077 | 196.76 |
| **OWASP Juice Shop** | run-02 | 2 | 0 | 9 | 25 | 1.0000 | 0.1818 | 0.3077 | 147.22 |
| **OWASP Juice Shop** | run-03 | 2 | 0 | 9 | 25 | 1.0000 | 0.1818 | 0.3077 | 181.34 |
| **DVWA** | run-01 | 2 | 0 | 6 | 62 | 1.0000 | 0.2500 | 0.4000 | 133.73 |
| **DVWA** | run-02 | 2 | 0 | 6 | 62 | 1.0000 | 0.2500 | 0.4000 | 133.20 |
| **DVWA** | run-03 | 2 | 0 | 6 | 62 | 1.0000 | 0.2500 | 0.4000 | 133.12 |

---

## 5. Artifact Index
- [`benchmark/results/final_summary.json`](benchmark/results/final_summary.json): Complete machine-readable results
- [`benchmark/results/final_matrix.csv`](benchmark/results/final_matrix.csv): Run-by-run matrix
- [`benchmark/results/category_summary.csv`](benchmark/results/category_summary.csv): Per-category detection metrics
- [`benchmark/results/unknown_findings.csv`](benchmark/results/unknown_findings.csv): Unscored findings outside baseline
- [`benchmark/results/runtime_summary.csv`](benchmark/results/runtime_summary.csv): Runtime min/median/max statistics

---

## 6. Key Findings & Limitations
1. **Zero False Positives**: Across all 6 runs, ADQ achieved **1.0 Precision** against deterministic negative controls.
2. **Deterministic Stability**: All repeated runs generated identical finding counts with 1.0 presence rate across runs.
3. **Blackbox Coverage Limitation**: Active parameterized deep injections (blind SQLi, stored XSS requiring multi-step authentication) were undetected in default fast blackbox recon mode without targeted logic fuzzing credentials enabled, representing the primary False Negative source.
