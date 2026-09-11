from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
import json
from pydantic import BaseModel
from typing import Dict, Any, Optional
from datetime import datetime, date, timezone

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


def parse_iso_datetime(value: Any) -> Optional[datetime]:
    """
    Chuyển đổi chuỗi ISO timestamp thành datetime có timezone UTC an toàn.
    """
    if not value:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(value, tz=timezone.utc)
        except Exception:
            return None
    if isinstance(value, str):
        val = value.strip()
        if not val:
            return None
        try:
            # Chuẩn hóa ký tự Z thành +00:00 cho tương thích
            dt = datetime.fromisoformat(val.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except Exception:
            return None
    return None


def get_effective_user_tier(user: Dict[str, Any]) -> str:
    """
    Authoritative Effective Package Tier Resolver.

    1. Trích xuất raw package tier từ app_metadata (vùng server-managed) hoặc user root.
    2. Nếu tier là FREE: luôn giữ FREE.
    3. Nếu tier là PRO hoặc PRO_MAX:
       - Trích xuất planExpiresAt từ app_metadata, user hoặc user_metadata.
       - Nếu có planExpiresAt: parse ISO timestamp và so sánh với datetime.now(timezone.utc).
         + Nếu đã hết hạn (planExpiresAt <= now): Tự động hạ về FREE (Fail-closed).
         + Nếu chuỗi expiry bị malformed/không thể parse: Fail-closed hạ về FREE.
         + Nếu còn hạn: Giữ nguyên PRO / PRO_MAX.
       - Nếu không có planExpiresAt (ví dụ gói vĩnh viễn hoặc dev mock): Giữ nguyên PRO / PRO_MAX.
    """
    app_metadata = user.get("app_metadata") or {}
    user_metadata = user.get("user_metadata") or {}

    raw_tier = (
        app_metadata.get("packageTier")
        or app_metadata.get("package_tier")
        or user.get("packageTier")
        or user.get("package_tier")
        or user_metadata.get("packageTier")
        or "FREE"
    )

    tier = str(raw_tier).strip().upper()
    if tier not in {"PRO", "PRO_MAX"}:
        return "FREE"

    # Trích xuất hạn dùng planExpiresAt
    raw_expiry = (
        app_metadata.get("planExpiresAt")
        or app_metadata.get("plan_expires_at")
        or user.get("planExpiresAt")
        or user.get("plan_expires_at")
        or user_metadata.get("planExpiresAt")
        or user_metadata.get("plan_expires_at")
    )

    if raw_expiry is not None:
        if isinstance(raw_expiry, str) and not raw_expiry.strip():
            # Chuỗi rỗng: không có hạn cụ thể
            pass
        else:
            expiry_dt = parse_iso_datetime(raw_expiry)
            if expiry_dt is None:
                # Malformed timestamp string provided -> fail-closed về FREE
                return "FREE"

            now_utc = datetime.now(timezone.utc)
            if expiry_dt <= now_utc:
                return "FREE"

    return tier


def get_user_tier(user: Dict[str, Any]) -> str:
    """
    Resolver tương thích toàn cục gọi get_effective_user_tier.
    """
    return get_effective_user_tier(user)


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

    # 1. Gate 1: SSRF Target Validation & Canonicalization
    origin, _ = resolve_and_validate_target(req.target)

    # 2. Gate 2: Mandatory Ownership Verification Check
    if not ScanService.is_target_verified(user, origin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Mục tiêu chưa được xác minh quyền sở hữu qua Meta Tag. Vui lòng thêm thẻ meta vào <head> và bấm Xác minh trước khi thực hiện quét an ninh."
        )

    # 3. Kiểm tra giới hạn Quét DAST
    if tier == "FREE":
        if usage["total_lifetime_scans"] >= 2:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="LIMIT_REACHED: Bạn đã sử dụng hết 2 lượt quét miễn phí. Vui lòng nâng cấp gói PRO để quét không giới hạn."
            )
        usage["total_lifetime_scans"] += 1
    
    usage["scans_count"] += 1

    # 4. Tạo job quét với canonical origin & user_id (Gói FREE: skip_ai = True để tiết kiệm 100% token)
    skip_ai = (tier == "FREE")
    job = ScanService.create_scan_job(req, canonical_target=origin, user_id=user_id, skip_ai=skip_ai)
    
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
    tier = get_user_tier(user)
    job = ScanService.get_job_status(job_id, user_tier=tier)
    
    if job and isinstance(job, dict):
        job = dict(job)
        if isinstance(job.get("request"), dict):
            from backend.schemas.scan import sanitize_request_data
            job["request"] = sanitize_request_data(job["request"])
        if tier == "FREE":
            job["ai_locked"] = True
            job["ai_summary"] = None
    
    return {"ok": True, "job": job}


@router.get("/scan/{job_id}/assurance")
def get_scan_assurance(job_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    tier = get_user_tier(user)
    job = ScanService.get_job_status(job_id, user_tier=tier)
    assurance = job.get("assurance_matrix")
    if not assurance:
        try:
            try:
                from backend.security_controls.assurance_engine import evaluate_scan_assurance
            except ImportError:
                from security_controls.assurance_engine import evaluate_scan_assurance
            assurance = evaluate_scan_assurance(job, user_tier=tier)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Assurance evaluation error: {exc}")

    return {"ok": True, "job_id": job_id, "assurance": assurance}


@router.post("/scan/{job_id}/ai-assessment")
def get_or_generate_ai_assessment(
    job_id: str,
    user: Dict[str, Any] = Depends(get_current_user),
):
    tier = get_user_tier(user)
    return ScanService.get_or_generate_scan_ai_assessment(job_id, user_tier=tier, force_refresh=True)


@router.get("/scan/{job_id}/ai-assessment")
def get_cached_ai_assessment(
    job_id: str,
    user: Dict[str, Any] = Depends(get_current_user),
):
    tier = get_user_tier(user)
    return ScanService.get_or_generate_scan_ai_assessment(job_id, user_tier=tier, force_refresh=False)


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

@router.post("/verification/status")
@router.get("/verification/status")
@router.post("/scan/verification/status")
@router.get("/scan/verification/status")
def get_verification_status_route(
    target_url: Optional[str] = None,
    req: Optional[StressVerificationRequest] = None,
    user: Dict[str, Any] = Depends(get_current_user),
):
    target = req.target_url if (req and req.target_url) else target_url
    if not target:
        raise HTTPException(status_code=400, detail="Missing target_url parameter.")
    return ScanService.get_target_verification_status(user, target)

@router.post("/verification/start")
@router.post("/scan/verification/start")
def start_verification_route(req: StressVerificationRequest, user: Dict[str, Any] = Depends(get_current_user)):
    return ScanService.start_target_verification(user, req.target_url)

@router.post("/verification/check")
@router.post("/scan/verification/check")
def check_verification_route(req: StressVerificationRequest, user: Dict[str, Any] = Depends(get_current_user)):
    return ScanService.check_target_verification(user, req.target_url)

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

@router.get("/scan/{job_id}/stream")
async def stream_scan_job_events(job_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    """
    SSE relay for live scan pipeline progress, stage updates, and control assurance state.
    """
    tier = get_user_tier(user)
    initial_check = ScanService.get_job_status(job_id, user_tier=tier)
    if not initial_check:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy tiến trình quét an ninh.")

    async def sse_scan_relay():
        pubsub = None
        channel = f"scan_events:{job_id}"
        if redis_client:
            try:
                pubsub = redis_client.pubsub()
                pubsub.subscribe(channel)
            except Exception:
                pubsub = None

        try:
            # 1. Snapshot-first: Read current snapshot after subscription
            snapshot = ScanService.get_job_status(job_id, user_tier=tier)
            if snapshot:
                yield f"data: {json.dumps(snapshot, default=str)}\n\n"
                if str(snapshot.get("status", "")).upper() in ("COMPLETED", "FAILED"):
                    return

            # 2. Consume live events from Redis Pub/Sub
            while True:
                has_msg = False
                if pubsub:
                    try:
                        msg = pubsub.get_message(ignore_subscribe_messages=True, timeout=0.05)
                        if msg and msg.get("type") == "message":
                            data_str = msg.get("data")
                            event_data = json.loads(data_str)
                            # Augment event with assurance matrix
                            try:
                                try:
                                    from backend.security_controls.assurance_engine import evaluate_scan_assurance
                                except ImportError:
                                    from security_controls.assurance_engine import evaluate_scan_assurance
                                event_data["assurance_matrix"] = evaluate_scan_assurance(event_data, user_tier=tier)
                            except Exception:
                                pass
                            yield f"data: {json.dumps(event_data, default=str)}\n\n"
                            has_msg = True
                            if str(event_data.get("status", "")).upper() in ("COMPLETED", "FAILED", "DONE"):
                                break
                    except Exception:
                        pass

                if not has_msg:
                    cur_st = ScanService.get_job_status(job_id, user_tier=tier)
                    if cur_st and str(cur_st.get("status", "")).upper() in ("COMPLETED", "FAILED"):
                        yield f"data: {json.dumps(cur_st, default=str)}\n\n"
                        break
                    await asyncio.sleep(0.5)

        finally:
            if pubsub:
                try:
                    pubsub.unsubscribe(channel)
                    pubsub.close()
                except Exception:
                    pass

    return StreamingResponse(
        sse_scan_relay(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )

