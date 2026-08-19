import json
from fastapi import APIRouter, Depends, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Dict, Any
from backend.schemas.scan import (
    ScanRequest,
    ScanResponse,
    CopilotChatRequest,
    StressRequest,
    WafDetectRequest,
)
from backend.services.scan_service import ScanService
from backend.core.stress_test.stress_orchestrator import StressOrchestrator
from backend.core.auth import get_current_user

router = APIRouter(prefix="/api", tags=["Scans & Copilot"])

class EndpointDiscoveryRequest(BaseModel):
    target_url: str

class VerifyBypassRequest(BaseModel):
    target_url: str
    bypass_code: str
    waf_type: str = "standard"

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

@router.post("/stress/discover-endpoints")
def discover_endpoints(req: EndpointDiscoveryRequest, user: Dict[str, Any] = Depends(get_current_user)):
    res = ScanService.discover_endpoints(req.target_url)
    return res

@router.post("/stress/detect-waf")
def detect_waf(req: WafDetectRequest, user: Dict[str, Any] = Depends(get_current_user)):
    res = ScanService.detect_waf(req)
    return res

@router.post("/stress/verify-bypass")
def verify_bypass(req: VerifyBypassRequest, user: Dict[str, Any] = Depends(get_current_user)):
    orchestrator = StressOrchestrator()
    res = orchestrator.verify_bypass(target_url=req.target_url, bypass_code=req.bypass_code, waf_type=req.waf_type)
    return res

@router.post("/stress/stream")
def run_stress_test_stream(req: StressRequest, user: Dict[str, Any] = Depends(get_current_user)):
    orchestrator = StressOrchestrator()
    def event_stream():
        for chunk in orchestrator.execute_stress_test_stream(
            target_url=req.target_url,
            target_requests=req.target_requests or 1000,
            duration=req.duration or "5s",
            bypass_code=req.bypass_code or "",
            waf_type=req.waf_type or "standard",
        ):
            yield f"data: {json.dumps(chunk)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
