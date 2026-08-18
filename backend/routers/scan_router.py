from fastapi import APIRouter, Depends, status
from typing import Dict, Any
from backend.schemas.scan import (
    ScanRequest,
    ScanResponse,
    CopilotChatRequest,
    CopilotAnalyzeRequest,
    CopilotPatchRequest,
    StressRequest,
    WafDetectRequest,
    ApkRequest,
)
from backend.services.scan_service import ScanService
from backend.core.auth import get_current_user

router = APIRouter(prefix="/api", tags=["Scans & Copilot"])

@router.post("/scan", response_model=ScanResponse, status_code=status.HTTP_201_CREATED)
def start_scan(req: ScanRequest, user: Dict[str, Any] = Depends(get_current_user)):
    job = ScanService.create_scan_job(req)
    return ScanResponse(
        ok=True,
        job_id=job["job_id"],
        target=job["target"],
        status=job["status"],
        message="Scan job queued successfully",
    )

@router.get("/scan/{job_id}")
def get_scan_status(job_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    job = ScanService.get_job_status(job_id)
    return {"ok": True, "job": job}

@router.post("/copilot/chat")
def copilot_chat(req: CopilotChatRequest, user: Dict[str, Any] = Depends(get_current_user)):
    res = ScanService.copilot_chat(req)
    return {"ok": True, **res}

@router.post("/stress/detect-waf")
def detect_waf(req: WafDetectRequest, user: Dict[str, Any] = Depends(get_current_user)):
    res = ScanService.detect_waf(req)
    return res

@router.post("/stress")
def run_stress_test(req: StressRequest, user: Dict[str, Any] = Depends(get_current_user)):
    res = ScanService.run_stress_test(req)
    return res

@router.post("/apk")
def run_apk_audit(req: ApkRequest, user: Dict[str, Any] = Depends(get_current_user)):
    res = ScanService.run_apk_audit(req)
    return {"ok": True, **res}
