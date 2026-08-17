from fastapi import APIRouter, Depends, status
from typing import Dict, Any, List
from backend.schemas.scan import (
    ScanRequest,
    ScanResponse,
    CopilotChatRequest,
    CopilotAnalyzeRequest,
    CopilotPatchRequest,
    StressRequest,
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


@router.get("/scans")
def list_scans(user: Dict[str, Any] = Depends(get_current_user)):
    scans = ScanService.list_scans()
    return {"ok": True, "scans": scans}


@router.get("/scan/{job_id}")
def get_scan_status(job_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    job = ScanService.get_job_status(job_id)
    return {"ok": True, "job": job}


@router.get("/dashboard/overview")
def get_dashboard_overview(user: Dict[str, Any] = Depends(get_current_user)):
    return {
        "ok": True,
        "overview": {
            "metrics": {
                "totalTargets": {"label": "Total Targets", "value": 12, "change": "+2"},
                "totalVulnerabilities": {"label": "Vulnerabilities", "value": 48, "change": "-5"},
                "totalAssets": {"label": "Active Assets", "value": 156, "change": "+12"},
                "subdomains": {"label": "Subdomains", "value": 320, "change": "+18"},
            },
            "vulnerabilityTrend": [],
            "techStackDistribution": [],
            "riskPriorityTable": [],
            "realtime": {
                "activeScans": 1,
                "queueDepth": 0,
                "successRate": 98.5,
                "lastUpdatedAt": "2026-08-17T00:00:00Z",
            },
            "recentActivity": [],
        },
        "adminStats": {
            "cpuUsage": 22.5,
            "ramUsage": 45.1,
            "backendNodes": 3,
            "totalUsers": 120,
            "totalScans": 1420,
            "runningScans": 1,
        },
    }


@router.post("/copilot/chat")
def copilot_chat(req: CopilotChatRequest, user: Dict[str, Any] = Depends(get_current_user)):
    res = ScanService.copilot_chat(req)
    return {"ok": True, **res}


@router.post("/copilot/analyze")
def copilot_analyze(req: CopilotAnalyzeRequest, user: Dict[str, Any] = Depends(get_current_user)):
    res = ScanService.copilot_analyze(req)
    return {"ok": True, **res}


@router.post("/copilot/patch")
def copilot_patch(req: CopilotPatchRequest, user: Dict[str, Any] = Depends(get_current_user)):
    res = ScanService.copilot_patch(req)
    return {"ok": True, **res}


@router.get("/copilot/credits")
def copilot_credits(user: Dict[str, Any] = Depends(get_current_user)):
    return {
        "ok": True,
        "credit_balance": 10000,
        "tier": "FinTech Ultimate Auto-Pilot",
        "pricing": "1,000 tokens = 10 credits",
    }


@router.post("/stress")
def run_stress_test(req: StressRequest, user: Dict[str, Any] = Depends(get_current_user)):
    res = ScanService.run_stress_test(req)
    return {"ok": True, **res}


@router.post("/apk")
def run_apk_audit(req: ApkRequest, user: Dict[str, Any] = Depends(get_current_user)):
    res = ScanService.run_apk_audit(req)
    return {"ok": True, **res}
