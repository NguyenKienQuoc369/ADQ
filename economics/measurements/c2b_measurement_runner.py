#!/usr/bin/env python3
"""
ADQ Phase C2B — Japan VPS Empirical Resource Measurement Runner.
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
VENV_PYTHON = PROJECT_ROOT / ".venv" / "bin" / "python"
PYTHON_EXEC = str(VENV_PYTHON) if VENV_PYTHON.exists() else sys.executable

TARGET_CONTAINERS = [
    "adq_api",
    "adq-worker-light-1",
    "adq-worker-elite-1",
    "adq_worker_stress",
    "adq_redis",
    "adq_postgres"
]


def parse_bytes(text: str) -> int:
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


# ==============================================================================
# 1. Idle Baselines
# ==============================================================================

def get_container_pids() -> Dict[str, int]:
    c_pids = {}
    for name in TARGET_CONTAINERS:
        res = subprocess.run(["docker", "inspect", name], capture_output=True, text=True)
        if res.returncode == 0:
            info = json.loads(res.stdout)[0]
            c_pids[name] = info["State"]["Pid"]
    return c_pids


def sample_container_state(pids: Dict[str, int]) -> Dict[str, Dict[str, Any]]:
    state = {}
    for name, pid in pids.items():
        try:
            parent = psutil.Process(pid)
            all_procs = [parent] + parent.children(recursive=True)
            cpu_sec = sum(p.cpu_times().user + p.cpu_times().system for p in all_procs)
            rss_bytes = sum(p.memory_info().rss for p in all_procs)

            rx, tx = 0, 0
            net_path = Path(f"/proc/{pid}/net/dev")
            if net_path.exists():
                with open(net_path, "r", encoding="utf-8") as f:
                    for line in f:
                        if "eth0:" in line:
                            parts = line.split()
                            rx = int(parts[1])
                            tx = int(parts[9])
            state[name] = {
                "cpu_seconds": cpu_sec,
                "rss_bytes": rss_bytes,
                "rss_mb": round(rss_bytes / (1024.0 * 1024.0), 2),
                "net_rx_bytes": rx,
                "net_tx_bytes": tx
            }
        except Exception as e:
            state[name] = {"error": str(e)}
    return state


def run_idle_baseline_suite(interval_sec: int = 10, samples: int = 3):
    print(f"\n[*] Capturing VPS Idle Baselines ({samples} intervals of {interval_sec}s)...")
    pids = get_container_pids()

    cpu_baseline_records = []
    net_baseline_records = []
    mem_baseline_records = []

    for s_idx in range(1, samples + 1):
        sample_id = f"c2b_idle_interval_0{s_idx}"
        ts_start = datetime.now(timezone.utc).isoformat()
        state_t0 = sample_container_state(pids)

        for cname, data in state_t0.items():
            if "error" not in data:
                mem_baseline_records.append({
                    "sample_id": sample_id,
                    "timestamp": ts_start,
                    "container_name": cname,
                    "memory_rss_bytes": data["rss_bytes"],
                    "memory_rss_mb": data["rss_mb"],
                    "metric_type": "IDLE_MEMORY_SNAPSHOT"
                })

        time.sleep(interval_sec)
        ts_end = datetime.now(timezone.utc).isoformat()
        state_t1 = sample_container_state(pids)

        for cname in TARGET_CONTAINERS:
            d0 = state_t0.get(cname, {})
            d1 = state_t1.get(cname, {})
            if "error" in d0 or "error" in d1:
                continue

            cpu_delta = round(d1["cpu_seconds"] - d0["cpu_seconds"], 4)
            rx_delta = d1["net_rx_bytes"] - d0["net_rx_bytes"]
            tx_delta = d1["net_tx_bytes"] - d0["net_tx_bytes"]

            cpu_baseline_records.append({
                "sample_id": sample_id,
                "start_timestamp": ts_start,
                "end_timestamp": ts_end,
                "interval_seconds": interval_sec,
                "container_name": cname,
                "cpu_seconds_t0": d0["cpu_seconds"],
                "cpu_seconds_t1": d1["cpu_seconds"],
                "cpu_delta_seconds": cpu_delta,
                "metric_type": "IDLE_CPU_DELTA"
            })

            net_baseline_records.append({
                "sample_id": sample_id,
                "start_timestamp": ts_start,
                "end_timestamp": ts_end,
                "interval_seconds": interval_sec,
                "container_name": cname,
                "net_rx_before": d0["net_rx_bytes"],
                "net_rx_after": d1["net_rx_bytes"],
                "net_rx_delta_bytes": rx_delta,
                "net_tx_before": d0["net_tx_bytes"],
                "net_tx_after": d1["net_tx_bytes"],
                "net_tx_delta_bytes": tx_delta,
                "metric_type": "IDLE_NETWORK_DELTA"
            })

    cpu_csv = MEASUREMENTS_DIR / "c2b_idle_cpu_baseline.csv"
    with open(cpu_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "sample_id", "start_timestamp", "end_timestamp", "interval_seconds",
            "container_name", "cpu_seconds_t0", "cpu_seconds_t1", "cpu_delta_seconds", "metric_type"
        ])
        writer.writeheader()
        writer.writerows(cpu_baseline_records)
    print(f"[✓] Saved VPS CPU baseline to {cpu_csv}")

    net_csv = MEASUREMENTS_DIR / "c2b_idle_network_baseline.csv"
    with open(net_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "sample_id", "start_timestamp", "end_timestamp", "interval_seconds",
            "container_name", "net_rx_before", "net_rx_after", "net_rx_delta_bytes",
            "net_tx_before", "net_tx_after", "net_tx_delta_bytes", "metric_type"
        ])
        writer.writeheader()
        writer.writerows(net_baseline_records)
    print(f"[✓] Saved VPS Network baseline to {net_csv}")

    mem_csv = MEASUREMENTS_DIR / "c2b_idle_memory_baseline.csv"
    with open(mem_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "sample_id", "timestamp", "container_name", "memory_rss_bytes", "memory_rss_mb", "metric_type"
        ])
        writer.writeheader()
        writer.writerows(mem_baseline_records)
    print(f"[✓] Saved VPS Memory baseline to {mem_csv}")

    return cpu_baseline_records, net_baseline_records, mem_baseline_records


# ==============================================================================
# 2. DAST Workload Suite
# ==============================================================================

def run_dast_suite(runs: int = 3) -> List[Dict[str, Any]]:
    print(f"\n[*] Starting C2B DAST Measurement Suite ({runs} runs)...")
    measurements = []
    container_name = "juice-shop-c2b"
    port = 3001
    recon_folder = PROJECT_ROOT / f"recon_127_0_0_1_{port}"

    for i in range(1, runs + 1):
        run_id = f"c2b_dast_run_0{i}"
        start_ts = datetime.now(timezone.utc).isoformat()
        print(f"[*] Starting target container for {run_id}...")

        subprocess.run(["docker", "rm", "-f", container_name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        run_res = subprocess.run([
            "docker", "run", "-d", "--name", container_name,
            "-p", f"127.0.0.1:{port}:3000",
            "bkimminich/juice-shop:v17.1.1"
        ], capture_output=True, text=True)
        if run_res.returncode != 0:
            raise RuntimeError(f"Failed to start container: {run_res.stderr}")

        time.sleep(5)
        print(f"[*] Executing DAST {run_id}...")

        if recon_folder.exists():
            shutil.rmtree(recon_folder)

        scanner_script = PROJECT_ROOT / "quoc_omni.py"
        env = os.environ.copy()
        env["PYTHONPATH"] = f"{PROJECT_ROOT}:{PROJECT_ROOT / 'backend'}:{env.get('PYTHONPATH', '')}"

        exec_cmd = [
            PYTHON_EXEC, str(scanner_script), f"127.0.0.1:{port}", "--nuclei-include-info"
        ]

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

        peak_rss_mb = round(sampler.peak_rss_bytes / (1024.0 * 1024.0), 2)
        artifact_bytes = get_dir_size_bytes(recon_folder)

        after_rx, after_tx = get_container_net_io(container_name)

        # Scanner TX = Target RX delta; Scanner RX = Target TX delta
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
            "scanner_tx_bytes": delta_tx,
            "scanner_rx_bytes": delta_rx,
            "artifact_bytes": artifact_bytes,
            "ai_provider": "google_gemini",
            "ai_model": "gemini-1.5-flash",
            "ai_input_tokens": "null",
            "ai_output_tokens": "null",
            "ai_cached_tokens": "null",
            "ai_usage_source": "unavailable",
            "run_status": status,
            "notes": f"vps_dast_run_rc_{proc.returncode}"
        }
        measurements.append(record)
        print(f"[✓] {run_id}: Wall={wall_time}s, CPU={cpu_usage_sec}s, PeakRAM={peak_rss_mb}MB, TX={delta_tx}B, RX={delta_rx}B, Art={artifact_bytes}B")
        subprocess.run(["docker", "rm", "-f", container_name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    return measurements


# ==============================================================================
# 3. Stress Workload Suite
# ==============================================================================

def run_stress_suite(tier: str, max_duration: int, max_reqs: int, target_rps: int, runs: int = 3) -> List[Dict[str, Any]]:
    print(f"\n[*] Starting C2B Stress Suite ({tier}: {runs} runs, {target_rps} RPS, {max_duration}s, {max_reqs} reqs)...")
    measurements = []
    container_name = "juice-shop-c2b-stress"
    port = 3002
    target_url = f"http://127.0.0.1:{port}"

    for i in range(1, runs + 1):
        run_id = f"c2b_stress_{tier.lower()}_run_0{i}"
        start_ts = datetime.now(timezone.utc).isoformat()
        print(f"[*] Starting target container for {run_id}...")

        subprocess.run(["docker", "rm", "-f", container_name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        subprocess.run([
            "docker", "run", "-d", "--name", container_name,
            "-p", f"127.0.0.1:{port}:3000",
            "bkimminich/juice-shop:v17.1.1"
        ], capture_output=True, text=True)
        time.sleep(5)

        print(f"[*] Executing Stress {run_id}...")

        runner_code = f"""
import sys, os, time
sys.path.insert(0, '{PROJECT_ROOT / 'backend'}')
sys.path.insert(0, '{PROJECT_ROOT}')
os.environ['ADQ_ALLOW_PRIVATE_TARGETS'] = '1'
os.environ['ALLOW_PRIVATE_STRESS_TARGETS'] = '1'

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
        env["ALLOW_PRIVATE_STRESS_TARGETS"] = "1"
        env["PYTHONPATH"] = f"{PROJECT_ROOT / 'backend'}:{PROJECT_ROOT}:{env.get('PYTHONPATH', '')}"

        exec_cmd = [PYTHON_EXEC, "-c", runner_code]

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

        peak_rss_mb = round(sampler.peak_rss_bytes / (1024.0 * 1024.0), 2)
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
            "scanner_tx_bytes": delta_tx,
            "scanner_rx_bytes": delta_rx,
            "artifact_bytes": 0,
            "completed_requests": actual_reqs,
            "requested_requests": max_reqs,
            "ai_provider": "none",
            "ai_model": "none",
            "ai_input_tokens": "null",
            "ai_output_tokens": "null",
            "ai_cached_tokens": "null",
            "ai_usage_source": "unavailable",
            "run_status": status,
            "notes": f"completed_{actual_reqs}_of_{max_reqs}"
        }
        measurements.append(record)
        print(f"[✓] {run_id}: Reqs={actual_reqs}, Wall={wall_time}s, CPU={cpu_usage_sec}s, PeakRAM={peak_rss_mb}MB, TX={delta_tx}B, RX={delta_rx}B")
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
    print("ADQ Phase C2B Japan VPS Empirical Measurement Suite")
    print("==========================================================")

    # 1. Idle Baselines
    cpu_recs, net_recs, mem_recs = run_idle_baseline_suite(interval_sec=10, samples=3)

    # 2. DAST Suite
    dast_records = run_dast_suite(runs=3)

    # 3. Stress PRO
    stress_pro_records = run_stress_suite("PRO", max_duration=30, max_reqs=2000, target_rps=100, runs=3)

    # 4. Stress PRO_MAX
    stress_promax_records = run_stress_suite("PRO_MAX", max_duration=60, max_reqs=5000, target_rps=250, runs=3)

    all_operations = dast_records + stress_pro_records + stress_promax_records

    # Save c2b_operation_measurements.csv
    op_csv = MEASUREMENTS_DIR / "c2b_operation_measurements.csv"
    fieldnames = [
        "run_id", "workload", "tier_profile", "target", "start_timestamp",
        "wall_time_seconds", "cpu_usage_seconds", "peak_memory_mb",
        "scanner_tx_bytes", "scanner_rx_bytes", "artifact_bytes",
        "completed_requests", "requested_requests",
        "ai_provider", "ai_model", "ai_input_tokens", "ai_output_tokens",
        "ai_cached_tokens", "ai_usage_source", "run_status", "notes"
    ]
    with open(op_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(all_operations)
    print(f"\n[✓] Saved VPS operation measurements to {op_csv}")

    dast_stats = {
        "runtime": compute_statistics(dast_records, "wall_time_seconds"),
        "cpu": compute_statistics(dast_records, "cpu_usage_seconds"),
        "peak_ram": compute_statistics(dast_records, "peak_memory_mb"),
        "tx_bytes": compute_statistics(dast_records, "scanner_tx_bytes"),
        "rx_bytes": compute_statistics(dast_records, "scanner_rx_bytes"),
        "artifact_bytes": compute_statistics(dast_records, "artifact_bytes"),
    }
    stress_pro_stats = {
        "runtime": compute_statistics(stress_pro_records, "wall_time_seconds"),
        "cpu": compute_statistics(stress_pro_records, "cpu_usage_seconds"),
        "peak_ram": compute_statistics(stress_pro_records, "peak_memory_mb"),
        "tx_bytes": compute_statistics(stress_pro_records, "scanner_tx_bytes"),
        "rx_bytes": compute_statistics(stress_pro_records, "scanner_rx_bytes"),
        "completed_requests": compute_statistics(stress_pro_records, "completed_requests"),
    }
    stress_promax_stats = {
        "runtime": compute_statistics(stress_promax_records, "wall_time_seconds"),
        "cpu": compute_statistics(stress_promax_records, "cpu_usage_seconds"),
        "peak_ram": compute_statistics(stress_promax_records, "peak_memory_mb"),
        "tx_bytes": compute_statistics(stress_promax_records, "scanner_tx_bytes"),
        "rx_bytes": compute_statistics(stress_promax_records, "scanner_rx_bytes"),
        "completed_requests": compute_statistics(stress_promax_records, "completed_requests"),
    }

    # Hourly cost input: 1,790 VND/hour
    vps_cost_per_hour = 1790.0
    vps_cost_per_sec = vps_cost_per_hour / 3600.0  # ~0.4972 VND/s

    # Resource Cost Model (CPU share: CPU seconds / 4 vCPUs * Cost per sec)
    vcpu_count = 4.0
    dast_cost_vnd = round(dast_stats["cpu"]["median"] * (vps_cost_per_sec / vcpu_count), 2)
    stress_pro_cost_vnd = round(stress_pro_stats["cpu"]["median"] * (vps_cost_per_sec / vcpu_count), 2)
    stress_promax_cost_vnd = round(stress_promax_stats["cpu"]["median"] * (vps_cost_per_sec / vcpu_count), 2)

    summary_json_data = {
        "meta": {
            "phase": "C2B_JAPAN_VPS_EMPIRICAL_MEASUREMENT",
            "classification": "VPS_EMPIRICAL",
            "measured_at": datetime.now(timezone.utc).isoformat(),
            "hardware_context": {
                "hostname": "163-44-193-25",
                "os": "Ubuntu 26.04 LTS (Resolute Raccoon)",
                "kernel": "7.0.0-22-generic",
                "arch": "x86_64",
                "vcpu_count": 4,
                "cpu_model": "Intel(R) Xeon(R) Gold 5117 CPU @ 2.00GHz",
                "total_ram_mb": 3910,
                "swap_mb": 3908,
                "disk_gb": 50,
                "docker_version": "29.8.0",
                "adq_head": "a0b36183cb53d8991708bf92eb35dc138053f37c (with B2 fixes)"
            },
            "billing_input": {
                "vps_cost_vnd_per_hour": 1790,
                "classification": "USER_SUPPLIED_INPUT",
                "modelled_monthly_equivalent_720h_vnd": 1790 * 720,
                "modelled_monthly_equivalent_744h_vnd": 1790 * 744,
                "external_postgres_cost_vnd": 0,
                "external_redis_cost_vnd": 0
            }
        },
        "workloads": {
            "DAST_PROFILE_A": {
                "runs_completed": len(dast_records),
                "metrics": dast_stats,
                "unit_cost_vnd": dast_cost_vnd
            },
            "L7_STRESS_PRO": {
                "runs_completed": len(stress_pro_records),
                "metrics": stress_pro_stats,
                "unit_cost_vnd": stress_pro_cost_vnd
            },
            "L7_STRESS_PRO_MAX": {
                "runs_completed": len(stress_promax_records),
                "metrics": stress_promax_stats,
                "unit_cost_vnd": stress_promax_cost_vnd
            }
        },
        "telemetry_audit": {
            "ai_usage_metadata_supported": True,
            "ai_usage_metadata_currently_captured": "PARTIAL (In-memory token count in copilot_engine; unpersisted in DB)",
            "monetary_cost_calculated": True,
            "pricing_basis": "Empirical VPS rate of 1,790 VND/hr"
        }
    }

    summary_json_file = ANALYSIS_DIR / "c2b_resource_summary.json"
    with open(summary_json_file, "w", encoding="utf-8") as f:
        json.dump(summary_json_data, f, indent=2)
    print(f"[✓] Saved VPS summary JSON to {summary_json_file}")

    summary_csv_rows = [
        {"workload": "DAST_PROFILE_A", "metric": "runtime_seconds", "min": dast_stats["runtime"]["min"], "median": dast_stats["runtime"]["median"], "max": dast_stats["runtime"]["max"], "classification": "VPS_EMPIRICAL"},
        {"workload": "DAST_PROFILE_A", "metric": "cpu_usage_seconds", "min": dast_stats["cpu"]["min"], "median": dast_stats["cpu"]["median"], "max": dast_stats["cpu"]["max"], "classification": "VPS_EMPIRICAL"},
        {"workload": "DAST_PROFILE_A", "metric": "peak_memory_mb", "min": dast_stats["peak_ram"]["min"], "median": dast_stats["peak_ram"]["median"], "max": dast_stats["peak_ram"]["max"], "classification": "VPS_EMPIRICAL"},
        {"workload": "DAST_PROFILE_A", "metric": "network_tx_bytes", "min": dast_stats["tx_bytes"]["min"], "median": dast_stats["tx_bytes"]["median"], "max": dast_stats["tx_bytes"]["max"], "classification": "VPS_EMPIRICAL"},
        {"workload": "DAST_PROFILE_A", "metric": "network_rx_bytes", "min": dast_stats["rx_bytes"]["min"], "median": dast_stats["rx_bytes"]["median"], "max": dast_stats["rx_bytes"]["max"], "classification": "VPS_EMPIRICAL"},
        {"workload": "DAST_PROFILE_A", "metric": "artifact_bytes", "min": dast_stats["artifact_bytes"]["min"], "median": dast_stats["artifact_bytes"]["median"], "max": dast_stats["artifact_bytes"]["max"], "classification": "VPS_EMPIRICAL"},
        {"workload": "L7_STRESS_PRO", "metric": "runtime_seconds", "min": stress_pro_stats["runtime"]["min"], "median": stress_pro_stats["runtime"]["median"], "max": stress_pro_stats["runtime"]["max"], "classification": "VPS_EMPIRICAL"},
        {"workload": "L7_STRESS_PRO", "metric": "cpu_usage_seconds", "min": stress_pro_stats["cpu"]["min"], "median": stress_pro_stats["cpu"]["median"], "max": stress_pro_stats["cpu"]["max"], "classification": "VPS_EMPIRICAL"},
        {"workload": "L7_STRESS_PRO", "metric": "peak_memory_mb", "min": stress_pro_stats["peak_ram"]["min"], "median": stress_pro_stats["peak_ram"]["median"], "max": stress_pro_stats["peak_ram"]["max"], "classification": "VPS_EMPIRICAL"},
        {"workload": "L7_STRESS_PRO", "metric": "network_tx_bytes", "min": stress_pro_stats["tx_bytes"]["min"], "median": stress_pro_stats["tx_bytes"]["median"], "max": stress_pro_stats["tx_bytes"]["max"], "classification": "VPS_EMPIRICAL"},
        {"workload": "L7_STRESS_PRO", "metric": "network_rx_bytes", "min": stress_pro_stats["rx_bytes"]["min"], "median": stress_pro_stats["rx_bytes"]["median"], "max": stress_pro_stats["rx_bytes"]["max"], "classification": "VPS_EMPIRICAL"},
        {"workload": "L7_STRESS_PRO_MAX", "metric": "runtime_seconds", "min": stress_promax_stats["runtime"]["min"], "median": stress_promax_stats["runtime"]["median"], "max": stress_promax_stats["runtime"]["max"], "classification": "VPS_EMPIRICAL"},
        {"workload": "L7_STRESS_PRO_MAX", "metric": "cpu_usage_seconds", "min": stress_promax_stats["cpu"]["min"], "median": stress_promax_stats["cpu"]["median"], "max": stress_promax_stats["cpu"]["max"], "classification": "VPS_EMPIRICAL"},
        {"workload": "L7_STRESS_PRO_MAX", "metric": "peak_memory_mb", "min": stress_promax_stats["peak_ram"]["min"], "median": stress_promax_stats["peak_ram"]["median"], "max": stress_promax_stats["peak_ram"]["max"], "classification": "VPS_EMPIRICAL"},
        {"workload": "L7_STRESS_PRO_MAX", "metric": "network_tx_bytes", "min": stress_promax_stats["tx_bytes"]["min"], "median": stress_promax_stats["tx_bytes"]["median"], "max": stress_promax_stats["tx_bytes"]["max"], "classification": "VPS_EMPIRICAL"},
        {"workload": "L7_STRESS_PRO_MAX", "metric": "network_rx_bytes", "min": stress_promax_stats["rx_bytes"]["min"], "median": stress_promax_stats["rx_bytes"]["median"], "max": stress_promax_stats["rx_bytes"]["max"], "classification": "VPS_EMPIRICAL"},
    ]
    summary_csv_file = ANALYSIS_DIR / "c2b_resource_summary.csv"
    with open(summary_csv_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["workload", "metric", "min", "median", "max", "classification"])
        writer.writeheader()
        writer.writerows(summary_csv_rows)
    print(f"[✓] Saved VPS summary CSV to {summary_csv_file}")


if __name__ == "__main__":
    main()
