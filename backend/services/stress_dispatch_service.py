import time
import json
import uuid
from typing import Dict, Any, Optional
from fastapi import HTTPException, status

try:
    from backend.schemas.scan import StressRequest
    from backend.services.scan_service import ScanService, redis_client
    from backend.routers.scan_router import get_user_tier
    from backend.core.security.ssrf_guard import resolve_and_validate_target
    from backend.core.security.stress_governor import (
        validate_stress_runtime_limits,
        parse_duration_sec,
        StressSlotGovernor,
    )
except ImportError:
    from schemas.scan import StressRequest
    from services.scan_service import ScanService, redis_client
    from routers.scan_router import get_user_tier
    from core.security.ssrf_guard import resolve_and_validate_target
    from core.security.stress_governor import (
        validate_stress_runtime_limits,
        parse_duration_sec,
        StressSlotGovernor,
    )

STRESS_QUEUE_NAME = "scan_queue:stress_test"
STRESS_JOB_KEY_PREFIX = "stress_job:"
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
                    "p95_latency": "0ms",
                },
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
        """Retrieves sanitized public job state from Redis."""
        if not redis_client or not job_id:
            return None
        try:
            raw = redis_client.get(f"{STRESS_JOB_KEY_PREFIX}{job_id}")
            if raw:
                return json.loads(raw)
        except Exception:
            pass
        return None

