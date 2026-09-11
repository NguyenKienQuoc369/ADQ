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

try:
    from backend.schemas.scan import sanitize_request_data, sanitize_extra_args
except ImportError:
    from schemas.scan import sanitize_request_data, sanitize_extra_args


def build_ai_scan_context(scan_tree_data: Dict[str, Any], max_chars: int = 24000) -> str:
    if not isinstance(scan_tree_data, dict):
        return "{}"

    target = scan_tree_data.get("target", "")
    vulns = scan_tree_data.get("vulnerabilities", {}) or {}
    logic_vulns = scan_tree_data.get("logic_vulnerabilities", {}) or {}
    
    # Priority 1: Critical/High Logic Vulnerabilities
    logic_prioritized = {}
    if isinstance(logic_vulns, dict):
        for k in ("idor_bola", "race_condition", "workflow_bypass"):
            if logic_vulns.get(k, {}).get("flagged") is True:
                logic_prioritized[k] = logic_vulns[k]
    
    # Priority 2 & 3 & 4: Nuclei & Secrets & FFuf
    nuclei_vulns = vulns.get("nuclei", []) or []
    secrets_vulns = vulns.get("secrets", []) or []
    ffuf_vulns = vulns.get("ffuf", []) or []
    normalized_logic = vulns.get("logic", []) or []

    high_crit_nuclei = [v for v in nuclei_vulns if str(v.get("severity", "")).lower() in ("critical", "high")]
    med_low_nuclei = [v for v in nuclei_vulns if str(v.get("severity", "")).lower() in ("medium", "low")]

    ports = scan_tree_data.get("ports", []) or scan_tree_data.get("open_ports", []) or []
    urls_combined = scan_tree_data.get("urls", {}).get("combined", []) or []
    http_live = scan_tree_data.get("subdomains", {}).get("http_live", []) or []

    sub_limit = 50
    url_limit = 50
    med_limit = 50

    while True:
        context_dict = {
            "target": target,
            "counts": scan_tree_data.get("counts", {}),
            "highlights": scan_tree_data.get("highlights", {}),
            "logic_vulnerabilities": logic_prioritized,
            "vulnerabilities": {
                "logic": normalized_logic,
                "nuclei_critical_high": high_crit_nuclei,
                "secrets": secrets_vulns,
                "ffuf_exposed": ffuf_vulns[:50],
                "nuclei_medium_low": med_low_nuclei[:med_limit],
            },
            "ports": ports[:30],
            "urls_sample": urls_combined[:url_limit],
            "http_live_sample": http_live[:sub_limit],
        }

        try:
            from backend.core.ai_copilot.copilot_masker import SensitiveDataMasker
            masker = SensitiveDataMasker()
            context_dict = masker.mask_dict_or_list(context_dict)
        except Exception:
            pass

        json_str = json.dumps(context_dict, ensure_ascii=False, default=str)
        if len(json_str) <= max_chars:
            return json_str

        if sub_limit > 5:
            sub_limit = max(5, sub_limit - 15)
        elif url_limit > 5:
            url_limit = max(5, url_limit - 15)
        elif med_limit > 5:
            med_limit = max(5, med_limit - 15)
        else:
            break

    minimal_context = {
        "target": target,
        "logic_vulnerabilities": logic_prioritized,
        "vulnerabilities": {
            "logic": normalized_logic,
            "nuclei_critical_high": high_crit_nuclei,
            "secrets": secrets_vulns,
        }
    }
    return json.dumps(minimal_context, ensure_ascii=False, default=str)[:max_chars]


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

    # ------------------------------------------------------------------
    # Worker Security Gate (Defense-in-depth): SSRF & Ownership Recheck
    # ------------------------------------------------------------------
    try:
        from backend.core.security.ssrf_guard import resolve_and_validate_target
        from backend.services.scan_service import ScanService
        from backend.core.engine.db import update_scan_status
    except ImportError:
        from core.security.ssrf_guard import resolve_and_validate_target
        from services.scan_service import ScanService
        from core.engine.db import update_scan_status

    try:
        origin, _ = resolve_and_validate_target(target)
    except Exception as exc:
        print(f"[{worker_id}] SSRF security block for job {job_id} target '{target}': {exc}", flush=True)
        err_msg = f"SSRF_SECURITY_BLOCK: Mục tiêu không hợp lệ hoặc nằm trong dải mạng bị hạn chế ({exc})"
        failed_result = {
            "status": "failed",
            "worker_id": worker_id,
            "target": target,
            "completed_at": time.time(),
            "error": err_msg,
            "stderr_tail": err_msg,
        }
        if redis_client:
            redis_client.set(f"job_result:{job_id}", json.dumps(failed_result))
        try:
            update_scan_status(job_id, "FAILED")
        except Exception:
            pass
        return

    user_id = str(job_data.get("user_id") or "anonymous")
    user_mock = {"id": user_id, "sub": user_id}
    if not ScanService.is_target_verified(user_mock, origin):
        print(f"[{worker_id}] Ownership verification expired/missing for job {job_id} target '{origin}' (user {user_id})", flush=True)
        err_msg = "OWNERSHIP_VERIFICATION_EXPIRED: Mục tiêu chưa được xác minh hoặc quyền sở hữu qua Meta Tag đã hết hạn trước khi worker thực thi."
        failed_result = {
            "status": "failed",
            "worker_id": worker_id,
            "target": origin,
            "completed_at": time.time(),
            "error": err_msg,
            "stderr_tail": err_msg,
        }
        if redis_client:
            redis_client.set(f"job_result:{job_id}", json.dumps(failed_result))
        try:
            update_scan_status(job_id, "FAILED")
        except Exception:
            pass
        return

    cmd = [sys.executable, "quoc_omni.py", origin]

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

    public_req_data = sanitize_request_data(req_data)
    sanitized_cmd = sanitize_extra_args(cmd)
    print(f"[{worker_id}] Executing Job {job_id} for target: {target} (cmd: {' '.join(sanitized_cmd)})", flush=True)

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

    progress_state = {
        "recon": "pending",
        "port_scan": "pending",
        "crawl": "pending",
        "nuclei": "pending",
        "secrets": "pending",
        "logic": "pending",
        "ai_remediation": "pending",
    }

    running_status = {
        "status": "running",
        "worker_id": worker_id,
        "target": target,
        "started_at": time.time(),
        "request": public_req_data,
        "stdout_tail": "",
        "stderr_tail": "",
        "current_step": 0,
        "current_stage": None,
        "progress": progress_state,
    }

    result_key = f"job_result:{job_id}"
    redis_client.set(result_key, json.dumps(running_status))

    def _publish_progress(event: Dict[str, Any]) -> None:
        key = str(event.get("key") or "").strip()
        stage_status = str(event.get("status") or "running").strip().lower()

        if key in progress_state:
            progress_state[key] = stage_status

        running_status["status"] = "running"
        running_status["progress"] = dict(progress_state)
        running_status["current_step"] = int(event.get("step") or 0)
        running_status["current_stage"] = key or None
        running_status["stage_message"] = str(event.get("message") or "")
        running_status["updated_at"] = time.time()

        payload_json = json.dumps(running_status, ensure_ascii=False)
        redis_client.set(
            result_key,
            payload_json,
        )
        try:
            redis_client.publish(f"scan_events:{job_id}", payload_json)
        except Exception:
            pass

    # Mỗi scan vẫn chạy trong process group riêng để watchdog
    # dừng được toàn bộ cây quoc_omni + nuclei/ffuf/katana/...
    scan_timeout = int(os.getenv("SCAN_JOB_TIMEOUT_SECONDS", "1800"))
    timed_out = False

    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
        env=env,
        cwd=BASE_DIR,
        start_new_session=True,
    )

    stdout_lines = []
    stderr_lines = []

    def _read_stdout() -> None:
        if proc.stdout is None:
            return

        for line in iter(proc.stdout.readline, ""):
            stdout_lines.append(line)

            marker = line.strip()
            if marker.startswith("ADQ_PROGRESS:"):
                try:
                    event = json.loads(
                        marker[len("ADQ_PROGRESS:"):]
                    )
                    if isinstance(event, dict):
                        _publish_progress(event)
                except Exception as exc:
                    print(
                        f"[{worker_id}] Invalid progress marker: {exc}",
                        flush=True,
                    )

            # Giữ log scanner hiển thị trong docker logs.
            print(
                f"[{worker_id}:scan] {line.rstrip()}",
                flush=True,
            )

    def _read_stderr() -> None:
        if proc.stderr is None:
            return

        for line in iter(proc.stderr.readline, ""):
            stderr_lines.append(line)
            print(
                f"[{worker_id}:scan:stderr] {line.rstrip()}",
                flush=True,
            )

    stdout_thread = threading.Thread(
        target=_read_stdout,
        daemon=True,
    )
    stderr_thread = threading.Thread(
        target=_read_stderr,
        daemon=True,
    )

    stdout_thread.start()
    stderr_thread.start()

    timeout_message = ""

    try:
        proc.wait(timeout=scan_timeout)

    except subprocess.TimeoutExpired:
        timed_out = True

        timeout_message = (
            f"SCAN_TIMEOUT: Job exceeded {scan_timeout} seconds "
            "and was terminated by worker watchdog."
        )

        print(
            f"[{worker_id}] {timeout_message} job_id={job_id}",
            flush=True,
        )

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
            proc.wait(timeout=10)
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

            proc.wait()

    stdout_thread.join(timeout=5)
    stderr_thread.join(timeout=5)

    out = "".join(stdout_lines)
    err = "".join(stderr_lines)

    if timeout_message:
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

    # ========================================================
    # STEP 7: Gemini AI Analysis
    # ========================================================
    fallback_advice = str(
        scan_tree_data.get("action_advice")
        or scan_tree_data.get("human_summary")
        or ""
    )

    ai_analysis = ""

    if final_status == "done":
        progress_state["ai_remediation"] = "running"
        _publish_progress({
            "step": 7,
            "key": "ai_remediation",
            "status": "running",
            "message": "Gemini đang phân tích toàn bộ kết quả bước 1-6",
        })

        if job_data.get("skip_ai"):
            ai_analysis = fallback_advice
            ai_source = "locked"
            ai_status = "locked"

        else:
            try:
                try:
                    from backend.core.ai_copilot.copilot_engine import (
                        ADQSecurityCopilot,
                    )
                except ImportError:
                    from core.ai_copilot.copilot_engine import (
                        ADQSecurityCopilot,
                    )

                copilot = ADQSecurityCopilot()

                # Cấu hình prompt context có cấu trúc, mã hóa secret và an toàn tuyệt đối với 24KB limit
                structured_context = build_ai_scan_context(scan_tree_data, max_chars=24000)

                ai_prompt = (
                    "Bạn là ADQ Security Copilot. "
                    "Hãy phân tích KẾT QUẢ QUÉT THỰC TẾ dưới đây. "
                    "Không được tự tạo finding không tồn tại trong dữ liệu. "
                    "Ưu tiên Critical/High, secrets, exposed endpoints, "
                    "logic vulnerabilities và attack surface. "
                    "Trả lời bằng tiếng Việt, gồm: "
                    "1) tổng quan rủi ro, "
                    "2) finding quan trọng, "
                    "3) nguyên nhân, "
                    "4) cách khắc phục ưu tiên theo thứ tự. "
                    f"\n\nTARGET: {target}"
                    f"\n\nSCAN_CONTEXT:\n{structured_context}"
                )

                raw_ai = copilot._call_gemini_api(ai_prompt)

                if isinstance(raw_ai, dict) and raw_ai.get("status") == "SUCCESS":
                    ai_analysis = str(
                        raw_ai.get("text")
                        or raw_ai.get("content")
                        or raw_ai.get("message")
                        or ""
                    )
                    ai_source = "gemini"
                    ai_status = "success"
                elif isinstance(raw_ai, str) and raw_ai.strip():
                    ai_analysis = raw_ai.strip()
                    ai_source = "gemini"
                    ai_status = "success"
                else:
                    err_msg = str(raw_ai.get("error") if isinstance(raw_ai, dict) else raw_ai)
                    scan_tree_data["ai_error"] = err_msg
                    ai_analysis = fallback_advice
                    ai_source = "rule_fallback"
                    ai_status = "provider_error"

            except Exception as exc:
                print(
                    f"[{worker_id}] AI analysis failed for {job_id}: {exc}",
                    flush=True,
                )
                scan_tree_data["ai_error"] = str(exc)
                ai_analysis = fallback_advice
                ai_source = "rule_fallback"
                ai_status = "provider_error"

        scan_tree_data["ai_analysis"] = ai_analysis
        scan_tree_data["recommendations"] = ai_analysis or fallback_advice
        scan_tree_data["ai_source"] = ai_source
        scan_tree_data["ai_status"] = ai_status

        progress_state["ai_remediation"] = "done"
        _publish_progress({
            "step": 7,
            "key": "ai_remediation",
            "status": "done",
            "message": "AI analysis hoàn tất",
        })

    completed_result = {
        "status": final_status,
        "worker_id": worker_id,
        "target": target,
        "pid": proc.pid,
        "returncode": proc.returncode,
        "stdout_tail": out[-4000:] if out else "",
        "stderr_tail": err[-4000:] if err else "",
        "completed_at": time.time(),
        "current_step": 7 if final_status == "done" else running_status.get("current_step", 0),
        "current_stage": "ai_remediation" if final_status == "done" else running_status.get("current_stage"),
        "progress": dict(progress_state),
    }
    # Hợp nhất toàn bộ dữ liệu quét (subdomains, vulnerabilities, action_advice) vào Redis
    completed_result.update(scan_tree_data)
    final_payload_json = json.dumps(completed_result, ensure_ascii=False, default=str)
    redis_client.set(f"job_result:{job_id}", final_payload_json)
    try:
        redis_client.publish(f"scan_events:{job_id}", final_payload_json)
    except Exception:
        pass

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

            secrets_vulns = scan_tree_data.get("vulnerabilities", {}).get("secrets", [])
            if secrets_vulns:
                save_vulnerabilities(job_id, secrets_vulns)

            logic_vulns = scan_tree_data.get("vulnerabilities", {}).get("logic", [])
            if not logic_vulns and scan_tree_data.get("logic_vulnerabilities"):
                try:
                    from backend.quoc_omni import normalize_logic_findings
                    logic_vulns = normalize_logic_findings(scan_tree_data["logic_vulnerabilities"], target)
                except Exception:
                    pass
            if logic_vulns:
                save_vulnerabilities(job_id, logic_vulns)

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


def execute_stress_job(
    job_id: str,
    job_data: Dict[str, Any],
    redis_client: redis.Redis,
    worker_id: str,
) -> None:
    user_id = str(job_data.get("user_id") or "anonymous")
    tier = str(job_data.get("tier") or "FREE").upper()
    target_url = str(job_data.get("target_url") or "")
    total_reqs = int(job_data.get("target_requests") or 1000)
    dur_sec = int(job_data.get("duration_sec") or 5)
    target_rps = int(job_data.get("target_rps") or 50)
    waf_type = str(job_data.get("waf_type") or "standard")
    bypass_code = str(job_data.get("bypass_code") or "")
    custom_headers = job_data.get("custom_headers") or {}
    custom_cookies = job_data.get("custom_cookies") or {}

    state_key = f"stress_job:{job_id}"
    event_channel = f"stress_events:{job_id}"
    started_at = time.time()

    # Step 1: Update status to RUNNING and publish event
    raw_state = redis_client.get(state_key) if redis_client else None
    public_state = json.loads(raw_state) if raw_state else {
        "job_id": job_id,
        "user_id": user_id,
        "tier": tier,
        "target_url": target_url,
        "target_requests": total_reqs,
        "duration_sec": dur_sec,
        "target_rps": target_rps,
        "waf_type": waf_type,
    }
    public_state["status"] = "RUNNING"
    public_state["started_at"] = started_at
    if redis_client:
        redis_client.set(state_key, json.dumps(public_state), ex=max(180, dur_sec + 180))
        redis_client.publish(event_channel, json.dumps({
            "job_id": job_id,
            "status": "RUNNING",
            "progress": 0,
            "metrics": public_state.get("metrics", {}),
            "timestamp": started_at,
        }))

    # Background lease renewal thread
    renew_stop = threading.Event()
    def renew_loop():
        while not renew_stop.is_set():
            try:
                from backend.core.security.stress_governor import LUA_RENEW_LEASE
            except ImportError:
                from core.security.stress_governor import LUA_RENEW_LEASE
            if redis_client:
                try:
                    user_key = f"stress_active_user:{user_id}"
                    redis_client.eval(LUA_RENEW_LEASE, 2, user_key, "stress_active_jobs", job_id, max(120, dur_sec + 60))
                except Exception:
                    pass
            renew_stop.wait(10)

    renew_thread = threading.Thread(target=renew_loop, name=f"lease-renew-{job_id}", daemon=True)
    renew_thread.start()

    try:
        # Step 2: Defense-in-depth Security Revalidation in Worker Namespace
        try:
            from backend.core.security.ssrf_guard import resolve_and_validate_target
            from backend.services.scan_service import ScanService
        except ImportError:
            from core.security.ssrf_guard import resolve_and_validate_target
            from services.scan_service import ScanService

        # SSRF revalidation & connection pinning in worker network namespace
        origin, _ = resolve_and_validate_target(target_url)

        # Ownership revalidation check
        user_mock = {"id": user_id, "sub": user_id}
        if not ScanService.is_stress_target_verified(user_mock, origin):
            raise Exception("Xác minh quyền sở hữu mục tiêu đã hết hạn hoặc không hợp lệ.")

        # Step 3: Run StressOrchestrator streaming core
        try:
            from backend.core.stress_test.stress_orchestrator import StressOrchestrator
        except ImportError:
            from core.stress_test.stress_orchestrator import StressOrchestrator

        orchestrator = StressOrchestrator()
        last_metrics = None
        last_phase = "RAMP UP"

        def is_cancelled():
            if redis_client:
                try:
                    return bool(redis_client.get(f"stress_stop:{job_id}"))
                except Exception:
                    pass
            return False

        for chunk in orchestrator.stream_stress_test(
            target_url=origin,
            target_rps=target_rps,
            duration_sec=dur_sec,
            total_reqs=total_reqs,
            bypass_code=bypass_code,
            waf_type=waf_type,
            custom_headers=custom_headers,
            custom_cookies=custom_cookies,
            stop_checker=is_cancelled,
        ):
            if is_cancelled():
                break

            if chunk.get("ok"):
                cur_metrics = chunk.get("metrics") or {}
                last_metrics = cur_metrics
                phase = chunk.get("phase") or "STEADY LOAD"
                last_phase = phase
                public_state["metrics"] = cur_metrics
                public_state["phase"] = phase
                tot = cur_metrics.get("total_requests", 0)
                prog = min(100, int(tot / max(1, total_reqs) * 100))
                public_state["progress"] = prog
                if redis_client:
                    redis_client.set(state_key, json.dumps(public_state), ex=max(180, dur_sec + 180))
                    redis_client.publish(event_channel, json.dumps({
                        "job_id": job_id,
                        "status": "RUNNING",
                        "phase": phase,
                        "progress": prog,
                        "metrics": cur_metrics,
                        "timestamp": time.time(),
                    }))

        # If user cancelled during the run
        if is_cancelled():
            print(f"[{worker_id}] Stress job {job_id} CANCELLED by user.", flush=True)
            return

        # Step 4: Mark COMPLETED and publish terminal event
        finished_at = time.time()
        public_state["status"] = "COMPLETED"
        public_state["phase"] = "COMPLETE"
        public_state["progress"] = 100
        public_state["finished_at"] = finished_at
        if last_metrics:
            public_state["metrics"] = last_metrics
            
            # Evaluate stability verdict
            err_rate = last_metrics.get("error_rate", 0.0)
            if err_rate == 0.0:
                verdict = "ỔN ĐỊNH"
            elif err_rate < 5.0:
                verdict = "CÓ DẤU HIỆU GIẢM HIỆU NĂNG"
            else:
                verdict = "KHÔNG ỔN ĐỊNH"
            public_state["verdict"] = verdict

        if redis_client:
            redis_client.set(state_key, json.dumps(public_state), ex=86400)
            redis_client.publish(event_channel, json.dumps({
                "job_id": job_id,
                "status": "COMPLETED",
                "phase": "COMPLETE",
                "progress": 100,
                "metrics": public_state.get("metrics", {}),
                "verdict": public_state.get("verdict", "ỔN ĐỊNH"),
                "done": True,
                "is_done": True,
                "timestamp": finished_at,
            }))
        print(f"[{worker_id}] Stress job {job_id} COMPLETED successfully.", flush=True)

    except Exception as exc:
        print(f"[{worker_id}] Stress job {job_id} FAILED: {exc}", flush=True)
        finished_at = time.time()
        public_state["status"] = "FAILED"
        public_state["finished_at"] = finished_at
        public_state["error_safe"] = f"Kiểm thử tải thất bại: {str(exc)}"
        if redis_client:
            redis_client.set(state_key, json.dumps(public_state), ex=86400)
            redis_client.publish(event_channel, json.dumps({
                "job_id": job_id,
                "status": "FAILED",
                "error_safe": public_state["error_safe"],
                "done": True,
                "is_done": True,
                "timestamp": finished_at,
            }))

    finally:
        renew_stop.set()
        # Step 5: Always release governor slot on worker completion
        try:
            from backend.core.security.stress_governor import StressSlotGovernor
        except ImportError:
            from core.security.stress_governor import StressSlotGovernor
        StressSlotGovernor.release_by_job(redis_client, user_id, job_id)


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

    processing_key = f"scan_processing:{worker_id}"

    worker_capabilities = [
        item.strip()
        for item in str(capability or "").split(",")
        if item.strip()
    ]

    if not worker_capabilities:
        worker_capabilities = ["recon_infra"]

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

                try:
                    stale_job = json.loads(stale_message)
                except Exception:
                    stale_job = {}

                stale_job_type = str(stale_job.get("job_type") or "").strip()
                stale_req_cap = str(stale_job.get("required_capability") or "").strip()

                if stale_job_type == "stress_test" or stale_req_cap == "stress_test":
                    # Mark FAILED and release governor (NO auto-requeue for stress jobs)
                    jid = stale_job.get("job_id")
                    if jid:
                        s_key = f"stress_job:{jid}"
                        raw_s = redis_client.get(s_key)
                        s = json.loads(raw_s) if raw_s else {}
                        s["status"] = "FAILED"
                        s["finished_at"] = time.time()
                        s["error_safe"] = "Tiến trình worker bị gián đoạn bất thường từ phiên trước."
                        redis_client.set(s_key, json.dumps(s), ex=86400)
                        try:
                            from backend.core.security.stress_governor import StressSlotGovernor
                        except ImportError:
                            from core.security.stress_governor import StressSlotGovernor
                        StressSlotGovernor.release_by_job(redis_client, uid, jid)
                    recovered += 1
                    continue

                recovery_queue = queue_for_message(stale_message)
                redis_client.lpush(recovery_queue, stale_message)
                recovered += 1

            if recovered:
                print(
                    f"[{worker_id}] Handled {recovered} unfinished job(s) "
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
                job_type = str(job_data.get("job_type") or "").strip()
                if job_type == "stress_test" or required_capability == "stress_test":
                    execute_stress_job(
                        job_id,
                        job_data,
                        redis_client,
                        worker_id,
                    )
                else:
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
