import time
import json
import uuid
from typing import Dict, Any, Optional, List
from fastapi import HTTPException, status

try:
    from backend.schemas.scan import StressRequest
    from backend.services.scan_service import ScanService, redis_client
    from backend.routers.scan_router import get_user_tier, enforce_stress_quota
    from backend.core.security.ssrf_guard import resolve_and_validate_target
    from backend.core.security.stress_governor import (
        validate_stress_runtime_limits,
        parse_duration_sec,
        StressSlotGovernor,
    )
    from backend.core.engine.db import (
        save_stress_job,
        get_stress_job,
        get_stress_jobs_by_user,
    )
except ImportError:
    from schemas.scan import StressRequest
    from services.scan_service import ScanService, redis_client
    from routers.scan_router import get_user_tier, enforce_stress_quota
    from core.security.ssrf_guard import resolve_and_validate_target
    from core.security.stress_governor import (
        validate_stress_runtime_limits,
        parse_duration_sec,
        StressSlotGovernor,
    )
    from core.engine.db import (
        save_stress_job,
        get_stress_job,
        get_stress_jobs_by_user,
    )

STRESS_QUEUE_NAME = "scan_queue:stress_test"
STRESS_JOB_KEY_PREFIX = "stress_job:"
STRESS_HISTORY_KEY_PREFIX = "stress_history:"
STRESS_STOP_KEY_PREFIX = "stress_stop:"
TERMINAL_STATE_TTL = 86400  # 24 hours

class StressDispatchService:
    @staticmethod
    def enqueue_stress_job(req: StressRequest, user: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validates security gates, acquires governor slot, writes QUEUED public state,
        and pushes internal execution payload to reliable queue scan_queue:stress_test.
        """
        tier = get_user_tier(user)
        user_id = str(user.get("id") or user.get("sub") or "anonymous")

        # Gate 0: Enforce daily quota (strictly authoritative & fail-closed)
        enforce_stress_quota(user)

        # Gate 1: SSRF Target Validation
        origin, _ = resolve_and_validate_target(req.target_url)

        # Gate 2: Ownership verification check
        if not ScanService.is_stress_target_verified(user, origin):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Mục tiêu chưa được xác minh quyền sở hữu qua Meta Tag. Vui lòng thêm thẻ meta vào <head> và bấm Xác minh trước khi thực hiện bắn tải."
            )

        # Gate 3: Runtime Limits Validation
        dur_sec = parse_duration_sec(req.duration, default=5)
        total_reqs = req.target_requests or 1000
        total_reqs, dur_sec, target_rps = validate_stress_runtime_limits(tier, total_reqs, dur_sec)

        # Gate 4: Generate Canonical Unique Job ID
        job_id = f"stress_{uuid.uuid4().hex[:16]}"

        # Gate 5: Acquire Redis Governor Reservation (with queue lease TTL)
        governor = StressSlotGovernor(
            redis_client=redis_client,
            user_id=user_id,
            duration_sec=dur_sec,
            job_id=job_id,
            is_queue=True,
        )
        governor.acquire()

        try:
            # Step 6: Create initial Public Job State in Redis (Contains NO secrets/tokens)
            public_state = {
                "job_id": job_id,
                "user_id": user_id,
                "tier": tier,
                "target_url": origin,
                "target_requests": total_reqs,
                "duration_sec": dur_sec,
                "target_rps": target_rps,
                "waf_type": req.waf_type or "standard",
                "status": "QUEUED",
                "phase": "PREPARE",
                "progress": 0,
                "metrics": {
                    "total_requests": 0,
                    "target_requests": total_reqs,
                    "target_rps": target_rps,
                    "status_200": 0,
                    "status_403_waf_blocked": 0,
                    "status_429_rate_limited": 0,
                    "status_500_crashed": 0,
                    "other_status": 0,
                    "rps": 0.0,
                    "p50_latency": "0ms",
                    "p95_latency": "0ms",
                    "p99_latency": "0ms",
                    "avg_latency": "0ms",
                    "error_rate": 0.0,
                    "timeouts": 0,
                },
                "events": [
                    {"time": time.strftime("%H:%M:%S"), "message": "Phiên kiểm thử tải đã được khởi tạo và xếp hàng."}
                ],
                "created_at": time.time(),
                "started_at": None,
                "finished_at": None,
                "error_safe": None,
            }
            if redis_client:
                redis_client.set(
                    f"{STRESS_JOB_KEY_PREFIX}{job_id}",
                    json.dumps(public_state),
                    ex=max(180, dur_sec + 180),
                )
                # Append to user's history list
                hist_key = f"{STRESS_HISTORY_KEY_PREFIX}{user_id}"
                redis_client.lpush(hist_key, job_id)
                redis_client.ltrim(hist_key, 0, 49)

            # Persist initial job record in PostgreSQL
            try:
                save_stress_job(public_state)
            except Exception as e:
                print(f"[StressDispatch] Warning: DB initial save failed: {e}", flush=True)

            # Step 7: Build internal execution payload (Allowed to have execution secrets)
            execution_payload = {
                "job_id": job_id,
                "job_type": "stress_test",
                "required_capability": "stress_test",
                "user_id": user_id,
                "tier": tier,
                "target_url": origin,
                "target_requests": total_reqs,
                "duration_sec": dur_sec,
                "target_rps": target_rps,
                "waf_type": req.waf_type or "standard",
                "bypass_code": req.bypass_code or "",
                "custom_headers": req.custom_headers or {},
                "custom_cookies": req.custom_cookies or {},
                "created_at": time.time(),
            }

            # Step 8: Push to Redis Reliable Queue
            if redis_client:
                redis_client.rpush(STRESS_QUEUE_NAME, json.dumps(execution_payload))

            return {
                "ok": True,
                "job_id": job_id,
                "status": "QUEUED",
                "message": "Tiến trình kiểm thử tải đã được đưa vào hàng đợi xử lý.",
            }

        except HTTPException:
            governor.release()
            raise
        except Exception as exc:
            # On enqueue failure: release governor reservation immediately
            governor.release()
            if redis_client:
                try:
                    redis_client.delete(f"{STRESS_JOB_KEY_PREFIX}{job_id}")
                except Exception:
                    pass
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Không thể đưa tiến trình vào hàng đợi: {str(exc)}"
            )

    @staticmethod
    def get_stress_job_state(job_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves sanitized public job state.
        Checks Redis first (active / recent state).
        Falls back to PostgreSQL (durable permanent state).
        """
        if not job_id:
            return None

        # 1. Check Redis for active/cached state
        if redis_client:
            try:
                raw = redis_client.get(f"{STRESS_JOB_KEY_PREFIX}{job_id}")
                if raw:
                    return json.loads(raw)
            except Exception:
                pass

        # 2. Fallback to PostgreSQL durable record
        try:
            db_state = get_stress_job(job_id)
            if db_state:
                return db_state
        except Exception as exc:
            print(f"[StressDispatch] Warning: DB get failed for {job_id}: {exc}", flush=True)

        return None

    @staticmethod
    def stop_stress_job(job_id: str, user_id: str) -> Dict[str, Any]:
        """Gracefully stops a running or queued stress job and releases governor locks."""
        state = StressDispatchService.get_stress_job_state(job_id)
        if not state:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy tiến trình kiểm thử tải.")

        if str(state.get("user_id")) != str(user_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn không có quyền dừng tiến trình này.")

        if state.get("status") in ("COMPLETED", "FAILED", "CANCELLED"):
            return {"ok": True, "job_id": job_id, "status": state.get("status"), "message": "Tiến trình đã kết thúc trước đó."}

        # Set stop flag in Redis for worker polling
        if redis_client:
            try:
                redis_client.set(f"{STRESS_STOP_KEY_PREFIX}{job_id}", "1", ex=300)
            except Exception:
                pass

        finished_at = time.time()
        state["status"] = "CANCELLED"
        state["phase"] = "COMPLETE"
        state["finished_at"] = finished_at
        state["error_safe"] = "Tiến trình kiểm thử đã dừng theo yêu cầu của người dùng."

        events = state.get("events") or []
        events.append({"time": time.strftime("%H:%M:%S"), "message": "Người dùng yêu cầu Dừng kiểm thử tải."})
        state["events"] = events

        if redis_client:
            try:
                redis_client.set(f"{STRESS_JOB_KEY_PREFIX}{job_id}", json.dumps(state), ex=86400)
                event_channel = f"stress_events:{job_id}"
                redis_client.publish(event_channel, json.dumps({
                    "job_id": job_id,
                    "status": "CANCELLED",
                    "phase": "COMPLETE",
                    "progress": state.get("progress", 0),
                    "metrics": state.get("metrics", {}),
                    "events": events,
                    "done": True,
                    "is_done": True,
                    "timestamp": finished_at,
                    "message": "Kiểm thử đã dừng bởi người dùng.",
                }))
            except Exception:
                pass

        # Persist terminal CANCELLED state to PostgreSQL
        try:
            save_stress_job(state)
        except Exception as exc:
            print(f"[StressDispatch] Warning: DB save CANCELLED state failed: {exc}", flush=True)

        # Release governor slot
        try:
            StressSlotGovernor.release_by_job(redis_client, user_id, job_id)
        except Exception:
            pass

        return {"ok": True, "job_id": job_id, "status": "CANCELLED", "message": "Đã dừng tiến trình kiểm thử tải thành công."}

    @staticmethod
    def get_user_stress_history(user_id: str) -> List[Dict[str, Any]]:
        """
        Returns the list of historical stress test job snapshots for the user.
        Merges PostgreSQL durable records with active Redis keys, sorted newest first.
        """
        if not user_id:
            return []

        history_map: Dict[str, Dict[str, Any]] = {}

        # 1. Fetch durable historical records from PostgreSQL
        try:
            pg_jobs = get_stress_jobs_by_user(user_id, limit=50)
            for job in pg_jobs:
                if job.get("job_id"):
                    history_map[job["job_id"]] = job
        except Exception as exc:
            print(f"[StressDispatch] Warning: DB history query failed: {exc}", flush=True)

        # 2. Fetch active / recent records from Redis
        if redis_client:
            try:
                hist_key = f"{STRESS_HISTORY_KEY_PREFIX}{user_id}"
                job_ids = redis_client.lrange(hist_key, 0, 49) or []
                for jid in job_ids:
                    try:
                        raw = redis_client.get(f"{STRESS_JOB_KEY_PREFIX}{jid}")
                        if raw:
                            r_state = json.loads(raw)
                            history_map[jid] = r_state
                    except Exception:
                        pass
            except Exception as exc:
                print(f"[StressDispatch] Warning: Redis history query failed: {exc}", flush=True)

        # 3. Sort by created_at descending
        merged = list(history_map.values())
        merged.sort(key=lambda x: float(x.get("created_at") or 0), reverse=True)
        return merged[:30]



