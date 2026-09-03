from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
import json
from pydantic import BaseModel
from typing import Dict, Any, Optional
from datetime import datetime, date

from backend.schemas.scan import (
    ScanRequest,
    ScanResponse,
    CopilotChatRequest,
    StressRequest,
    WafDetectRequest,
    StressVerificationRequest,
)
from backend.services.scan_service import ScanService, redis_client
from backend.core.stress_test.stress_orchestrator import StressOrchestrator
from backend.core.auth import get_current_user
from backend.core.security.ssrf_guard import resolve_and_validate_target
from backend.core.security.stress_governor import (
    validate_stress_runtime_limits,
    parse_duration_sec,
    StressSlotGovernor,
    STRESS_TIER_LIMITS,
    MAX_CONCURRENT_GLOBAL,
)

router = APIRouter(prefix="/api", tags=["Scans & Copilot"])

# Bộ nhớ tạm theo dõi quota theo ngày cho user
USAGE_TRACKER: Dict[str, Dict[str, Any]] = {}

def get_user_usage(user_id: str) -> Dict[str, Any]:
    today = date.today().isoformat()
    if user_id not in USAGE_TRACKER or USAGE_TRACKER[user_id].get("date") != today:
        USAGE_TRACKER[user_id] = {
            "date": today,
            "scans_count": 0,
            "stress_count": 0,
            "total_lifetime_scans": USAGE_TRACKER.get(user_id, {}).get("total_lifetime_scans", 0)
        }
    return USAGE_TRACKER[user_id]


def get_user_tier(user: Dict[str, Any]) -> str:
    """
    Package claim resolver.

    Ưu tiên app_metadata vì đây là vùng metadata do server quản lý.
    packageTier top-level được giữ để tương thích JWT/custom claim hiện tại.
    user_metadata chỉ là fallback legacy, không phải nguồn entitlement chính.
    """
    app_metadata = user.get("app_metadata") or {}
    user_metadata = user.get("user_metadata") or {}

    tier = (
        app_metadata.get("packageTier")
        or app_metadata.get("package_tier")
        or user.get("packageTier")
        or user.get("package_tier")
        or user_metadata.get("packageTier")
        or "FREE"
    )

    tier = str(tier).upper()

    if tier == "PRO_MAX":
        return "PRO_MAX"
    if tier == "PRO":
        return "PRO"

    return "FREE"


def enforce_stress_quota(user: Dict[str, Any]) -> tuple[str, Dict[str, Any]]:
    user_id = str(user.get("id") or user.get("sub") or "anonymous")
    tier = get_user_tier(user)
    usage = get_user_usage(user_id)

    if tier == "FREE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="TIER_LOCKED: Gói FREE không hỗ trợ Stress Test."
        )

    limit = 1 if tier == "PRO" else 10

    if usage["stress_count"] >= limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "DAILY_LIMIT: Gói PRO giới hạn 1 lượt Stress Test/ngày."
                if tier == "PRO"
                else "DAILY_LIMIT: Bạn đã sử dụng hết 10 lượt Stress Test trong ngày."
            )
        )

    usage["stress_count"] += 1
    return tier, usage

class EndpointDiscoveryRequest(BaseModel):
    target_url: str

class VerifyBypassRequest(BaseModel):
    target_url: str
    bypass_code: str
    waf_type: Optional[str] = "standard"


class CopilotAnalyzeRequest(BaseModel):
    job_id: str


class CopilotPatchRequest(BaseModel):
    vulnerability_type: str
    endpoint: str
    framework: Optional[str] = "Next.js"

@router.post("/scan", response_model=ScanResponse, status_code=status.HTTP_201_CREATED)
def start_scan(req: ScanRequest, user: Dict[str, Any] = Depends(get_current_user)):
    user_id = str(user.get("id") or user.get("sub") or "anonymous")
    tier = get_user_tier(user)
    usage = get_user_usage(user_id)

    # 1. Kiểm tra giới hạn Quét DAST
    if tier == "FREE":
        if usage["total_lifetime_scans"] >= 2:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="LIMIT_REACHED: Bạn đã sử dụng hết 2 lượt quét miễn phí. Vui lòng nâng cấp gói PRO để quét không giới hạn."
            )
        usage["total_lifetime_scans"] += 1
    
    usage["scans_count"] += 1

    # 2. Tạo job quét (Gói FREE: skip_ai = True để tiết kiệm 100% token)
    skip_ai = (tier == "FREE")
    job = ScanService.create_scan_job(req, skip_ai=skip_ai)
    
    return ScanResponse(
        ok=True,
        job_id=job["job_id"],
        target=job["target"],
        status=job["status"],
        message="Scan job queued successfully" if not skip_ai else "Scan job queued (Free tier: AI Analysis skipped)",
    )

@router.get("/scan/{job_id}/endpoints")
def get_scan_endpoints_route(
    job_id: str,
    user: Dict[str, Any] = Depends(get_current_user),
):
    try:
        from backend.core.engine.db import get_scan_endpoints
    except ImportError:
        from core.engine.db import get_scan_endpoints

    job = ScanService.get_job_status(job_id)

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan job not found",
        )

    endpoints = get_scan_endpoints(job_id)

    return {
        "ok": True,
        "job_id": job_id,
        "total": len(endpoints),
        "endpoints": endpoints,
    }


@router.get("/scan/{job_id}")
def get_scan_status(job_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    job = ScanService.get_job_status(job_id)
    tier = get_user_tier(user)
    
    # Đối với gói FREE, không trả về nội dung AI thật mà trả cờ khóa
    if tier == "FREE" and job:
        job = dict(job)
        job["ai_locked"] = True
        job["ai_summary"] = None
    
    return {"ok": True, "job": job}

@router.post("/copilot/chat")
def copilot_chat(req: CopilotChatRequest, user: Dict[str, Any] = Depends(get_current_user)):
    tier = get_user_tier(user)
    
    # Chỉ gói PRO_MAX mới được tương tác Copilot Chat
    if tier != "PRO_MAX":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="TIER_LOCKED: Tính năng tương tác trực tiếp với Agentic AI Copilot chỉ dành riêng cho gói PRO MAX."
        )
        
    res = ScanService.copilot_chat(req)
    return {"ok": True, **res}

@router.post("/copilot/analyze")
def copilot_analyze(
    req: CopilotAnalyzeRequest,
    user: Dict[str, Any] = Depends(get_current_user),
):
    if get_user_tier(user) != "PRO_MAX":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="TIER_LOCKED: Copilot Analyze chỉ dành cho gói PRO MAX."
        )

    return ScanService.copilot_analyze(req.job_id)


@router.post("/copilot/patch")
def copilot_patch(
    req: CopilotPatchRequest,
    user: Dict[str, Any] = Depends(get_current_user),
):
    if get_user_tier(user) != "PRO_MAX":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="TIER_LOCKED: One-Click Patch chỉ dành cho gói PRO MAX."
        )

    return ScanService.copilot_patch(
        vulnerability_type=req.vulnerability_type,
        endpoint=req.endpoint,
        framework=req.framework or "Next.js",
    )


@router.post("/stress/discover-endpoints")
def discover_endpoints(req: EndpointDiscoveryRequest, user: Dict[str, Any] = Depends(get_current_user)):
    tier = get_user_tier(user)
    if tier == "FREE":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Gói FREE không hỗ trợ Stress Test.")
    origin, _ = resolve_and_validate_target(req.target_url)
    return ScanService.discover_endpoints(origin)

@router.post("/stress/detect-waf")
def detect_waf(req: WafDetectRequest, user: Dict[str, Any] = Depends(get_current_user)):
    tier = get_user_tier(user)
    if tier == "FREE":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Gói FREE không hỗ trợ Stress Test.")
    return ScanService.detect_waf(req)

@router.post("/stress/verification/start")
def start_stress_verification(req: StressVerificationRequest, user: Dict[str, Any] = Depends(get_current_user)):
    tier = get_user_tier(user)
    if tier == "FREE":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Gói FREE không hỗ trợ Stress Test.")
    return ScanService.start_stress_verification(user, req.target_url)

@router.post("/stress/verification/check")
def check_stress_verification(req: StressVerificationRequest, user: Dict[str, Any] = Depends(get_current_user)):
    tier = get_user_tier(user)
    if tier == "FREE":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Gói FREE không hỗ trợ Stress Test.")
    return ScanService.check_stress_verification(user, req.target_url)

@router.post("/stress/verify-bypass")
def verify_bypass(req: VerifyBypassRequest, user: Dict[str, Any] = Depends(get_current_user)):
    tier = get_user_tier(user)
    if tier == "FREE":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Gói FREE không hỗ trợ Stress Test.")
    origin, _ = resolve_and_validate_target(req.target_url)
    orchestrator = StressOrchestrator()
    return orchestrator.verify_bypass(target_url=origin, bypass_code=req.bypass_code, waf_type=req.waf_type or "standard")




try:
    from backend.services.stress_dispatch_service import StressDispatchService
except ImportError:
    from services.stress_dispatch_service import StressDispatchService

@router.post("/stress/jobs", status_code=status.HTTP_202_ACCEPTED)
def dispatch_stress_job(req: StressRequest, user: Dict[str, Any] = Depends(get_current_user)):
    """
    Phase 2B: Async stress job dispatch to dedicated worker queue.
    """
    res = StressDispatchService.enqueue_stress_job(req, user)
    return res


@router.get("/stress/{job_id}")
def get_stress_job_snapshot(job_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    """
    Retrieves the current public state snapshot of a stress job (0 secrets).
    """
    user_id = str(user.get("id") or user.get("sub") or "anonymous")
    state = StressDispatchService.get_stress_job_state(job_id)
    if not state:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy tiến trình kiểm thử tải.")

    # Multi-user authorization check
    if str(state.get("user_id")) != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn không có quyền truy cập tiến trình này.")

    return state


import asyncio

@router.get("/stress/{job_id}/stream")
async def stream_stress_job_events(job_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    """
    SSE relay with race-safe subscribe + snapshot-first + reconnect support.
    Does NOT touch governor slots (managed independently by worker).
    """
    user_id = str(user.get("id") or user.get("sub") or "anonymous")
    initial_check = StressDispatchService.get_stress_job_state(job_id)
    if not initial_check:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy tiến trình kiểm thử tải.")

    if str(initial_check.get("user_id")) != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn không có quyền truy cập tiến trình này.")

    async def sse_relay():
        pubsub = None
        channel = f"stress_events:{job_id}"
        if redis_client:
            try:
                pubsub = redis_client.pubsub()
                pubsub.subscribe(channel)
            except Exception:
                pubsub = None

        try:
            # 1. Snapshot-first: Read current snapshot after subscription
            snapshot = StressDispatchService.get_stress_job_state(job_id)
            if snapshot:
                yield f"data: {json.dumps(snapshot)}\n\n"
                if snapshot.get("status") in ("COMPLETED", "FAILED"):
                    return

            # 2. Consume live events from Redis Pub/Sub with periodic snapshot check
            while True:
                has_msg = False
                if pubsub:
                    try:
                        msg = pubsub.get_message(ignore_subscribe_messages=True, timeout=0.05)
                        if msg and msg.get("type") == "message":
                            data_str = msg.get("data")
                            event_data = json.loads(data_str)
                            yield f"data: {json.dumps(event_data)}\n\n"
                            has_msg = True
                            if event_data.get("status") in ("COMPLETED", "FAILED") or event_data.get("done"):
                                break
                    except Exception:
                        pass

                if not has_msg:
                    cur_st = StressDispatchService.get_stress_job_state(job_id)
                    if cur_st and cur_st.get("status") in ("COMPLETED", "FAILED"):
                        yield f"data: {json.dumps(cur_st)}\n\n"
                        break
                    await asyncio.sleep(0.2)

        finally:
            if pubsub:
                try:
                    pubsub.unsubscribe(channel)
                    pubsub.close()
                except Exception:
                    pass

    return StreamingResponse(
        sse_relay(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )
