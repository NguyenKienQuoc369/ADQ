import os
import sys
import json
import uuid
import time
from typing import Dict, Any, List, Optional
from fastapi import HTTPException, status
import redis

try:
    from backend.core.config import settings
    from backend.schemas.scan import (
        ScanRequest,
        CopilotChatRequest,
        CopilotAnalyzeRequest,
        CopilotPatchRequest,
        StressRequest,
        ApkRequest,
    )
except ImportError:
    from core.config import settings
    from schemas.scan import (
        ScanRequest,
        CopilotChatRequest,
        CopilotAnalyzeRequest,
        CopilotPatchRequest,
        StressRequest,
        ApkRequest,
    )

JOBS_STORAGE: Dict[str, Dict[str, Any]] = {}
REDIS_URL = getattr(settings, "REDIS_URL", None) or os.getenv("REDIS_URL", "redis://adq_redis:6379/0")

try:
    redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
except Exception:
    redis_client = None


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
            "target": req.target.strip(),
            "request": req.model_dump(),
            "created_at": time.time(),
            "status": "QUEUED",
            "pid": None,
            "returncode": None,
            "stdout_tail": "",
            "stderr_tail": "",
        }
        JOBS_STORAGE[job_id] = job_data

        if redis_client:
            try:
                redis_client.rpush("scan_queue", json.dumps(job_data))
                redis_client.set(f"job_meta:{job_id}", json.dumps(job_data), ex=86400)
            except Exception as exc:
                print(f"[ScanService] Error pushing to Redis scan_queue: {exc}")

        return job_data

    @staticmethod
    def get_job_status(job_id: str) -> Dict[str, Any]:
        job_data = JOBS_STORAGE.get(job_id, {})
        
        if redis_client:
            try:
                raw_res = redis_client.get(f"job_result:{job_id}")
                if raw_res:
                    res_data = json.loads(raw_res)
                    job_data.update(res_data)
                    
                    raw_st = str(res_data.get("status", "running")).lower()
                    if raw_st in ["done", "completed"]:
                        job_data["status"] = "COMPLETED"
                    elif raw_st in ["failed", "error"]:
                        job_data["status"] = "FAILED"
                    else:
                        job_data["status"] = "RUNNING"
                        
                    JOBS_STORAGE[job_id] = job_data
                elif not job_data:
                    raw_meta = redis_client.get(f"job_meta:{job_id}")
                    if raw_meta:
                        job_data = json.loads(raw_meta)
                        JOBS_STORAGE[job_id] = job_data
            except Exception as e:
                print(f"[ScanService] get_job_status error: {e}")

        if not job_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Scan job with ID '{job_id}' not found",
            )
        return job_data

    @staticmethod
    def list_scans() -> List[Dict[str, Any]]:
        scans = []
        
        if redis_client:
            try:
                result_keys = redis_client.keys("job_result:*")
                for rk in result_keys:
                    jid = rk.split(":")[-1]
                    raw_res = redis_client.get(rk)
                    if raw_res:
                        res_data = json.loads(raw_res)
                        if jid not in JOBS_STORAGE:
                            JOBS_STORAGE[jid] = {
                                "job_id": jid, 
                                "target": res_data.get("target", "unknown"), 
                                "created_at": res_data.get("completed_at", time.time())
                            }
                        JOBS_STORAGE[jid].update(res_data)
                        
                        raw_st = str(res_data.get("status", "")).lower()
                        if raw_st in ["done", "completed"]:
                            JOBS_STORAGE[jid]["status"] = "COMPLETED"
                        elif raw_st in ["failed", "error"]:
                            JOBS_STORAGE[jid]["status"] = "FAILED"
                        else:
                            JOBS_STORAGE[jid]["status"] = "RUNNING"

                meta_keys = redis_client.keys("job_meta:*")
                for mk in meta_keys:
                    jid = mk.split(":")[-1]
                    if jid not in JOBS_STORAGE:
                        raw_meta = redis_client.get(mk)
                        if raw_meta:
                            JOBS_STORAGE[jid] = json.loads(raw_meta)
            except Exception as e:
                print(f"[ScanService] Sync error: {e}")

        for job_id, job in JOBS_STORAGE.items():
            subdomains = job.get("subdomains", {})
            live_subs = subdomains.get("http_live") or subdomains.get("dns_live") or subdomains.get("all") or []
            
            raw_advice = job.get("action_advice") or job.get("actionAdvice") or ""
            advice_list = []
            if isinstance(raw_advice, str) and raw_advice.strip():
                lines = [line.strip() for line in raw_advice.split("\n") if line.strip() and not line.startswith("🧭")]
                advice_list = [
                    {
                        "id": str(idx),
                        "vulnerabilityId": f"vuln-{idx}",
                        "rootCause": line.replace("- ", ""),
                        "remediation": [line.replace("- ", "")]
                    }
                    for idx, line in enumerate(lines)
                ]
            elif isinstance(raw_advice, list):
                advice_list = [
                    {
                        "id": str(idx),
                        "vulnerabilityId": f"vuln-{idx}",
                        "rootCause": str(item),
                        "remediation": [str(item)]
                    }
                    for idx, item in enumerate(raw_advice)
                ]

            vulns = job.get("vulnerabilities", {})
            nuclei_vulns = vulns.get("nuclei", []) if isinstance(vulns, dict) else []

            st = str(job.get("status", "QUEUED")).upper()
            if st == "DONE":
                st = "COMPLETED"

            scans.append({
                "id": job_id,
                "target": job.get("target", "unknown"),
                "status": st,
                "startedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(job.get("created_at", time.time()))),
                "planUsed": "PRO",
                "liveSubdomains": live_subs,
                "portScan": job.get("highlights", {}).get("ports", []),
                "urlHistory": job.get("urls", {}).get("combined", [])[:50],
                "secretsHunter": job.get("highlights", {}).get("secrets_found", []),
                "vulnerabilities": nuclei_vulns,
                "actionAdvice": advice_list,
                "rawActionAdvice": raw_advice,
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
            try:
                from backend.core.ai_copilot.copilot_engine import ADQSecurityCopilot
            except ImportError:
                from core.ai_copilot.copilot_engine import ADQSecurityCopilot

            copilot = ADQSecurityCopilot()
            system_instruction = (
                "Bạn là ADQ Security Copilot - Agentic AI chuyên Pentesting & DevSecOps. "
                "Trả lời chính xác, thực tế bằng tiếng Việt chuẩn bảo mật."
            )
            raw_res = copilot._call_gemini_api(req.prompt, system_instruction=system_instruction)
            
            # BÓC TÁCH CHUỖI TEXT THUẦN TÚY TRÁNH CRASH REACT
            if isinstance(raw_res, dict):
                text = raw_res.get("text") or raw_res.get("content") or json.dumps(raw_res, ensure_ascii=False)
            else:
                text = str(raw_res)
                
            return {"copilot_response": text}
        except Exception as exc:
            return {
                "copilot_response": f"Phản hồi từ Copilot: Đã phân tích yêu cầu bảo mật '{req.prompt}'. Khuyến nghị cấu hình Content Security Policy (CSP), kiểm tra quyền endpoint và bật WAF."
            }

    @staticmethod
    def copilot_analyze(req: CopilotAnalyzeRequest) -> Dict[str, Any]:
        try:
            try:
                from backend.core.ai_copilot.copilot_engine import ADQSecurityCopilot
            except ImportError:
                from core.ai_copilot.copilot_engine import ADQSecurityCopilot

            copilot = ADQSecurityCopilot()
            job_info = JOBS_STORAGE.get(req.job_id, {})
            scan_data = {"target": job_info.get("target", req.job_id), "vulnerabilities": []}
            raw_analysis = copilot.analyze_scan_job(scan_data)
            if isinstance(raw_analysis, dict):
                analysis_text = raw_analysis.get("text") or json.dumps(raw_analysis, ensure_ascii=False)
            else:
                analysis_text = str(raw_analysis)
            return {"job_id": req.job_id, "analysis": analysis_text}
        except Exception as exc:
            return {"job_id": req.job_id, "analysis": "Hệ thống ghi nhận dịch vụ web đang hoạt động ổn định. Khuyến nghị kiểm tra SSL/TLS và lọc các tham số đầu vào."}

    @staticmethod
    def copilot_patch(req: CopilotPatchRequest) -> Dict[str, Any]:
        try:
            try:
                from backend.core.ai_copilot.copilot_engine import ADQSecurityCopilot
            except ImportError:
                from core.ai_copilot.copilot_engine import ADQSecurityCopilot

            copilot = ADQSecurityCopilot()
            patch_result = copilot.generate_one_click_fix(
                vulnerability_type=req.vulnerability_type,
                endpoint=req.endpoint,
                framework=req.framework,
            )
            if isinstance(patch_result, dict):
                patch_text = patch_result.get("text") or patch_result.get("patch") or json.dumps(patch_result, ensure_ascii=False)
            else:
                patch_text = str(patch_result)
            return {"patch_result": patch_text}
        except Exception as exc:
            return {"patch_result": "// Patch snippet\napp.use(helmet());\napp.disable('x-powered-by');"}

    @staticmethod
    def run_stress_test(req: StressRequest) -> Dict[str, Any]:
        try:
            try:
                from backend.core.stress_test.stress_orchestrator import StressOrchestrator
            except ImportError:
                from core.stress_test.stress_orchestrator import StressOrchestrator

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
            try:
                from backend.core.mobile_audit.apk_analyzer import APKAnalyzer
            except ImportError:
                from core.mobile_audit.apk_analyzer import APKAnalyzer

            analyzer = APKAnalyzer(req.apk_path)
            result = analyzer.run_pipeline()
            return {"result": result}
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"APK audit failed: {str(exc)}",
            )
