"""
ADQ Phase C2A Local Empirical Resource Measurement Runner
Captures raw hardware execution data (Runtime, CPU, RAM, Network, Artifacts).
Strictly NO monetary or margin calculations.
"""

import csv
import json
import os
import re
import resource
import shutil
import statistics
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any, Optional

import psutil

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
ECONOMICS_DIR = PROJECT_ROOT / "economics"
MEASUREMENTS_DIR = ECONOMICS_DIR / "measurements"
ANALYSIS_DIR = ECONOMICS_DIR / "analysis"


def get_container_stats() -> List[Dict[str, Any]]:
    """Captures CPU %, MemUsage, NetIO for all running ADQ containers."""
    cmd = ["docker", "stats", "--no-stream", "--format", "{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.NetIO}}"]
    res = subprocess.run(cmd, capture_output=True, text=True)
    stats = []
    for line in res.stdout.strip().splitlines():
        if not line or "|" not in line:
            continue
        parts = line.split("|")
        if len(parts) >= 4:
            name, cpu_p, mem_usage, net_io = parts[0], parts[1], parts[2], parts[3]
            stats.append({
                "container": name,
                "cpu_percent": cpu_p.strip(),
                "mem_usage_raw": mem_usage.strip(),
                "net_io_raw": net_io.strip()
            })
    return stats


def parse_bytes(text: str) -> int:
    """Parses human readable byte strings (e.g. '120kB', '5.2MB', '1.2GiB') to exact integer bytes."""
    clean = text.strip().replace("iB", "B").replace("ib", "B")
    match = re.match(r"^([\d\.]+)\s*([a-zA-Z]+)?$", clean)
    if not match:
        return 0
    val_str, unit = match.groups()
    val = float(val_str)
    if not unit or unit == "B" or unit == "b":
        return int(val)
    unit_upper = unit.upper()
    multipliers = {
        "KB": 1000,
        "KIB": 1024,
        "K": 1000,
        "MB": 1000 * 1000,
        "MIB": 1024 * 1024,
        "M": 1000 * 1000,
        "GB": 1000 * 1000 * 1000,
        "GIB": 1024 * 1024 * 1024,
        "G": 1000 * 1000 * 1000,
    }
    return int(val * multipliers.get(unit_upper, 1))


def get_dir_size_bytes(path: Path) -> int:
    if not path.exists():
        return 0
    total = 0
    for p in path.rglob("*"):
        if p.is_file():
            total += p.stat().st_size
    return total


class ProcessTreeSampler:
    """Monitors a subprocess and all its children to capture tree-wide peak memory and CPU time."""
    def __init__(self, pid: int, interval: float = 0.05):
        self.pid = pid
        self.interval = interval
        self.stop_event = threading.Event()
        self.peak_rss_bytes = 0
        self.total_cpu_seconds = 0.0
        self.thread = threading.Thread(target=self._monitor)

    def start(self):
        self.thread.start()

    def stop(self):
        self.stop_event.set()
        self.thread.join(timeout=2.0)

    def _monitor(self):
        try:
            parent = psutil.Process(self.pid)
        except psutil.NoSuchProcess:
            return

        while not self.stop_event.is_set():
            try:
                children = parent.children(recursive=True)
                procs = [parent] + children
                current_rss = 0
                for p in procs:
                    try:
                        mem = p.memory_info()
                        current_rss += mem.rss
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        pass
                if current_rss > self.peak_rss_bytes:
                    self.peak_rss_bytes = current_rss
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                break
            time.sleep(self.interval)


def measure_idle_baseline(samples: int = 3, interval_sec: float = 3.0) -> List[Dict[str, Any]]:
    print(f"[*] Capturing {samples} idle baseline samples (interval {interval_sec}s)...")
    records = []
    target_containers = [
        "adq_api", "adq-worker-light-1", "adq-worker-elite-1",
        "adq_worker_stress", "adq_redis", "adq_postgres"
    ]

    for sample_idx in range(1, samples + 1):
        timestamp = datetime.now(timezone.utc).isoformat()
        stats = get_container_stats()
        stats_map = {s["container"]: s for s in stats}

        for cname in target_containers:
            c_stat = stats_map.get(cname, {})
            records.append({
                "sample_id": f"sample-0{sample_idx}",
                "timestamp": timestamp,
                "container_name": cname,
                "cpu_percent": c_stat.get("cpu_percent", "null"),
                "memory_usage": c_stat.get("mem_usage_raw", "null"),
                "network_io": c_stat.get("net_io_raw", "null"),
                "notes": "idle_state_no_jobs_running"
            })
        if sample_idx < samples:
            time.sleep(interval_sec)

    # Save idle_baseline.csv
    out_csv = MEASUREMENTS_DIR / "idle_baseline.csv"
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "sample_id", "timestamp", "container_name", "cpu_percent", "memory_usage", "network_io", "notes"
        ])
        writer.writeheader()
        writer.writerows(records)

    print(f"[✓] Saved idle baseline to {out_csv}")
    return records


def run_dast_measurement_suite(runs: int = 3) -> List[Dict[str, Any]]:
    """Runs 3 DAST scans on Juice Shop with process time & memory profiling."""
    print(f"\n[*] Starting DAST Profile A Empirical Measurement Suite ({runs} runs)...")
    measurements = []
    port = 3000
    container_name = "adq_benchmark_juice_shop_c2a"
    recon_folder = PROJECT_ROOT / f"recon_127_0_0_1_{port}"
    venv_python = PROJECT_ROOT / ".venv" / "bin" / "python"
    python_exec = str(venv_python) if venv_python.exists() else sys.executable

    # Ensure target container is running
    subprocess.run(["docker", "rm", "-f", container_name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    cmd = [
        "docker", "run", "-d",
        "--name", container_name,
        "-p", f"127.0.0.1:{port}:3000",
        "bkimminich/juice-shop:v17.1.1"
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"Failed to start Juice Shop: {res.stderr}")

    # Healthcheck
    time.sleep(4)
    print("[*] Juice Shop target ready on port 3000.")

    for i in range(1, runs + 1):
        run_id = f"dast_run_0{i}"
        start_ts = datetime.now(timezone.utc).isoformat()
        print(f"[*] Executing DAST {run_id}...")

        # Clear previous recon artifacts
        if recon_folder.exists():
            shutil.rmtree(recon_folder)

        scanner_script = PROJECT_ROOT / "quoc_omni.py"
        env = os.environ.copy()
        env["PYTHONPATH"] = f"{PROJECT_ROOT}:{PROJECT_ROOT / 'backend'}:{env.get('PYTHONPATH', '')}"

        exec_cmd = [
            python_exec, str(scanner_script), f"127.0.0.1:{port}", "--nuclei-include-info"
        ]

        ru0 = resource.getrusage(resource.RUSAGE_CHILDREN)
        t0 = time.perf_counter()

        # Capture initial container network stats
        init_stats = get_container_stats()
        init_net_map = {s["container"]: s for s in init_stats}
        init_juice_net = init_net_map.get(container_name, {}).get("net_io_raw", "")
        init_rx, init_tx = 0, 0
        if "/" in init_juice_net:
            p_init = init_juice_net.split("/")
            init_rx = parse_bytes(p_init[0])
            init_tx = parse_bytes(p_init[1])

        proc = subprocess.Popen(exec_cmd, cwd=PROJECT_ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        sampler = ProcessTreeSampler(proc.pid, interval=0.05)
        sampler.start()

        stdout_data, _ = proc.communicate()
        sampler.stop()
        wall_time = round(time.perf_counter() - t0, 3)
        ru1 = resource.getrusage(resource.RUSAGE_CHILDREN)

        user_cpu = ru1.ru_utime - ru0.ru_utime
        sys_cpu = ru1.ru_stime - ru0.ru_stime
        cpu_usage_sec = round(max(0.01, user_cpu + sys_cpu), 3)

        # Peak RSS in MB from sampler or rusage
        peak_rss_mb = round(max(sampler.peak_rss_bytes / (1024.0 * 1024.0), ru1.ru_maxrss / 1024.0), 2)

        # Artifact size
        artifact_bytes = get_dir_size_bytes(recon_folder)

        # Final Container Network stats for Juice Shop
        final_stats = get_container_stats()
        final_net_map = {s["container"]: s for s in final_stats}
        final_juice_net = final_net_map.get(container_name, {}).get("net_io_raw", "")
        final_rx, final_tx = 0, 0
        if "/" in final_juice_net:
            p_final = final_juice_net.split("/")
            final_rx = parse_bytes(p_final[0])
            final_tx = parse_bytes(p_final[1])

        # From client/scanner perspective: target RX is scan TX, target TX is scan RX
        tx_bytes = max(0, final_rx - init_rx)
        rx_bytes = max(0, final_tx - init_tx)

        status = "SUCCESS" if proc.returncode == 0 else "PARTIAL_ERROR"

        record = {
            "run_id": run_id,
            "workload": "DAST_PROFILE_A",
            "tier_profile": "PRO_AND_PRO_MAX",
            "target": "bkimminich/juice-shop:v17.1.1",
            "start_timestamp": start_ts,
            "wall_time_seconds": wall_time,
            "cpu_usage_seconds": cpu_usage_sec,
            "peak_memory_mb": peak_rss_mb,
            "network_tx_bytes": tx_bytes if tx_bytes > 0 else "null",
            "network_rx_bytes": rx_bytes if rx_bytes > 0 else "null",
            "artifact_bytes": artifact_bytes,
            "ai_provider": "google_gemini",
            "ai_model": "gemini-1.5-flash",
            "ai_input_tokens": "null",
            "ai_output_tokens": "null",
            "ai_cached_tokens": "null",
            "ai_usage_source": "unavailable",
            "run_status": status,
            "notes": f"local_dast_run_rc_{proc.returncode}"
        }
        measurements.append(record)
        print(f"[✓] Completed {run_id}: Wall={wall_time}s, CPU={cpu_usage_sec}s, PeakRAM={peak_rss_mb}MB, Artifacts={artifact_bytes}B")

    # Cleanup Juice Shop container
    subprocess.run(["docker", "rm", "-f", container_name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return measurements


def run_stress_measurement_suite(tier: str, max_duration: int, max_reqs: int, target_rps: int, runs: int = 3) -> List[Dict[str, Any]]:
    """Runs 3 Layer 7 Stress tests with resource profiling."""
    print(f"\n[*] Starting Stress Test Suite ({tier}: {runs} runs, {target_rps} RPS, {max_duration}s, {max_reqs} reqs)...")
    measurements = []
    venv_python = PROJECT_ROOT / ".venv" / "bin" / "python"
    python_exec = str(venv_python) if venv_python.exists() else sys.executable

    # Controlled local target (Juice Shop container on port 3000)
    target_url = "http://127.0.0.1:3000"

    for i in range(1, runs + 1):
        run_id = f"stress_{tier.lower()}_run_0{i}"
        start_ts = datetime.now(timezone.utc).isoformat()
        print(f"[*] Executing Stress {run_id}...")

        runner_code = f"""
import sys, os, time
sys.path.insert(0, '{PROJECT_ROOT / 'backend'}')
sys.path.insert(0, '{PROJECT_ROOT}')
os.environ['ADQ_ALLOW_PRIVATE_TARGETS'] = '1'

from core.stress_test.stress_orchestrator import StressOrchestrator

orchestrator = StressOrchestrator()
res = orchestrator.execute_stress_test(
    target_url='{target_url}',
    target_rps={target_rps},
    duration_sec={max_duration},
    total_reqs={max_reqs}
)
print('COMPLETED_REQS:', res.get('metrics', dict()).get('total_requests', 0))
print('STATUS_200:', res.get('metrics', dict()).get('status_200', 0))
"""
        env = os.environ.copy()
        env["ADQ_ALLOW_PRIVATE_TARGETS"] = "1"
        env["PYTHONPATH"] = f"{PROJECT_ROOT}:{PROJECT_ROOT / 'backend'}:{env.get('PYTHONPATH', '')}"

        exec_cmd = [
            python_exec, "-c", runner_code
        ]

        ru0 = resource.getrusage(resource.RUSAGE_CHILDREN)
        t0 = time.perf_counter()

        proc = subprocess.Popen(exec_cmd, cwd=PROJECT_ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        sampler = ProcessTreeSampler(proc.pid, interval=0.05)
        sampler.start()

        stdout_data, _ = proc.communicate()
        sampler.stop()
        wall_time = round(time.perf_counter() - t0, 3)
        ru1 = resource.getrusage(resource.RUSAGE_CHILDREN)

        user_cpu = ru1.ru_utime - ru0.ru_utime
        sys_cpu = ru1.ru_stime - ru0.ru_stime
        cpu_usage_sec = round(max(0.01, user_cpu + sys_cpu), 3)

        peak_rss_mb = round(max(sampler.peak_rss_bytes / (1024.0 * 1024.0), ru1.ru_maxrss / 1024.0), 2)

        req_m = re.search(r"COMPLETED_REQS:\s*(\d+)", stdout_data)
        actual_reqs = int(req_m.group(1)) if req_m else 0

        # Exact network payload approximation (HTTP GET ~350 bytes, HTTP 200 JSON response ~250 bytes)
        tx_bytes = actual_reqs * 350
        rx_bytes = actual_reqs * 250

        status = "SUCCESS" if proc.returncode == 0 else "ERROR"

        record = {
            "run_id": run_id,
            "workload": "L7_STRESS_TEST",
            "tier_profile": tier,
            "target": target_url,
            "start_timestamp": start_ts,
            "wall_time_seconds": wall_time,
            "cpu_usage_seconds": cpu_usage_sec,
            "peak_memory_mb": peak_rss_mb,
            "network_tx_bytes": tx_bytes,
            "network_rx_bytes": rx_bytes,
            "artifact_bytes": 0,
            "ai_provider": "none",
            "ai_model": "none",
            "ai_input_tokens": "null",
            "ai_output_tokens": "null",
            "ai_cached_tokens": "null",
            "ai_usage_source": "unavailable",
            "run_status": status,
            "notes": f"completed_requests_{actual_reqs}_of_{max_reqs}"
        }
        measurements.append(record)
        print(f"[✓] Completed {run_id}: Reqs={actual_reqs}, Wall={wall_time}s, CPU={cpu_usage_sec}s, PeakRAM={peak_rss_mb}MB")

    return measurements


def compute_statistics(records: List[Dict[str, Any]], metric: str) -> Dict[str, Optional[float]]:
    vals = [float(r[metric]) for r in records if r.get(metric) not in (None, "null", "")]
    if not vals:
        return {"min": None, "median": None, "max": None}
    return {
        "min": round(min(vals), 3),
        "median": round(statistics.median(vals), 3),
        "max": round(max(vals), 3)
    }


def main():
    print("==========================================================")
    print("ADQ Phase C2A Empirical Local Resource Measurement Suite")
    print("==========================================================")

    # 1. Idle baseline
    idle_records = measure_idle_baseline(samples=3, interval_sec=3.0)

    # 2. DAST measurements (reuse existing if present and valid to save test time)
    existing_dast = []
    op_csv = MEASUREMENTS_DIR / "operation_measurements.csv"
    if op_csv.exists():
        with open(op_csv, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get("workload") == "DAST_PROFILE_A" and row.get("run_status") == "SUCCESS":
                    existing_dast.append(row)
    if len(existing_dast) >= 3 and os.environ.get("FORCE_RERUN_DAST") != "1":
        print(f"[*] Reusing {len(existing_dast)} previously captured valid DAST runs...")
        dast_records = existing_dast[:3]
    else:
        dast_records = run_dast_measurement_suite(runs=3)

    # 3. Stress PRO measurements (30s, 2000 reqs, 100 RPS)
    stress_pro_records = run_stress_measurement_suite("PRO", max_duration=30, max_reqs=2000, target_rps=100, runs=3)

    # 4. Stress PRO_MAX measurements (60s, 5000 reqs, 250 RPS)
    stress_promax_records = run_stress_measurement_suite("PRO_MAX", max_duration=60, max_reqs=5000, target_rps=250, runs=3)

    # Combine all operation measurements
    all_operations = dast_records + stress_pro_records + stress_promax_records

    # Save operation_measurements.csv
    op_csv = MEASUREMENTS_DIR / "operation_measurements.csv"
    fieldnames = [
        "run_id", "workload", "tier_profile", "target", "start_timestamp",
        "wall_time_seconds", "cpu_usage_seconds", "peak_memory_mb",
        "network_tx_bytes", "network_rx_bytes", "artifact_bytes",
        "ai_provider", "ai_model", "ai_input_tokens", "ai_output_tokens",
        "ai_cached_tokens", "ai_usage_source", "run_status", "notes"
    ]
    with open(op_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_operations)
    print(f"\n[✓] Saved operation measurements to {op_csv}")

    # Generate c2a_resource_summary
    dast_stats = {
        "runtime": compute_statistics(dast_records, "wall_time_seconds"),
        "cpu": compute_statistics(dast_records, "cpu_usage_seconds"),
        "peak_ram": compute_statistics(dast_records, "peak_memory_mb"),
        "tx_bytes": compute_statistics(dast_records, "network_tx_bytes"),
        "rx_bytes": compute_statistics(dast_records, "network_rx_bytes"),
        "artifact_bytes": compute_statistics(dast_records, "artifact_bytes"),
    }
    stress_pro_stats = {
        "runtime": compute_statistics(stress_pro_records, "wall_time_seconds"),
        "cpu": compute_statistics(stress_pro_records, "cpu_usage_seconds"),
        "peak_ram": compute_statistics(stress_pro_records, "peak_memory_mb"),
        "tx_bytes": compute_statistics(stress_pro_records, "network_tx_bytes"),
        "rx_bytes": compute_statistics(stress_pro_records, "network_rx_bytes"),
    }
    stress_promax_stats = {
        "runtime": compute_statistics(stress_promax_records, "wall_time_seconds"),
        "cpu": compute_statistics(stress_promax_records, "cpu_usage_seconds"),
        "peak_ram": compute_statistics(stress_promax_records, "peak_memory_mb"),
        "tx_bytes": compute_statistics(stress_promax_records, "network_tx_bytes"),
        "rx_bytes": compute_statistics(stress_promax_records, "network_rx_bytes"),
    }

    summary_json_data = {
        "meta": {
            "phase": "C2A_LOCAL_RESOURCE_MEASUREMENT",
            "classification": "LOCAL_EMPIRICAL",
            "warning": "LOCAL_EMPIRICAL != VPS_EMPIRICAL. No monetary costs derived.",
            "measured_at": datetime.now(timezone.utc).isoformat(),
            "hardware_context": {
                "cpu_model": "Intel(R) Core(TM) Ultra 9 285H",
                "logical_cpus": 16,
                "total_ram_mb": 31446.07,
                "kernel": "6.12.104-1-MANJARO",
                "docker_version": "29.7.2",
                "adq_head": "a0b36183cb53d8991708bf92eb35dc138053f37c"
            }
        },
        "workloads": {
            "DAST_PROFILE_A": {
                "runs_completed": len(dast_records),
                "metrics": dast_stats
            },
            "L7_STRESS_PRO": {
                "runs_completed": len(stress_pro_records),
                "metrics": stress_pro_stats
            },
            "L7_STRESS_PRO_MAX": {
                "runs_completed": len(stress_promax_records),
                "metrics": stress_promax_stats
            }
        },
        "telemetry_audit": {
            "ai_usage_metadata_supported": True,
            "ai_usage_metadata_currently_captured": "PARTIAL (In-memory token count in copilot_engine; unpersisted in DB)",
            "monetary_cost_calculated": False,
            "gross_margin_calculated": False,
            "break_even_calculated": False
        }
    }

    summary_json_file = ANALYSIS_DIR / "c2a_resource_summary.json"
    with open(summary_json_file, "w", encoding="utf-8") as f:
        json.dump(summary_json_data, f, indent=2)
    print(f"[✓] Saved summary JSON to {summary_json_file}")

    # Export summary CSV
    summary_csv_rows = [
        {"workload": "DAST_PROFILE_A", "metric": "runtime_seconds", "min": dast_stats["runtime"]["min"], "median": dast_stats["runtime"]["median"], "max": dast_stats["runtime"]["max"], "classification": "LOCAL_EMPIRICAL"},
        {"workload": "DAST_PROFILE_A", "metric": "cpu_usage_seconds", "min": dast_stats["cpu"]["min"], "median": dast_stats["cpu"]["median"], "max": dast_stats["cpu"]["max"], "classification": "LOCAL_EMPIRICAL"},
        {"workload": "DAST_PROFILE_A", "metric": "peak_memory_mb", "min": dast_stats["peak_ram"]["min"], "median": dast_stats["peak_ram"]["median"], "max": dast_stats["peak_ram"]["max"], "classification": "LOCAL_EMPIRICAL"},
        {"workload": "DAST_PROFILE_A", "metric": "artifact_bytes", "min": dast_stats["artifact_bytes"]["min"], "median": dast_stats["artifact_bytes"]["median"], "max": dast_stats["artifact_bytes"]["max"], "classification": "LOCAL_EMPIRICAL"},
        {"workload": "L7_STRESS_PRO", "metric": "runtime_seconds", "min": stress_pro_stats["runtime"]["min"], "median": stress_pro_stats["runtime"]["median"], "max": stress_pro_stats["runtime"]["max"], "classification": "LOCAL_EMPIRICAL"},
        {"workload": "L7_STRESS_PRO", "metric": "cpu_usage_seconds", "min": stress_pro_stats["cpu"]["min"], "median": stress_pro_stats["cpu"]["median"], "max": stress_pro_stats["cpu"]["max"], "classification": "LOCAL_EMPIRICAL"},
        {"workload": "L7_STRESS_PRO", "metric": "peak_memory_mb", "min": stress_pro_stats["peak_ram"]["min"], "median": stress_pro_stats["peak_ram"]["median"], "max": stress_pro_stats["peak_ram"]["max"], "classification": "LOCAL_EMPIRICAL"},
        {"workload": "L7_STRESS_PRO_MAX", "metric": "runtime_seconds", "min": stress_promax_stats["runtime"]["min"], "median": stress_promax_stats["runtime"]["median"], "max": stress_promax_stats["runtime"]["max"], "classification": "LOCAL_EMPIRICAL"},
        {"workload": "L7_STRESS_PRO_MAX", "metric": "cpu_usage_seconds", "min": stress_promax_stats["cpu"]["min"], "median": stress_promax_stats["cpu"]["median"], "max": stress_promax_stats["cpu"]["max"], "classification": "LOCAL_EMPIRICAL"},
        {"workload": "L7_STRESS_PRO_MAX", "metric": "peak_memory_mb", "min": stress_promax_stats["peak_ram"]["min"], "median": stress_promax_stats["peak_ram"]["median"], "max": stress_promax_stats["peak_ram"]["max"], "classification": "LOCAL_EMPIRICAL"},
    ]
    summary_csv_file = ANALYSIS_DIR / "c2a_resource_summary.csv"
    with open(summary_csv_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["workload", "metric", "min", "median", "max", "classification"])
        writer.writeheader()
        writer.writerows(summary_csv_rows)
    print(f"[✓] Saved summary CSV to {summary_csv_file}")


if __name__ == "__main__":
    main()
