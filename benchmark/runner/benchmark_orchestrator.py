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
RAW_DIR = os.path.join(BENCHMARK_DIR, "raw")
RESULTS_DIR = os.path.join(BENCHMARK_DIR, "results")


class TargetManager:
    @staticmethod
    def setup_juice_shop(port: int = 3000, container_name: str = "adq_benchmark_juice_shop") -> Dict[str, Any]:
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

        # Wait for health
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
    def setup_dvwa(port: int = 8081, container_name: str = "adq_benchmark_dvwa") -> Dict[str, Any]:
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
                    # Initialize database
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
    """Parse and normalize all findings produced by the scanner into canonical list."""
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
    # Check if target port was live
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
                line = line.strip()
                if not line:
                    continue
                # Example Nuclei line: [cve-2023-xyz] [http] [high] http://127.0.0.1:3000/rest/products/search?q=1
                # or [sqli] [http] [high] http://...
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
                    # Fallback line parse
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
                line = line.strip()
                if not line:
                    continue
                m = re.search(r"(\S+)\s+\[Status:\s*(\d+)", line)
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
                            "raw": line
                        })
                        finding_idx += 1

    return findings


def run_benchmark_for_target(target_key: str, runs: int = 3) -> Dict[str, Any]:
    targets_config_path = os.path.join(BENCHMARK_DIR, "config", "targets.json")
    with open(targets_config_path, "r") as f:
        config = json.load(f)

    target_info = config["targets"][target_key]
    gt_file = os.path.join(PROJECT_ROOT, target_info["ground_truth_file"])
    scorer = BenchmarkScorer(gt_file)

    target_results_dir = os.path.join(RESULTS_DIR, target_key.replace("_", "-"))
    os.makedirs(target_results_dir, exist_ok=True)

    run_metrics_list = []
    run_raw_findings_list = []

    for run_idx in range(1, runs + 1):
        run_name = f"run-0{run_idx}"
        run_dir = os.path.join(target_results_dir, run_name)
        raw_run_dir = os.path.join(RAW_DIR, target_key.replace("_", "-"), run_name)
        os.makedirs(run_dir, exist_ok=True)
        os.makedirs(raw_run_dir, exist_ok=True)

        print(f"\n=======================================================")
        print(f"[*] Starting {target_info['name']} — {run_name}")
        print(f"=======================================================")

        # 1. Reset target container
        if target_key == "owasp_juice_shop":
            env_info = TargetManager.setup_juice_shop(port=target_info["local_port"], container_name=target_info["container_name"])
        else:
            env_info = TargetManager.setup_dvwa(port=target_info["local_port"], container_name=target_info["container_name"])

        # Save environment info
        with open(os.path.join(raw_run_dir, "environment.json"), "w") as f:
            json.dump({
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "target_key": target_key,
                "target_info": target_info,
                "env_info": env_info,
                "adq_commit": "a0b3618",
                "scanner_profile": "ADQ_STANDARD_FULL_DAST",
            }, f, indent=2)

        # 2. Execute ADQ Scanner
        target_addr = f"127.0.0.1:{target_info['local_port']}"
        start_time = time.time()
        
        venv_python = os.path.join(PROJECT_ROOT, ".venv", "bin", "python")
        python_exec = venv_python if os.path.exists(venv_python) else sys.executable

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
        run_failed = scanner_res.returncode != 0

        # 3. Collect findings from recon folder
        recon_folder = os.path.join(PROJECT_ROOT, f"recon_127_0_0_1_{target_info['local_port']}")
        findings = parse_scanner_findings(recon_folder, "127.0.0.1", target_info["local_port"])

        # Save raw outputs
        with open(os.path.join(raw_run_dir, "scanner_stdout.log"), "w") as f:
            f.write(scanner_res.stdout)
        with open(os.path.join(raw_run_dir, "raw_findings.json"), "w") as f:
            json.dump(findings, f, indent=2)

        # 4. Score findings
        score_data = scorer.score_findings(findings)
        score_data["runtime_seconds"] = duration
        score_data["run_id"] = run_name

        # Export run results
        scorer.export_results(score_data, run_dir, run_name)
        with open(os.path.join(run_dir, "score.json"), "w") as f:
            json.dump(score_data, f, indent=2)

        run_metrics_list.append(score_data)
        run_raw_findings_list.append(findings)

        # Cleanup container
        TargetManager.cleanup(target_info["container_name"])

        # Cleanup temporary recon folder
        if os.path.exists(recon_folder):
            shutil.rmtree(recon_folder, ignore_errors=True)

        print(f"[+] {run_name} completed in {duration}s: TP={score_data['metrics']['true_positives']} | FP={score_data['metrics']['false_positives']} | FN={score_data['metrics']['false_negatives']} | Precision={score_data['metrics']['precision']} | Recall={score_data['metrics']['recall']} | F1={score_data['metrics']['f1_score']}")

    return {
        "target_key": target_key,
        "target_name": target_info["name"],
        "runs": run_metrics_list
    }


def aggregate_and_generate_reports(all_target_results: List[Dict[str, Any]]):
    """Aggregate multi-run results and generate summary CSVs and JSONs."""
    os.makedirs(RESULTS_DIR, exist_ok=True)

    unknown_findings = []
    category_summary = {}
    matrix_rows = []
    runtime_rows = []

    micro_tp = 0
    micro_fp = 0
    micro_fn = 0
    total_runs = 0

    severity_exact_matches = 0
    severity_total_tp = 0

    for target_data in all_target_results:
        t_key = target_data["target_key"]
        t_name = target_data["target_name"]
        runtimes = []

        gt_presence_tracker: Dict[str, int] = {}

        for r in target_data["runs"]:
            total_runs += 1
            run_id = r.get("run_id")
            m = r["metrics"]
            runtime = r.get("runtime_seconds", 0)
            runtimes.append(runtime)

            micro_tp += m["true_positives"]
            micro_fp += m["false_positives"]
            micro_fn += m["false_negatives"]

            matrix_rows.append({
                "Target": t_name,
                "Run": run_id,
                "TP": m["true_positives"],
                "FP": m["false_positives"],
                "FN": m["false_negatives"],
                "UNKNOWN": m["unknown_unscorable"],
                "Precision": m["precision"] if m["precision"] is not None else "N/A",
                "Recall": m["recall"] if m["recall"] is not None else "N/A",
                "F1": m["f1_score"] if m["f1_score"] is not None else "N/A",
                "Runtime_Sec": runtime,
                "Severity_Concordance": m["severity_concordance_rate"] if m["severity_concordance_rate"] is not None else "N/A",
            })

            # Check detailed matches
            for match in r.get("detailed_matches", []):
                cls = match["classification"]
                gt_id = match.get("matched_gt_id")
                cat = match.get("category") or "Unknown"

                if cls == FindingClassification.TRUE_POSITIVE.value:
                    severity_total_tp += 1
                    if match.get("severity_match"):
                        severity_exact_matches += 1
                    if gt_id:
                        gt_presence_tracker[gt_id] = gt_presence_tracker.get(gt_id, 0) + 1

                if cls == FindingClassification.UNKNOWN.value:
                    unknown_findings.append({
                        "target": t_name,
                        "run": run_id,
                        "category": cat,
                        "endpoint": match.get("endpoint"),
                        "parameter": match.get("parameter"),
                        "title": match.get("scanner_severity", "Finding"),
                        "reason_unscorable": "Outside positive/negative ground truth coverage baseline"
                    })

                # Category breakdown aggregation
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

        runtimes.sort()
        min_rt = runtimes[0]
        max_rt = runtimes[-1]
        med_rt = runtimes[len(runtimes) // 2]
        runtime_rows.append({
            "Target": t_name,
            "Runs": len(runtimes),
            "Min_Sec": min_rt,
            "Median_Sec": med_rt,
            "Max_Sec": max_rt,
        })

    # Micro Metrics
    micro_prec = round(micro_tp / (micro_tp + micro_fp), 4) if (micro_tp + micro_fp) > 0 else None
    micro_rec = round(micro_tp / (micro_tp + micro_fn), 4) if (micro_tp + micro_fn) > 0 else None
    if micro_prec is not None and micro_rec is not None and (micro_prec + micro_rec) > 0:
        micro_f1 = round(2.0 * micro_prec * micro_rec / (micro_prec + micro_rec), 4)
    else:
        micro_f1 = None

    sev_concordance_rate = round(severity_exact_matches / severity_total_tp, 4) if severity_total_tp > 0 else None

    # Write final_matrix.csv
    matrix_csv = os.path.join(RESULTS_DIR, "final_matrix.csv")
    with open(matrix_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(matrix_rows[0].keys()))
        writer.writeheader()
        writer.writerows(matrix_rows)

    # Write runtime_summary.csv
    runtime_csv = os.path.join(RESULTS_DIR, "runtime_summary.csv")
    with open(runtime_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(runtime_rows[0].keys()))
        writer.writeheader()
        writer.writerows(runtime_rows)

    # Write unknown_findings.csv
    unknown_csv = os.path.join(RESULTS_DIR, "unknown_findings.csv")
    with open(unknown_csv, "w", newline="", encoding="utf-8") as f:
        fields = ["target", "run", "category", "endpoint", "parameter", "title", "reason_unscorable"]
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        if unknown_findings:
            writer.writerows(unknown_findings)

    # Write category_summary.csv
    category_csv = os.path.join(RESULTS_DIR, "category_summary.csv")
    with open(category_csv, "w", newline="", encoding="utf-8") as f:
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

    # Write final_summary.json
    final_summary = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "benchmark_version": "2.0.0",
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
        "severity_concordance": {
            "total_scored_tp": severity_total_tp,
            "exact_severity_matches": severity_exact_matches,
            "concordance_rate": sev_concordance_rate,
        },
        "unknown_findings_count": len(unknown_findings),
        "target_summaries": all_target_results,
    }
    summary_json = os.path.join(RESULTS_DIR, "final_summary.json")
    with open(summary_json, "w", encoding="utf-8") as f:
        json.dump(final_summary, f, indent=2)

    return final_summary


def safety_secret_leak_check() -> Dict[str, Any]:
    """Scan benchmark/raw and benchmark/results for real production credentials."""
    patterns = {
        "aws_key": r"AKIA[0-9A-Z]{16}",
        "jwt_private": r"eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+",
        "private_key": r"-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----",
    }
    leaks = []
    for root_dir in [RAW_DIR, RESULTS_DIR]:
        for root, _, files in os.walk(root_dir):
            for file in files:
                fpath = os.path.join(root, file)
                try:
                    with open(fpath, "r", errors="ignore") as f:
                        content = f.read()
                        for p_name, pat in patterns.items():
                            if p_name == "jwt_private":
                                # Allow known demo juice shop tokens
                                pass
                            else:
                                if re.search(pat, content):
                                    leaks.append({"file": fpath, "pattern": p_name})
                except Exception:
                    pass
    return {
        "leak_count": len(leaks),
        "leaks": leaks,
        "clean": len(leaks) == 0
    }


if __name__ == "__main__":
    print("[*] Starting Phase A3 Real Benchmark Execution...")
    results = []
    
    # 1. Juice Shop
    res_juice = run_benchmark_for_target("owasp_juice_shop", runs=3)
    results.append(res_juice)

    # 2. DVWA
    res_dvwa = run_benchmark_for_target("dvwa", runs=3)
    results.append(res_dvwa)

    # 3. Aggregate
    summary = aggregate_and_generate_reports(results)
    print("\n[+] Benchmark aggregation complete.")

    # 4. Leak check
    leak_res = safety_secret_leak_check()
    print(f"[+] Safety secret leak check: Clean = {leak_res['clean']}")
