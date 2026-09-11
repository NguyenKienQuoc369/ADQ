"""
ADQ Benchmark Orchestrator for Phase A5 (Real Profile-A Rerun)
"""
import csv
import json
import os
import re
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import requests

from benchmark.runner.normalizer import normalize_category, normalize_endpoint, normalize_parameter
from benchmark.runner.matcher import BenchmarkMatcher, FindingClassification, MatchResult
from benchmark.runner.metrics import calculate_metrics, BenchmarkMetrics
from benchmark.runner.scorer import BenchmarkScorer

BENCHMARK_DIR = os.path.join(PROJECT_ROOT, "benchmark")
RAW_A5_DIR = os.path.join(BENCHMARK_DIR, "raw", "a5-profile-a")
RESULTS_A5_DIR = os.path.join(BENCHMARK_DIR, "results", "a5-profile-a")


class TargetManager:
    @staticmethod
    def setup_juice_shop(port: int = 3000, container_name: str = "adq_benchmark_juice_shop_a5") -> Dict[str, Any]:
        subprocess.run(["docker", "rm", "-f", container_name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        cmd = [
            "docker", "run", "-d",
            "--name", container_name,
            "-p", f"127.0.0.1:{port}:3000",
            "bkimminich/juice-shop:v17.1.1"
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if res.returncode != 0:
            raise RuntimeError(f"Failed to start Juice Shop container: {res.stderr}")

        base_url = f"http://127.0.0.1:{port}"
        health_url = f"{base_url}/rest/admin/application-version"
        start_wait = time.time()
        healthy = False
        while time.time() - start_wait < 60:
            try:
                r = requests.get(health_url, timeout=2)
                if r.status_code == 200 and "version" in r.text:
                    healthy = True
                    break
            except Exception:
                pass
            time.sleep(1)

        if not healthy:
            raise RuntimeError("Juice Shop container failed healthcheck after 60s")

        return {
            "target": "OWASP Juice Shop",
            "version": "v17.1.1",
            "base_url": base_url,
            "container_id": res.stdout.strip(),
            "port": port
        }

    @staticmethod
    def setup_dvwa(port: int = 8081, container_name: str = "adq_benchmark_dvwa_a5") -> Dict[str, Any]:
        subprocess.run(["docker", "rm", "-f", container_name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        cmd = [
            "docker", "run", "-d",
            "--name", container_name,
            "-p", f"127.0.0.1:{port}:80",
            "vulnerables/web-dvwa:1.9"
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if res.returncode != 0:
            raise RuntimeError(f"Failed to start DVWA container: {res.stderr}")

        base_url = f"http://127.0.0.1:{port}"
        setup_url = f"{base_url}/setup.php"
        start_wait = time.time()
        healthy = False
        session = requests.Session()

        while time.time() - start_wait < 60:
            try:
                r = session.get(setup_url, timeout=2)
                if r.status_code == 200 and "Damn Vulnerable Web Application" in r.text:
                    token_match = re.search(r"name='user_token' value='([a-f0-9]+)'", r.text)
                    if token_match:
                        token = token_match.group(1)
                        db_res = session.post(
                            setup_url,
                            data={"create_db": "Create / Reset Database", "user_token": token},
                            timeout=5
                        )
                        if db_res.status_code == 200:
                            healthy = True
                            break
            except Exception:
                pass
            time.sleep(1)

        if not healthy:
            raise RuntimeError("DVWA container failed healthcheck/setup after 60s")

        return {
            "target": "Damn Vulnerable Web Application (DVWA)",
            "version": "1.9",
            "base_url": base_url,
            "container_id": res.stdout.strip(),
            "port": port
        }

    @staticmethod
    def cleanup(container_name: str):
        subprocess.run(["docker", "rm", "-f", container_name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def parse_scanner_findings(recon_folder: str, target_host: str, port: int) -> List[Dict[str, Any]]:
    findings: List[Dict[str, Any]] = []
    finding_idx = 1

    # 1. Open Ports
    ports_file = os.path.join(recon_folder, "open_ports.txt")
    if os.path.exists(ports_file):
        with open(ports_file, "r") as f:
            for line in f:
                line = line.strip()
                if line:
                    p = line.split(":")[-1] if ":" in line else line
                    findings.append({
                        "id": f"finding-{finding_idx}",
                        "category": "Open Service",
                        "host": "127.0.0.1",
                        "port": int(p) if p.isdigit() else p,
                        "severity": "INFO",
                        "raw": line
                    })
                    finding_idx += 1

    live_file = os.path.join(recon_folder, "live_sites.txt")
    if os.path.exists(live_file):
        findings.append({
            "id": f"finding-{finding_idx}",
            "category": "Open Service",
            "host": "127.0.0.1",
            "port": port,
            "severity": "INFO",
            "raw": f"127.0.0.1:{port}"
        })
        finding_idx += 1

    # 2. Nuclei findings
    vuln_file = os.path.join(recon_folder, "nuclei_results.txt")
    if os.path.exists(vuln_file):
        with open(vuln_file, "r") as f:
            for line in f:
                line = re.sub(r"\x1b\[[0-9;]*m", "", line).strip()
                if not line:
                    continue
                m = re.search(r"\[(.*?)\]\s*\[(.*?)\]\s*\[(.*?)\]\s*(https?://[^\s]+)", line)
                if m:
                    t_id, proto, sev, url = m.groups()
                    cat = "Security Misconfiguration"
                    t_lower = t_id.lower()
                    if "sqli" in t_lower or "sql-injection" in t_lower:
                        cat = "SQL Injection"
                    elif "xss" in t_lower:
                        cat = "Cross-Site Scripting"
                    elif "cve-" in t_lower:
                        cat = "Known CVE"
                    elif "secret" in t_lower or "token" in t_lower:
                        cat = "Exposed Secrets"
                    elif "exec" in t_lower or "cmdi" in t_lower or "command-injection" in t_lower:
                        cat = "Command Injection"
                    elif "lfi" in t_lower or "traversal" in t_lower:
                        cat = "Local File Inclusion"
                    elif "swagger" in t_lower or "openapi" in t_lower or "prometheus" in t_lower or "metrics" in t_lower:
                        cat = "Sensitive Endpoint Exposure"

                    param = None
                    if "?" in url:
                        q = url.split("?")[1]
                        params = [p.split("=")[0] for p in q.split("&") if "=" in p]
                        param = params[0] if params else None

                    findings.append({
                        "id": f"finding-{finding_idx}",
                        "category": cat,
                        "cve_id": t_id if "cve-" in t_lower else None,
                        "endpoint": url,
                        "parameter": param,
                        "severity": sev.upper(),
                        "raw": line
                    })
                    finding_idx += 1
                else:
                    findings.append({
                        "id": f"finding-{finding_idx}",
                        "category": "Security Misconfiguration",
                        "endpoint": line,
                        "severity": "LOW",
                        "raw": line
                    })
                    finding_idx += 1

    # 3. Dynamic scan & response header / exposed paths
    result_json_file = os.path.join(recon_folder, "result.json")
    if os.path.exists(result_json_file):
        try:
            with open(result_json_file, "r") as f:
                rdata = json.load(f)
                v_obj = rdata.get("vulnerabilities", {})
                for k, vlist in v_obj.items():
                    if isinstance(vlist, list):
                        for item in vlist:
                            if isinstance(item, dict):
                                findings.append({
                                    "id": f"finding-{finding_idx}",
                                    "category": normalize_category(item.get("title") or item.get("category") or k),
                                    "endpoint": item.get("endpoint") or item.get("raw"),
                                    "parameter": item.get("parameter"),
                                    "severity": (item.get("severity") or "LOW").upper(),
                                    "raw": json.dumps(item)
                                })
                                finding_idx += 1
        except Exception:
            pass

    # 4. FFuf findings
    ffuf_file = os.path.join(recon_folder, "ffuf_main.txt")
    if os.path.exists(ffuf_file):
        with open(ffuf_file, "r") as f:
            for line in f:
                clean_line = re.sub(r"\x1b\[[0-9;]*m", "", line).strip()
                if not clean_line:
                    continue
                m = re.search(r"(\S+)\s+\[Status:\s*(\d+)", clean_line)
                if m:
                    path_or_url, status = m.groups()
                    if status in ("200", "301", "302", "403"):
                        ep = path_or_url if path_or_url.startswith("http") else f"http://127.0.0.1:{port}/{path_or_url.lstrip('/')}"
                        cat = "Sensitive Endpoint Exposure"
                        if "ftp" in ep.lower():
                            cat = "Security Misconfiguration"
                        findings.append({
                            "id": f"finding-{finding_idx}",
                            "category": cat,
                            "endpoint": ep,
                            "parameter": None,
                            "severity": "LOW",
                            "raw": clean_line
                        })
                        finding_idx += 1

    return findings


def run_a5_benchmark(runs: int = 3) -> Dict[str, Any]:
    targets = [
        {
            "key": "owasp_juice_shop",
            "name": "OWASP Juice Shop",
            "port": 3000,
            "container_name": "adq_benchmark_juice_shop_a5",
            "gt_file": os.path.join(BENCHMARK_DIR, "ground_truth", "owasp_juice_shop_v17_profile_a.json"),
        },
        {
            "key": "dvwa",
            "name": "Damn Vulnerable Web Application (DVWA)",
            "port": 8081,
            "container_name": "adq_benchmark_dvwa_a5",
            "gt_file": os.path.join(BENCHMARK_DIR, "ground_truth", "dvwa_v1.9_profile_a.json"),
        }
    ]

    all_target_results = []
    matrix_rows = []
    runtime_rows = []
    unknown_findings = []
    category_summary = {}

    micro_tp = 0
    micro_fp = 0
    micro_fn = 0
    total_runs = 0

    venv_python = os.path.join(PROJECT_ROOT, ".venv", "bin", "python")
    python_exec = venv_python if os.path.exists(venv_python) else sys.executable

    for t in targets:
        scorer = BenchmarkScorer(t["gt_file"])
        t_dir = os.path.join(RESULTS_A5_DIR, t["key"].replace("_", "-"))
        raw_t_dir = os.path.join(RAW_A5_DIR, t["key"].replace("_", "-"))
        os.makedirs(t_dir, exist_ok=True)
        os.makedirs(raw_t_dir, exist_ok=True)

        target_runs = []

        for run_idx in range(1, runs + 1):
            run_name = f"run-0{run_idx}"
            run_res_dir = os.path.join(t_dir, run_name)
            run_raw_dir = os.path.join(raw_t_dir, run_name)
            os.makedirs(run_res_dir, exist_ok=True)
            os.makedirs(run_raw_dir, exist_ok=True)

            print(f"\n=======================================================")
            print(f"[*] Starting Phase A5: {t['name']} — {run_name}")
            print(f"=======================================================")

            # Setup container
            if t["key"] == "owasp_juice_shop":
                env_info = TargetManager.setup_juice_shop(port=t["port"], container_name=t["container_name"])
            else:
                env_info = TargetManager.setup_dvwa(port=t["port"], container_name=t["container_name"])

            with open(os.path.join(run_raw_dir, "environment.json"), "w") as f:
                json.dump({
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "target_key": t["key"],
                    "env_info": env_info,
                    "adq_commit": "a0b3618",
                    "scanner_profile": "PROFILE_A_UNAUTHENTICATED_BLACKBOX",
                }, f, indent=2)

            # Run scanner
            target_addr = f"127.0.0.1:{t['port']}"
            start_time = time.time()
            scanner_cmd = [
                python_exec,
                os.path.join(PROJECT_ROOT, "quoc_omni.py"),
                target_addr,
                "--nuclei-include-info"
            ]
            env = os.environ.copy()
            env["PYTHONPATH"] = f"{PROJECT_ROOT}:{os.path.join(PROJECT_ROOT, 'backend')}:{env.get('PYTHONPATH', '')}"

            scanner_res = subprocess.run(
                scanner_cmd,
                cwd=PROJECT_ROOT,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True
            )
            duration = round(time.time() - start_time, 2)

            # Parse findings
            recon_folder = os.path.join(PROJECT_ROOT, f"recon_127_0_0_1_{t['port']}")
            findings = parse_scanner_findings(recon_folder, "127.0.0.1", t["port"])

            # Save raw files
            with open(os.path.join(run_raw_dir, "scanner_stdout.log"), "w") as f:
                f.write(scanner_res.stdout)
            with open(os.path.join(run_raw_dir, "raw_findings.json"), "w") as f:
                json.dump(findings, f, indent=2)

            # Score findings
            score_data = scorer.score_findings(findings)
            score_data["runtime_seconds"] = duration
            score_data["run_id"] = run_name

            scorer.export_results(score_data, run_res_dir, run_name)
            with open(os.path.join(run_res_dir, "score.json"), "w") as f:
                json.dump(score_data, f, indent=2)

            target_runs.append(score_data)
            total_runs += 1

            m = score_data["metrics"]
            micro_tp += m["true_positives"]
            micro_fp += m["false_positives"]
            micro_fn += m["false_negatives"]

            matrix_rows.append({
                "Target": t["name"],
                "Run": run_name,
                "TP": m["true_positives"],
                "FP": m["false_positives"],
                "FN": m["false_negatives"],
                "UNKNOWN": m["unknown_unscorable"],
                "Precision": m["precision"] if m["precision"] is not None else "N/A",
                "Recall": m["recall"] if m["recall"] is not None else "N/A",
                "F1": m["f1_score"] if m["f1_score"] is not None else "N/A",
                "Runtime_Sec": duration,
                "Severity_Concordance": m["severity_concordance_rate"] if m["severity_concordance_rate"] is not None else "N/A",
            })

            # Check detailed matches
            for match in score_data.get("detailed_matches", []):
                cls = match["classification"]
                cat = match.get("category") or "Unknown"

                if cls == FindingClassification.UNKNOWN.value:
                    unknown_findings.append({
                        "target": t["name"],
                        "run": run_name,
                        "category": cat,
                        "endpoint": match.get("endpoint"),
                        "parameter": match.get("parameter"),
                        "title": match.get("scanner_severity", "Finding"),
                        "reason_unscorable": "Outside Profile-A ground truth coverage baseline"
                    })

                if cat not in category_summary:
                    category_summary[cat] = {"TP": 0, "FP": 0, "FN": 0, "UNKNOWN": 0}
                if cls == FindingClassification.TRUE_POSITIVE.value:
                    category_summary[cat]["TP"] += 1
                elif cls == FindingClassification.FALSE_POSITIVE.value:
                    category_summary[cat]["FP"] += 1
                elif cls == FindingClassification.FALSE_NEGATIVE.value:
                    category_summary[cat]["FN"] += 1
                elif cls == FindingClassification.UNKNOWN.value:
                    category_summary[cat]["UNKNOWN"] += 1

            # Cleanup
            TargetManager.cleanup(t["container_name"])
            if os.path.exists(recon_folder):
                shutil.rmtree(recon_folder, ignore_errors=True)

            print(f"[+] A5 {t['name']} {run_name} completed in {duration}s: TP={m['true_positives']} | FP={m['false_positives']} | FN={m['false_negatives']} | Precision={m['precision']} | Recall={m['recall']} | F1={m['f1_score']}")

        runtimes = [r["runtime_seconds"] for r in target_runs]
        runtimes.sort()
        runtime_rows.append({
            "Target": t["name"],
            "Runs": len(runtimes),
            "Min_Sec": runtimes[0],
            "Median_Sec": runtimes[len(runtimes) // 2],
            "Max_Sec": runtimes[-1],
        })

        all_target_results.append({
            "target_key": t["key"],
            "target_name": t["name"],
            "runs": target_runs
        })

    # Micro Metrics
    micro_prec = round(micro_tp / (micro_tp + micro_fp), 4) if (micro_tp + micro_fp) > 0 else None
    micro_rec = round(micro_tp / (micro_tp + micro_fn), 4) if (micro_tp + micro_fn) > 0 else None
    if micro_prec is not None and micro_rec is not None and (micro_prec + micro_rec) > 0:
        micro_f1 = round(2.0 * micro_prec * micro_rec / (micro_prec + micro_rec), 4)
    else:
        micro_f1 = None

    # Write files
    os.makedirs(RESULTS_A5_DIR, exist_ok=True)

    with open(os.path.join(RESULTS_A5_DIR, "final_matrix.csv"), "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(matrix_rows[0].keys()))
        writer.writeheader()
        writer.writerows(matrix_rows)

    with open(os.path.join(RESULTS_A5_DIR, "runtime_summary.csv"), "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(runtime_rows[0].keys()))
        writer.writeheader()
        writer.writerows(runtime_rows)

    with open(os.path.join(RESULTS_A5_DIR, "unknown_findings.csv"), "w", newline="", encoding="utf-8") as f:
        fields = ["target", "run", "category", "endpoint", "parameter", "title", "reason_unscorable"]
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        if unknown_findings:
            writer.writerows(unknown_findings)

    with open(os.path.join(RESULTS_A5_DIR, "category_summary.csv"), "w", newline="", encoding="utf-8") as f:
        fields = ["Category", "TP", "FP", "FN", "UNKNOWN", "Precision", "Recall"]
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for cat, counts in sorted(category_summary.items()):
            tp = counts["TP"]
            fp = counts["FP"]
            fn = counts["FN"]
            p = round(tp / (tp + fp), 4) if (tp + fp) > 0 else "N/A"
            r = round(tp / (tp + fn), 4) if (tp + fn) > 0 else "N/A"
            writer.writerow({
                "Category": cat,
                "TP": tp,
                "FP": fp,
                "FN": fn,
                "UNKNOWN": counts["UNKNOWN"],
                "Precision": p,
                "Recall": r,
            })

    # A3 vs A4 vs A5 Comparison Table
    comparison_rows = [
        {
            "Phase": "A3_ORIGINAL",
            "Scope": "Broad (19 GT controls)",
            "Precision": 1.0000,
            "Recall": 0.2105,
            "F1": 0.3478,
            "Notes": "Original baseline run with hardcoded FFuf https scheme bug"
        },
        {
            "Phase": "A4_REINTERPRETATION",
            "Scope": "Profile A (12 GT controls)",
            "Precision": 1.0000,
            "Recall": 0.5000,
            "F1": 0.6667,
            "Notes": "Mathematical reinterpretation of A3 raw evidence without FFuf fix credit"
        },
        {
            "Phase": "A5_REAL_RERUN",
            "Scope": "Profile A (12 GT controls)",
            "Precision": micro_prec,
            "Recall": micro_rec,
            "F1": micro_f1,
            "Notes": "New real run with Scope Matrix + Matcher correction + FFuf bugfix"
        }
    ]
    with open(os.path.join(RESULTS_A5_DIR, "a3_a4_a5_comparison.csv"), "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["Phase", "Scope", "Precision", "Recall", "F1", "Notes"])
        writer.writeheader()
        writer.writerows(comparison_rows)

    final_summary = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "benchmark_version": "2.0.0",
        "benchmark_profile": "PROFILE_A_UNAUTHENTICATED_BLACKBOX",
        "adq_commit": "a0b3618",
        "total_runs": total_runs,
        "micro_metrics": {
            "micro_tp": micro_tp,
            "micro_fp": micro_fp,
            "micro_fn": micro_fn,
            "micro_precision": micro_prec,
            "micro_recall": micro_rec,
            "micro_f1": micro_f1,
        },
        "target_summaries": all_target_results,
    }
    with open(os.path.join(RESULTS_A5_DIR, "final_summary.json"), "w", encoding="utf-8") as f:
        json.dump(final_summary, f, indent=2)

    return final_summary


if __name__ == "__main__":
    print("[*] Starting Phase A5 Real Profile-A Rerun...")
    summary = run_a5_benchmark(runs=3)
    print("\n[+] Phase A5 benchmark rerun complete.")

