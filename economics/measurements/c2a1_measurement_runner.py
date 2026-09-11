#!/usr/bin/env python3
"""
ADQ Phase C2A.1 — Local Measurement Runner with Strict Per-Run Deltas.
Preserves original C2A artifacts and outputs strictly to C2A.1 files.
"""

import sys
import os
import time
import json
import csv
import re
import shutil
import subprocess
import statistics
import threading
import resource
import psutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
MEASUREMENTS_DIR = PROJECT_ROOT / "economics" / "measurements"
ANALYSIS_DIR = PROJECT_ROOT / "economics" / "analysis"


def parse_bytes(text: str) -> int:
    """Parses human readable byte strings (e.g. '120kB', '5.2MB', '1.2GiB') to exact integer bytes."""
    clean = text.strip().replace("iB", "B").replace("ib", "B")
    match = re.match(r"^([\d\.]+)\s*([a-zA-Z]+)?$", clean)
    if not match:
        return 0
    val_str, unit = match.groups()
    val = float(val_str)
    if not unit or unit in ("B", "b"):
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


def get_container_net_io(container_name: str) -> Tuple[int, int]:
    """Returns (rx_bytes, tx_bytes) from docker stats for a given container."""
    res = subprocess.run(
        ["docker", "stats", "--no-stream", "--format", "{{.Name}}|{{.NetIO}}"],
        capture_output=True, text=True, check=False
    )
    for line in res.stdout.strip().splitlines():
        if not line or "|" not in line:
            continue
        parts = line.split("|")
        if parts[0].strip() == container_name:
            net_str = parts[1].strip()
            if "/" in net_str:
                p = net_str.split("/")
                return parse_bytes(p[0]), parse_bytes(p[1])
    return 0, 0


def get_dir_size_bytes(path: Path) -> int:
    if not path.exists():
        return 0
    total = 0
    for p in path.rglob("*"):
        if p.is_file():
            total += p.stat().st_size
    return total


class ProcessTreeSampler:
    """Monitors a subprocess and all its children to capture tree-wide peak memory RSS."""
    def __init__(self, pid: int, interval: float = 0.05):
        self.pid = pid
        self.interval = interval
        self.stop_event = threading.Event()
        self.peak_rss_bytes = 0
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


def run_dast_suite(runs: int = 3) -> List[Dict[str, Any]]:
    print(f"\n[*] Starting C2A.1 DAST Measurement Suite ({runs} runs)...")
    measurements = []
    container_name = "juice-shop-c2a1"
    port = 3001
    recon_folder = PROJECT_ROOT / f"recon_127.0.0.1_{port}"

    venv_python = PROJECT_ROOT / ".venv" / "bin" / "python"
    python_exec = str(venv_python) if venv_python.exists() else sys.executable

    # Ensure fresh container
    subprocess.run(["docker", "rm", "-f", container_name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    run_res = subprocess.run([
        "docker", "run", "-d", "--name", container_name,
        "-p", f"{port}:3000",
        "bkimminich/juice-shop:v17.1.1"
    ], capture_output=True, text=True)
    if run_res.returncode != 0:
        raise RuntimeError(f"Failed to start container: {run_res.stderr}")

    time.sleep(5)
    print(f"[*] Target container {container_name} running on port {port}.")

    for i in range(1, runs + 1):
        run_id = f"c2a1_dast_run_0{i}"
        start_ts = datetime.now(timezone.utc).isoformat()
        print(f"[*] Executing DAST {run_id}...")

        if recon_folder.exists():
            shutil.rmtree(recon_folder)

        scanner_script = PROJECT_ROOT / "quoc_omni.py"
        env = os.environ.copy()
        env["PYTHONPATH"] = f"{PROJECT_ROOT}:{PROJECT_ROOT / 'backend'}:{env.get('PYTHONPATH', '')}"

        exec_cmd = [
            python_exec, str(scanner_script), f"127.0.0.1:{port}", "--nuclei-include-info"
        ]

        # 1. Capture BEFORE network counter
        before_rx, before_tx = get_container_net_io(container_name)

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
        artifact_bytes = get_dir_size_bytes(recon_folder)

        # 2. Capture AFTER network counter
        after_rx, after_tx = get_container_net_io(container_name)

        # Scanner TX = target container RX delta; Scanner RX = target container TX delta
        delta_tx = max(0, after_rx - before_rx)
        delta_rx = max(0, after_tx - before_tx)

        status = "SUCCESS" if proc.returncode == 0 else "ERROR"

        record = {
            "run_id": run_id,
            "workload": "DAST_PROFILE_A",
            "tier_profile": "PRO_AND_PRO_MAX",
            "target": "bkimminich/juice-shop:v17.1.1",
            "start_timestamp": start_ts,
            "wall_time_seconds": wall_time,
            "cpu_usage_seconds": cpu_usage_sec,
            "peak_memory_mb": peak_rss_mb,
            "net_tx_before": before_rx,
            "net_tx_after": after_rx,
            "network_tx_bytes": delta_tx,
            "net_rx_before": before_tx,
            "net_rx_after": after_tx,
            "network_rx_bytes": delta_rx,
            "artifact_bytes": artifact_bytes,
            "ai_provider": "google_gemini",
            "ai_model": "gemini-1.5-flash",
            "ai_input_tokens": "null",
            "ai_output_tokens": "null",
            "ai_cached_tokens": "null",
            "ai_usage_source": "unavailable",
            "run_status": status,
            "notes": f"strict_delta_before_{before_rx}_{before_tx}_after_{after_rx}_{after_tx}"
        }
        measurements.append(record)
        print(f"[✓] {run_id}: Wall={wall_time}s, CPU={cpu_usage_sec}s, PeakRAM={peak_rss_mb}MB, DeltaTX={delta_tx}B, DeltaRX={delta_rx}B")

    subprocess.run(["docker", "rm", "-f", container_name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return measurements


def run_stress_suite(tier: str, max_duration: int, max_reqs: int, target_rps: int, runs: int = 3) -> List[Dict[str, Any]]:
    print(f"\n[*] Starting C2A.1 Stress Suite ({tier}: {runs} runs, {target_rps} RPS, {max_duration}s, {max_reqs} reqs)...")
    measurements = []
    container_name = "juice-shop-c2a1-stress"
    port = 3002
    target_url = f"http://127.0.0.1:{port}"

    venv_python = PROJECT_ROOT / ".venv" / "bin" / "python"
    python_exec = str(venv_python) if venv_python.exists() else sys.executable

    subprocess.run(["docker", "rm", "-f", container_name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    subprocess.run([
        "docker", "run", "-d", "--name", container_name,
        "-p", f"{port}:3000",
        "bkimminich/juice-shop:v17.1.1"
    ], capture_output=True, text=True)
    time.sleep(5)

    for i in range(1, runs + 1):
        run_id = f"c2a1_stress_{tier.lower()}_run_0{i}"
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
        env["PYTHONPATH"] = f"{PROJECT_ROOT / 'backend'}:{PROJECT_ROOT}:{env.get('PYTHONPATH', '')}"

        exec_cmd = [python_exec, "-c", runner_code]

        # 1. Capture BEFORE network counter
        before_rx, before_tx = get_container_net_io(container_name)

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

        # 2. Capture AFTER network counter
        after_rx, after_tx = get_container_net_io(container_name)

        delta_tx = max(0, after_rx - before_rx)
        delta_rx = max(0, after_tx - before_tx)

        req_m = re.search(r"COMPLETED_REQS:\s*(\d+)", stdout_data)
        actual_reqs = int(req_m.group(1)) if req_m else 0

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
            "net_tx_before": before_rx,
            "net_tx_after": after_rx,
            "network_tx_bytes": delta_tx,
            "net_rx_before": before_tx,
            "net_rx_after": after_tx,
            "network_rx_bytes": delta_rx,
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
        print(f"[✓] {run_id}: Reqs={actual_reqs}, Wall={wall_time}s, CPU={cpu_usage_sec}s, PeakRAM={peak_rss_mb}MB, DeltaTX={delta_tx}B, DeltaRX={delta_rx}B")

    subprocess.run(["docker", "rm", "-f", container_name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
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
    print("ADQ Phase C2A.1 Integrity Audit Measurement Runner")
    print("==========================================================")

    # 1. Run DAST suite with strict per-run deltas
    dast_records = run_dast_suite(runs=3)

    # 2. Run Stress PRO suite
    stress_pro_records = run_stress_suite("PRO", max_duration=30, max_reqs=2000, target_rps=100, runs=3)

    # 3. Run Stress PRO_MAX suite
    stress_promax_records = run_stress_suite("PRO_MAX", max_duration=60, max_reqs=5000, target_rps=250, runs=3)

    all_operations = dast_records + stress_pro_records + stress_promax_records

    # Save c2a1_operation_measurements.csv
    op_csv = MEASUREMENTS_DIR / "c2a1_operation_measurements.csv"
    fieldnames = [
        "run_id", "workload", "tier_profile", "target", "start_timestamp",
        "wall_time_seconds", "cpu_usage_seconds", "peak_memory_mb",
        "net_tx_before", "net_tx_after", "network_tx_bytes",
        "net_rx_before", "net_rx_after", "network_rx_bytes",
        "artifact_bytes", "ai_provider", "ai_model",
        "ai_input_tokens", "ai_output_tokens", "ai_cached_tokens",
        "ai_usage_source", "run_status", "notes"
    ]
    with open(op_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_operations)
    print(f"\n[✓] Saved C2A.1 operation measurements to {op_csv}")

    # Compute Statistics
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
            "phase": "C2A.1_LOCAL_MEASUREMENT_INTEGRITY_AUDIT",
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

    summary_json_file = ANALYSIS_DIR / "c2a1_resource_summary.json"
    with open(summary_json_file, "w", encoding="utf-8") as f:
        json.dump(summary_json_data, f, indent=2)
    print(f"[✓] Saved C2A.1 summary JSON to {summary_json_file}")

    # Export summary CSV
    summary_csv_rows = [
        {"workload": "DAST_PROFILE_A", "metric": "runtime_seconds", "min": dast_stats["runtime"]["min"], "median": dast_stats["runtime"]["median"], "max": dast_stats["runtime"]["max"], "classification": "LOCAL_EMPIRICAL"},
        {"workload": "DAST_PROFILE_A", "metric": "cpu_usage_seconds", "min": dast_stats["cpu"]["min"], "median": dast_stats["cpu"]["median"], "max": dast_stats["cpu"]["max"], "classification": "LOCAL_EMPIRICAL"},
        {"workload": "DAST_PROFILE_A", "metric": "peak_memory_mb", "min": dast_stats["peak_ram"]["min"], "median": dast_stats["peak_ram"]["median"], "max": dast_stats["peak_ram"]["max"], "classification": "LOCAL_EMPIRICAL"},
        {"workload": "DAST_PROFILE_A", "metric": "network_tx_bytes", "min": dast_stats["tx_bytes"]["min"], "median": dast_stats["tx_bytes"]["median"], "max": dast_stats["tx_bytes"]["max"], "classification": "LOCAL_EMPIRICAL"},
        {"workload": "DAST_PROFILE_A", "metric": "network_rx_bytes", "min": dast_stats["rx_bytes"]["min"], "median": dast_stats["rx_bytes"]["median"], "max": dast_stats["rx_bytes"]["max"], "classification": "LOCAL_EMPIRICAL"},
        {"workload": "DAST_PROFILE_A", "metric": "artifact_bytes", "min": dast_stats["artifact_bytes"]["min"], "median": dast_stats["artifact_bytes"]["median"], "max": dast_stats["artifact_bytes"]["max"], "classification": "LOCAL_EMPIRICAL"},
        {"workload": "L7_STRESS_PRO", "metric": "runtime_seconds", "min": stress_pro_stats["runtime"]["min"], "median": stress_pro_stats["runtime"]["median"], "max": stress_pro_stats["runtime"]["max"], "classification": "LOCAL_EMPIRICAL"},
        {"workload": "L7_STRESS_PRO", "metric": "cpu_usage_seconds", "min": stress_pro_stats["cpu"]["min"], "median": stress_pro_stats["cpu"]["median"], "max": stress_pro_stats["cpu"]["max"], "classification": "LOCAL_EMPIRICAL"},
        {"workload": "L7_STRESS_PRO", "metric": "peak_memory_mb", "min": stress_pro_stats["peak_ram"]["min"], "median": stress_pro_stats["peak_ram"]["median"], "max": stress_pro_stats["peak_ram"]["max"], "classification": "LOCAL_EMPIRICAL"},
        {"workload": "L7_STRESS_PRO", "metric": "network_tx_bytes", "min": stress_pro_stats["tx_bytes"]["min"], "median": stress_pro_stats["tx_bytes"]["median"], "max": stress_pro_stats["tx_bytes"]["max"], "classification": "LOCAL_EMPIRICAL"},
        {"workload": "L7_STRESS_PRO", "metric": "network_rx_bytes", "min": stress_pro_stats["rx_bytes"]["min"], "median": stress_pro_stats["rx_bytes"]["median"], "max": stress_pro_stats["rx_bytes"]["max"], "classification": "LOCAL_EMPIRICAL"},
        {"workload": "L7_STRESS_PRO_MAX", "metric": "runtime_seconds", "min": stress_promax_stats["runtime"]["min"], "median": stress_promax_stats["runtime"]["median"], "max": stress_promax_stats["runtime"]["max"], "classification": "LOCAL_EMPIRICAL"},
        {"workload": "L7_STRESS_PRO_MAX", "metric": "cpu_usage_seconds", "min": stress_promax_stats["cpu"]["min"], "median": stress_promax_stats["cpu"]["median"], "max": stress_promax_stats["cpu"]["max"], "classification": "LOCAL_EMPIRICAL"},
        {"workload": "L7_STRESS_PRO_MAX", "metric": "peak_memory_mb", "min": stress_promax_stats["peak_ram"]["min"], "median": stress_promax_stats["peak_ram"]["median"], "max": stress_promax_stats["peak_ram"]["max"], "classification": "LOCAL_EMPIRICAL"},
        {"workload": "L7_STRESS_PRO_MAX", "metric": "network_tx_bytes", "min": stress_promax_stats["tx_bytes"]["min"], "median": stress_promax_stats["tx_bytes"]["median"], "max": stress_promax_stats["tx_bytes"]["max"], "classification": "LOCAL_EMPIRICAL"},
        {"workload": "L7_STRESS_PRO_MAX", "metric": "network_rx_bytes", "min": stress_promax_stats["rx_bytes"]["min"], "median": stress_promax_stats["rx_bytes"]["median"], "max": stress_promax_stats["rx_bytes"]["max"], "classification": "LOCAL_EMPIRICAL"},
    ]
    summary_csv_file = ANALYSIS_DIR / "c2a1_resource_summary.csv"
    with open(summary_csv_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["workload", "metric", "min", "median", "max", "classification"])
        writer.writeheader()
        writer.writerows(summary_csv_rows)
    print(f"[✓] Saved C2A.1 summary CSV to {summary_csv_file}")


if __name__ == "__main__":
    main()
