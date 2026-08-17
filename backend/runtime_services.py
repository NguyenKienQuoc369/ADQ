import argparse
import json
import os
import signal
import subprocess
import sys
import time
from typing import Any, Dict

import redis

try:
    from core.engine.grid_master import MasterGridNode
    from core.engine.oast_server import ADQInteractionServer
except ImportError:
    from backend.core.engine.grid_master import MasterGridNode
    from backend.core.engine.oast_server import ADQInteractionServer

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
REDIS_URL = os.getenv("REDIS_URL", "redis://adq_redis:6379/0")


def run_oast(host: str, port: int) -> None:
    server = ADQInteractionServer(host=host, port=port)
    server.start_server()
    print(f"[runtime:oast] listening on {host}:{port}", flush=True)

    running = True

    def handle_stop(_sig, _frame):
        nonlocal running
        running = False

    signal.signal(signal.SIGTERM, handle_stop)
    signal.signal(signal.SIGINT, handle_stop)

    while running:
        time.sleep(1)

    server.stop_server()
    print("[runtime:oast] stopped", flush=True)


def run_master() -> None:
    node = MasterGridNode()
    print("[runtime:master] started", flush=True)

    running = True

    def handle_stop(_sig, _frame):
        nonlocal running
        running = False

    signal.signal(signal.SIGTERM, handle_stop)
    signal.signal(signal.SIGINT, handle_stop)

    while running:
        time.sleep(2)
        now = time.time()
        stale_workers = [
            worker_id
            for worker_id, info in node.active_workers.items()
            if now - info.get("last_heartbeat", 0) > 60
        ]
        for worker_id in stale_workers:
            node.active_workers.pop(worker_id, None)
            print(f"[runtime:master] dropped stale worker {worker_id}", flush=True)

    print("[runtime:master] stopped", flush=True)


def execute_job(job_id: str, job_data: Dict[str, Any], redis_client: redis.Redis, worker_id: str):
    req_data = job_data.get("request", {})
    target = req_data.get("target") or job_data.get("target")
    if not target:
        print(f"[{worker_id}] Invalid job data missing target: {job_data}", flush=True)
        return

    print(f"[{worker_id}] Executing Job {job_id} for target: {target}", flush=True)

    cmd = [sys.executable, "quoc_omni.py", target]

    if req_data.get("logic_scan"):
        cmd.append("--logic-scan")
    if req_data.get("logic_base_url"):
        cmd.extend(["--logic-base-url", req_data["logic_base_url"]])
    if req_data.get("race_endpoint"):
        cmd.extend(["--race-endpoint", req_data["race_endpoint"]])
    if req_data.get("race_concurrency"):
        cmd.extend(["--race-concurrency", str(req_data["race_concurrency"])])
    if req_data.get("idor_endpoint_template"):
        cmd.extend(["--idor-endpoint-template", req_data["idor_endpoint_template"]])
    if req_data.get("token_a"):
        cmd.extend(["--token-a", req_data["token_a"]])
    if req_data.get("token_b"):
        cmd.extend(["--token-b", req_data["token_b"]])
    if req_data.get("workflow_endpoint"):
        cmd.extend(["--workflow-endpoint", req_data["workflow_endpoint"]])

    extra_args = req_data.get("extra_args", [])
    if isinstance(extra_args, list):
        cmd.extend(extra_args)

    env = os.environ.copy()

    headers = req_data.get("headers", {})
    if isinstance(headers, dict):
        for k, v in headers.items():
            env_key = f"SCAN_HEADER_{k.upper().replace('-', '_')}"
            env[env_key] = v

    running_status = {
        "status": "running",
        "worker_id": worker_id,
        "target": target,
        "started_at": time.time(),
        "request": req_data,
        "stdout_tail": "",
        "stderr_tail": "",
    }
    redis_client.set(f"job_result:{job_id}", json.dumps(running_status))

    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=env,
        cwd=BASE_DIR,
    )

    out, err = proc.communicate()
    final_status = "done" if proc.returncode == 0 else "failed"

    completed_result = {
        "status": final_status,
        "worker_id": worker_id,
        "target": target,
        "pid": proc.pid,
        "returncode": proc.returncode,
        "stdout_tail": out[-4000:] if out else "",
        "stderr_tail": err[-4000:] if err else "",
        "completed_at": time.time(),
    }
    redis_client.set(f"job_result:{job_id}", json.dumps(completed_result))

    try:
        try:
            from backend.core.engine.db import save_live_hosts, save_vulnerabilities, update_scan_status
        except ImportError:
            from core.engine.db import save_live_hosts, save_vulnerabilities, update_scan_status
        target_clean = target.replace("http://", "").replace("https://", "").strip("/")
        folder = "".join([c if c.isalnum() or c in (".", "_", "-") else "_" for c in target_clean])
        result_json_path = os.path.join(BASE_DIR, folder, "result.json")

        if os.path.exists(result_json_path):
            with open(result_json_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            sub_live = data.get("subdomains", {}).get("http_live", [])
            hosts = [{"url": u, "status_code": 200, "title": "Live Host"} for u in sub_live]
            if hosts:
                save_live_hosts(job_id, hosts)

            nuclei_vulns = data.get("vulnerabilities", {}).get("nuclei", [])
            if nuclei_vulns:
                save_vulnerabilities(job_id, nuclei_vulns)

        update_scan_status(job_id, "COMPLETED" if proc.returncode == 0 else "FAILED")
    except Exception as exc:
        print(f"[{worker_id}] Error saving scan results to database: {exc}", flush=True)

    print(f"[{worker_id}] Finished Job {job_id} with status '{final_status}'", flush=True)


def run_worker(worker_id: str, capability: str) -> None:
    print(f"[runtime:worker] started worker_id={worker_id} capability={capability}", flush=True)

    try:
        redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
        redis_client.ping()
        print(f"[runtime:worker] Connected to Redis at {REDIS_URL}", flush=True)
    except Exception as exc:
        print(f"[runtime:worker] Redis connection failed: {exc}", flush=True)
        redis_client = None

    running = True

    def handle_stop(_sig, _frame):
        nonlocal running
        running = False

    signal.signal(signal.SIGTERM, handle_stop)
    signal.signal(signal.SIGINT, handle_stop)

    last_hb = 0

    while running:
        now = time.time()
        if now - last_hb >= 5:
            last_hb = now
            hb_data = {
                "worker_id": worker_id,
                "capability": capability,
                "last_heartbeat": now,
                "status": "IDLE",
            }
            if redis_client:
                try:
                    redis_client.set(f"worker_heartbeat:{worker_id}", json.dumps(hb_data), ex=30)
                except Exception:
                    pass

        if not redis_client:
            time.sleep(5)
            continue

        try:
            pop_result = redis_client.blpop("scan_queue", timeout=3)
            if pop_result:
                _, message = pop_result
                job_data = json.loads(message)
                job_id = job_data.get("job_id")
                if job_id:
                    execute_job(job_id, job_data, redis_client, worker_id)
        except Exception as exc:
            print(f"[{worker_id}] Redis queue pop error: {exc}", flush=True)
            time.sleep(2)

    print(f"[runtime:worker] stopped worker_id={worker_id}", flush=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="ADQ runtime services")
    parser.add_argument("--role", choices=["oast", "master", "worker"], required=True)
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=int(os.getenv("OAST_PORT", "8888")))
    parser.add_argument("--worker-id", default=os.getenv("WORKER_ID", "worker-unknown"))
    parser.add_argument("--capability", default=os.getenv("CAPABILITY", "unknown"))
    args = parser.parse_args()

    if args.role == "oast":
        run_oast(host=args.host, port=args.port)
        return 0
    if args.role == "master":
        run_master()
        return 0

    run_worker(worker_id=args.worker_id, capability=args.capability)
    return 0


if __name__ == "__main__":
    sys.exit(main())
