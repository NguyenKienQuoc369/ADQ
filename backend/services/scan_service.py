import os
import sys
import json
import uuid
import time
import subprocess
from typing import Dict, Any, List, Optional
from fastapi import HTTPException, status
from backend.schemas.scan import (
    ScanRequest,
    CopilotChatRequest,
    CopilotAnalyzeRequest,
    CopilotPatchRequest,
    StressRequest,
    ApkRequest,
)

JOBS_STORAGE: Dict[str, Dict[str, Any]] = {}
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class ScanService:
    @staticmethod
    def create_scan_job(req: ScanRequest) -> Dict[str, Any]:
        if not req.target or not req.target.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Target URL or domain is required",
            )

        job_id = str(uuid.uuid4())
        job_data = {
            "job_id": job_id,
            "target": req.target,
            "request": req.model_dump(),
            "created_at": time.time(),
            "status": "running",
            "pid": None,
            "returncode": None,
            "stdout_tail": "",
            "stderr_tail": "",
        }
        JOBS_STORAGE[job_id] = job_data
        return job_data

    @staticmethod
    def get_job_status(job_id: str) -> Dict[str, Any]:
        if job_id not in JOBS_STORAGE:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Scan job with ID '{job_id}' not found",
            )
        return JOBS_STORAGE[job_id]

    @staticmethod
    def list_scans() -> List[Dict[str, Any]]:
        scans = []
        for job_id, job in JOBS_STORAGE.items():
            scans.append({
                "id": job_id,
                "target": job.get("target", "unknown"),
                "status": job.get("status", "COMPLETED").upper(),
                "startedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(job.get("created_at", time.time()))),
                "planUsed": "PRO",
                "liveSubdomains": [],
                "portScan": [],
                "urlHistory": [],
                "secretsHunter": [],
                "vulnerabilities": [],
                "actionAdvice": [],
                "enabledTools": ["Subfinder", "Naabu", "Katana", "Nuclei"],
                "autoThrottle": True,
                "telegram": {"enabled": False},
            })
        return scans

    @staticmethod
    def copilot_chat(req: CopilotChatRequest) -> Dict[str, Any]:
        if not req.prompt or not req.prompt.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Prompt message cannot be empty",
            )
        try:
            from backend.core.ai_copilot.copilot_engine import ADQSecurityCopilot

            copilot = ADQSecurityCopilot()
            system_instruction = (
                "Bạn là ADQ Security Copilot - Agentic AI chuyên Pentesting & DevSecOps. "
                "Trả lời chính xác bằng tiếng Việt chuẩn bảo mật."
            )
            response_text = copilot._call_gemini_api(req.prompt, system_instruction=system_instruction)
            return {"copilot_response": response_text}
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Copilot engine error: {str(exc)}",
            )

    @staticmethod
    def copilot_analyze(req: CopilotAnalyzeRequest) -> Dict[str, Any]:
        try:
            from backend.core.ai_copilot.copilot_engine import ADQSecurityCopilot

            copilot = ADQSecurityCopilot()
            job_info = JOBS_STORAGE.get(req.job_id, {})
            scan_data = {"target": job_info.get("target", req.job_id), "vulnerabilities": []}
            analysis = copilot.analyze_scan_job(scan_data)
            return {"job_id": req.job_id, "analysis": analysis}
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Copilot analysis failed: {str(exc)}",
            )

    @staticmethod
    def copilot_patch(req: CopilotPatchRequest) -> Dict[str, Any]:
        try:
            from backend.core.ai_copilot.copilot_engine import ADQSecurityCopilot

            copilot = ADQSecurityCopilot()
            patch_result = copilot.generate_one_click_fix(
                vulnerability_type=req.vulnerability_type,
                endpoint=req.endpoint,
                framework=req.framework,
            )
            return {"patch_result": patch_result}
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Patch generation failed: {str(exc)}",
            )

    @staticmethod
    def run_stress_test(req: StressRequest) -> Dict[str, Any]:
        try:
            from backend.core.stress_test.stress_orchestrator import StressOrchestrator

            orchestrator = StressOrchestrator()
            result = orchestrator.execute_stress_test(
                target_url=req.target_url,
                bearer_token=req.bearer_token or "",
                vus=req.vus,
                duration=req.duration,
                method=req.method,
            )
            return {"result": result}
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Stress test execution failed: {str(exc)}",
            )

    @staticmethod
    def run_apk_audit(req: ApkRequest) -> Dict[str, Any]:
        try:
            from backend.core.mobile_audit.apk_analyzer import APKAnalyzer

            analyzer = APKAnalyzer(req.apk_path)
            result = analyzer.run_pipeline()
            return {"result": result}
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"APK audit failed: {str(exc)}",
            )
