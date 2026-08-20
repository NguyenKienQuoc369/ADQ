import argparse
import json
import os
import signal
import subprocess
import sys
import time
import threading
from typing import Any, Dict

import redis

try:
    from core.engine.grid_master import MasterGridNode
    from core.engine.oast_server import ADQInteractionServer
except ImportError:
    from backend.core.engine.grid_master import MasterGridNode
    from backend.core.engine.oast_server import ADQInteractionServer

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
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
    # Master runtime dùng Redis làm source-of-truth cho worker lifecycle.
    # MasterGridNode vẫn được giữ cho các module grid cũ tương thích,
    # nhưng recovery của scan queue không phụ thuộc vào state trong RAM.
    node = MasterGridNode()
    _ = node

    print("[runtime:master] started", flush=True)

    try:
        redis_client = redis.Redis.from_url(
            REDIS_URL,
            decode_responses=True,
        )
        redis_client.ping()
        print(
            f"[runtime:master] Connected to Redis at {REDIS_URL}",
            flush=True,
        )
    except Exception as exc:
        print(
            f"[runtime:master] Redis connection failed: {exc}",
            flush=True,
        )
        redis_client = None

    running = True

    # Không recover ngay khi heartbeat vừa biến mất.
    # Grace period tránh trường hợp network/Redis hiccup ngắn.
    stale_grace_seconds = int(
        os.getenv("WORKER_RECOVERY_GRACE_SECONDS", "45")
    )

    missing_since: Dict[str, float] = {}

    def handle_stop(_sig, _frame):
        nonlocal running
        running = False

    signal.signal(signal.SIGTERM, handle_stop)
    signal.signal(signal.SIGINT, handle_stop)

    while running:
        time.sleep(2)

        if not redis_client:
            try:
                redis_client = redis.Redis.from_url(
                    REDIS_URL,
                    decode_responses=True,
                )
                redis_client.ping()
                print(
                    f"[runtime:master] Reconnected to Redis at {REDIS_URL}",
                    flush=True,
                )
            except Exception:
                redis_client = None
                continue

        try:
            now = time.time()

            processing_keys = sorted(
                redis_client.scan_iter("scan_processing:*")
            )

            active_processing_workers = set()

            for processing_key in processing_keys:
                worker_id = processing_key.split(
                    "scan_processing:",
                    1,
                )[-1]

                if not worker_id:
                    continue

                queue_len = redis_client.llen(processing_key)

                # Empty processing queues không cần watchdog.
                if queue_len <= 0:
                    missing_since.pop(worker_id, None)
                    continue

                active_processing_workers.add(worker_id)

                heartbeat_key = f"worker_heartbeat:{worker_id}"
                heartbeat_exists = bool(
                    redis_client.exists(heartbeat_key)
                )

                if heartbeat_exists:
                    missing_since.pop(worker_id, None)
                    continue

                first_missing = missing_since.setdefault(
                    worker_id,
                    now,
                )
                missing_for = now - first_missing

                if missing_for < stale_grace_seconds:
                    continue

                recovered = 0

                # RPOPLPUSH là atomic cho từng message:
                # processing RIGHT -> scan_queue LEFT.
                #
                # scan_queue được worker consume từ LEFT, vì vậy job
                # orphan sẽ có thể được worker sống khác nhận ngay.
                while True:
                    # Peek job cuối processing queue để xác định
                    # capability trước khi atomic move.
                    pending_message = redis_client.lindex(
                        processing_key,
                        -1,
                    )

                    if pending_message is None:
                        break

                    try:
                        pending_job = json.loads(pending_message)
                    except Exception:
                        pending_job = {}

                    required_capability = str(
                        pending_job.get("required_capability")
                        or ""
                    ).strip()

                    destination_queue = (
                        f"scan_queue:{required_capability}"
                        if required_capability
                        else "scan_queue"
                    )

                    message = redis_client.rpoplpush(
                        processing_key,
                        destination_queue,
                    )

                    if message is None:
                        break

                    recovered += 1

                    try:
                        job_data = json.loads(message)
                    except Exception:
                        job_data = {}

                    job_id = job_data.get("job_id")

                    if job_id:
                        result_key = f"job_result:{job_id}"

                        raw_result = redis_client.get(result_key)
                        try:
                            current_result = (
                                json.loads(raw_result)
                                if raw_result
                                else {}
                            )
                        except Exception:
                            current_result = {}

                        if not isinstance(current_result, dict):
                            current_result = {}

                        current_result.update({
                            "status": "queued",
                            "worker_id": None,
                            "recovered_from_worker": worker_id,
                            "recovered_at": time.time(),
                            "recovery_reason": "worker_heartbeat_lost",
                        })

                        redis_client.set(
                            result_key,
                            json.dumps(current_result),
                        )

                        try:
                            try:
                                from backend.core.engine.db import (
                                    update_scan_status,
                                )
                            except ImportError:
                                from core.engine.db import (
                                    update_scan_status,
                                )

                            update_scan_status(
                                job_id,
                                "QUEUED",
                            )
                        except Exception as exc:
                            print(
                                f"[runtime:master] Failed to update "
                                f"DB status for recovered job "
                                f"{job_id}: {exc}",
                                flush=True,
                            )

                missing_since.pop(worker_id, None)

                if recovered:
                    print(
                        f"[runtime:master] Recovered {recovered} "
                        f"orphan job(s) from dead worker "
                        f"{worker_id}",
                        flush=True,
                    )

            # Xóa bookkeeping của worker không còn processing queue.
            for worker_id in list(missing_since):
                if worker_id not in active_processing_workers:
                    missing_since.pop(worker_id, None)

        except Exception as exc:
            print(
                f"[runtime:master] recovery loop error: {exc}",
                flush=True,
            )
            time.sleep(2)

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

    # quoc_omni.py được chạy từ thư mục backend để giữ nguyên
    # vị trí output, nhưng cần project root trong PYTHONPATH để
    # import backend.* hoạt động khi subprocess chạy trực tiếp.
    existing_pythonpath = env.get("PYTHONPATH", "")
    env["PYTHONPATH"] = (
        PROJECT_ROOT
        if not existing_pythonpath
        else PROJECT_ROOT + os.pathsep + existing_pythonpath
    )

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

    # Mỗi scan chạy trong process group riêng để watchdog có thể
    # dừng toàn bộ cây process (quoc_omni + nuclei/ffuf/katana/...).
    scan_timeout = int(os.getenv("SCAN_JOB_TIMEOUT_SECONDS", "1800"))
    timed_out = False

    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=env,
        cwd=BASE_DIR,
        start_new_session=True,
    )

    try:
        out, err = proc.communicate(timeout=scan_timeout)

    except subprocess.TimeoutExpired:
        timed_out = True

        timeout_message = (
            f"SCAN_TIMEOUT: Job exceeded {scan_timeout} seconds "
            f"and was terminated by worker watchdog."
        )

        print(
            f"[{worker_id}] {timeout_message} job_id={job_id}",
            flush=True,
        )

        # SIGTERM toàn bộ process group trước để các tool có cơ hội
        # đóng file/output sạch sẽ.
        try:
            os.killpg(proc.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        except Exception as exc:
            print(
                f"[{worker_id}] Failed to SIGTERM process group "
                f"for job {job_id}: {exc}",
                flush=True,
            )

        try:
            out, err = proc.communicate(timeout=10)

        except subprocess.TimeoutExpired:
            print(
                f"[{worker_id}] Job {job_id} ignored SIGTERM; "
                "forcing SIGKILL",
                flush=True,
            )

            try:
                os.killpg(proc.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            except Exception as exc:
                print(
                    f"[{worker_id}] Failed to SIGKILL process group "
                    f"for job {job_id}: {exc}",
                    flush=True,
                )

            out, err = proc.communicate()

        err = ((err or "") + "\n" + timeout_message).strip()

    final_status = (
        "failed"
        if timed_out or proc.returncode != 0
        else "done"
    )

    # Scanner sanitize folder bằng cách đổi '.', ':' và ký tự đặc biệt
    # thành underscore. Worker phải dùng cùng quy tắc.
    target_clean = (
        target
        .replace("http://", "")
        .replace("https://", "")
        .strip("/")
        .split("/", 1)[0]
    )

    folder = "".join(
        c if c.isalnum() or c in ("_", "-") else "_"
        for c in target_clean
    )

    candidate_paths = [
        os.path.join(BASE_DIR, folder, "result.json"),
        os.path.join(BASE_DIR, f"recon_{folder}", "result.json"),
    ]

    result_json_path = None
    job_started_at = float(running_status.get("started_at", 0))

    # Tuyệt đối không fallback sang result.json của scan khác.
    # Chỉ chấp nhận file được tạo/cập nhật trong chính job hiện tại.
    if not timed_out and proc.returncode == 0:
        for candidate in candidate_paths:
            if not os.path.exists(candidate):
                continue

            try:
                mtime = os.path.getmtime(candidate)
            except OSError:
                continue

            if mtime >= job_started_at - 1:
                result_json_path = candidate
                break

    scan_tree_data = {}

    if result_json_path:
        try:
            with open(result_json_path, "r", encoding="utf-8") as f:
                loaded_result = json.load(f)

            if isinstance(loaded_result, dict):
                scan_tree_data = loaded_result
        except Exception as e:
            print(
                f"[{worker_id}] Lỗi đọc result.json của job {job_id}: {e}",
                flush=True,
            )

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
    # Hợp nhất toàn bộ dữ liệu quét (subdomains, vulnerabilities, action_advice) vào Redis
    completed_result.update(scan_tree_data)
    redis_client.set(f"job_result:{job_id}", json.dumps(completed_result))

    try:
        try:
            from backend.core.engine.db import (
                save_live_hosts,
                save_vulnerabilities,
                save_scan_endpoints,
                update_scan_status,
            )
        except ImportError:
            from core.engine.db import (
                save_live_hosts,
                save_vulnerabilities,
                save_scan_endpoints,
                update_scan_status,
            )

        if scan_tree_data:
            sub_live = scan_tree_data.get("subdomains", {}).get("http_live", [])
            hosts = [{"url": u, "status_code": 200, "title": "Live Host"} for u in sub_live]
            if hosts:
                save_live_hosts(job_id, hosts)

            nuclei_vulns = scan_tree_data.get("vulnerabilities", {}).get("nuclei", [])
            if nuclei_vulns:
                save_vulnerabilities(job_id, nuclei_vulns)

            # ------------------------------------------------
            # Persist discovery endpoints separately.
            # ------------------------------------------------
            endpoint_rows = []
            urls_data = scan_tree_data.get("urls", {}) or {}
            discovered_urls = set()

            for source in ("katana", "gau", "wayback"):
                values = urls_data.get(source, []) or []

                for value in values:
                    url = str(value or "").strip()
                    if not url:
                        continue

                    endpoint_rows.append({
                        "url": url,
                        "source": source,
                    })
                    discovered_urls.add(url)

            # `combined` có thể chứa URL mà từng source riêng không ghi lại.
            for value in urls_data.get("combined", []) or []:
                url = str(value or "").strip()
                if not url or url in discovered_urls:
                    continue

                endpoint_rows.append({
                    "url": url,
                    "source": "combined",
                })
                discovered_urls.add(url)

            # FFuf parser hiện có thể chỉ trả raw output. Chỉ persist khi
            # finding thực sự có URL/path; raw progress không được coi là
            # vulnerability hay endpoint giả.
            ffuf_items = (
                scan_tree_data
                .get("vulnerabilities", {})
                .get("ffuf", [])
                or []
            )

            target_base = str(target or "").strip().rstrip("/")
            if target_base and not target_base.startswith(("http://", "https://")):
                target_base = "https://" + target_base

            for item in ffuf_items:
                if not isinstance(item, dict):
                    continue

                candidate = (
                    item.get("url")
                    or item.get("endpoint")
                    or item.get("path")
                )

                if not candidate:
                    continue

                url = str(candidate).strip()

                if url.startswith("/") and target_base:
                    url = target_base + url

                if not url:
                    continue

                endpoint_rows.append({
                    "url": url,
                    "source": "ffuf",
                    "method": item.get("method") or "GET",
                    "status_code": item.get("status_code") or item.get("status"),
                    "content_length": item.get("length"),
                    "raw": item.get("raw"),
                })

            save_scan_endpoints(job_id, endpoint_rows)

        update_scan_status(
            job_id,
            "FAILED" if timed_out or proc.returncode != 0 else "COMPLETED",
        )
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

    # Heartbeat chạy ở thread riêng.
    # Scanner có thể block execute_job() trong nhiều phút nhưng heartbeat
    # vẫn tiếp tục được refresh trên Redis.
    heartbeat_stop = threading.Event()

    worker_state: Dict[str, Any] = {
        "status": "IDLE",
        "job_id": None,
    }

    def write_heartbeat() -> None:
        if not redis_client:
            return

        now = time.time()
        hb_data = {
            "worker_id": worker_id,
            "capability": capability,
            "last_heartbeat": now,
            "status": worker_state["status"],
            "job_id": worker_state["job_id"],
        }

        try:
            redis_client.set(
                f"worker_heartbeat:{worker_id}",
                json.dumps(hb_data),
                ex=30,
            )
        except Exception as exc:
            print(
                f"[{worker_id}] Heartbeat update failed: {exc}",
                flush=True,
            )

    def heartbeat_loop() -> None:
        while not heartbeat_stop.is_set():
            write_heartbeat()
            heartbeat_stop.wait(5)

    heartbeat_thread = threading.Thread(
        target=heartbeat_loop,
        name=f"heartbeat-{worker_id}",
        daemon=True,
    )
    heartbeat_thread.start()

    # ------------------------------------------------------------
    # Reliable queue
    #
    # Thay vì BLPOP xóa job khỏi scan_queue ngay lập tức, BLMOVE
    # chuyển job atomically sang processing queue của worker.
    #
    # Job chỉ được ACK (LREM) sau khi execute_job() hoàn tất.
    # Nếu worker crash giữa chừng, message vẫn còn trong Redis.
    # ------------------------------------------------------------
    processing_key = f"scan_processing:{worker_id}"

    worker_capabilities = [
        item.strip()
        for item in str(capability or "").split(",")
        if item.strip()
    ]

    if not worker_capabilities:
        worker_capabilities = ["recon_infra"]

    # Worker chỉ consume queue mà nó hỗ trợ.
    # Legacy scan_queue được giữ cuối danh sách để không làm kẹt
    # các job đã được enqueue trước khi capability routing được bật.
    queue_keys = [
        f"scan_queue:{cap}"
        for cap in worker_capabilities
    ]

    if "scan_queue" not in queue_keys:
        queue_keys.append("scan_queue")

    def queue_for_message(message: str) -> str:
        try:
            payload = json.loads(message)
        except Exception:
            return "scan_queue"

        required = str(
            payload.get("required_capability") or ""
        ).strip()

        if required:
            return f"scan_queue:{required}"

        return "scan_queue"

    print(
        f"[{worker_id}] Listening queues: {', '.join(queue_keys)}",
        flush=True,
    )

    if redis_client:
        try:
            recovered = 0

            # Worker khởi động lại với cùng worker_id:
            # trả các job chưa ACK từ lần chạy trước về hàng đợi.
            while True:
                stale_message = redis_client.lpop(processing_key)

                if stale_message is None:
                    break

                recovery_queue = queue_for_message(stale_message)

                redis_client.lpush(
                    recovery_queue,
                    stale_message,
                )
                recovered += 1

            if recovered:
                print(
                    f"[{worker_id}] Requeued {recovered} unfinished job(s) "
                    "from previous worker session",
                    flush=True,
                )

        except Exception as exc:
            print(
                f"[{worker_id}] Processing queue recovery failed: {exc}",
                flush=True,
            )

    while running:
        if not redis_client:
            time.sleep(5)
            continue

        try:
            # Atomic move từ queue capability sang processing queue.
            #
            # Timeout 1 giây/queue để một worker có nhiều capability
            # vẫn luân phiên kiểm tra được các hàng đợi.
            message = None
            source_queue = None

            for candidate_queue in queue_keys:
                if not running:
                    break

                message = redis_client.execute_command(
                    "BLMOVE",
                    candidate_queue,
                    processing_key,
                    "LEFT",
                    "RIGHT",
                    1,
                )

                if message:
                    source_queue = candidate_queue
                    break

            if not message:
                continue

            try:
                job_data = json.loads(message)
            except Exception as exc:
                print(
                    f"[{worker_id}] Dropping malformed queue message: {exc}",
                    flush=True,
                )
                redis_client.lrem(processing_key, 1, message)
                continue

            job_id = job_data.get("job_id")

            required_capability = str(
                job_data.get("required_capability") or ""
            ).strip()

            # Legacy queue có thể chứa job cũ/chưa route.
            # Nếu job đã có capability nhưng worker hiện tại không
            # hỗ trợ, trả nó sang đúng queue thay vì chạy nhầm.
            if (
                required_capability
                and "all" not in worker_capabilities
                and required_capability not in worker_capabilities
            ):
                destination = f"scan_queue:{required_capability}"

                redis_client.lrem(
                    processing_key,
                    1,
                    message,
                )
                redis_client.rpush(
                    destination,
                    message,
                )

                print(
                    f"[{worker_id}] Redirected job "
                    f"{job_id or '<unknown>'} from "
                    f"{source_queue} to {destination}",
                    flush=True,
                )
                continue

            if not job_id:
                print(
                    f"[{worker_id}] Dropping queue message without job_id",
                    flush=True,
                )
                redis_client.lrem(processing_key, 1, message)
                continue

            worker_state["status"] = "BUSY"
            worker_state["job_id"] = job_id
            write_heartbeat()

            try:
                execute_job(
                    job_id,
                    job_data,
                    redis_client,
                    worker_id,
                )

                # ACK chỉ sau khi worker xử lý xong job.
                redis_client.lrem(
                    processing_key,
                    1,
                    message,
                )

            finally:
                worker_state["status"] = "IDLE"
                worker_state["job_id"] = None
                write_heartbeat()

        except Exception as exc:
            print(
                f"[{worker_id}] Redis reliable queue error: {exc}",
                flush=True,
            )
            time.sleep(2)

    heartbeat_stop.set()
    heartbeat_thread.join(timeout=6)

    if redis_client:
        try:
            redis_client.delete(f"worker_heartbeat:{worker_id}")
        except Exception:
            pass

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
