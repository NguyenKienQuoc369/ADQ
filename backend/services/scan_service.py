import os
import re
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
        WafDetectRequest,
        ApkRequest,
    )
    from backend.core.recon_scan.waf_detector import WAFFingerprintDetector
    from backend.core.recon_scan.scanner import perform_real_dynamic_scan
except ImportError:
    from core.config import settings
    from schemas.scan import (
        ScanRequest,
        CopilotChatRequest,
        CopilotAnalyzeRequest,
        CopilotPatchRequest,
        StressRequest,
        WafDetectRequest,
        ApkRequest,
    )
    from core.recon_scan.waf_detector import WAFFingerprintDetector
    from core.recon_scan.scanner import perform_real_dynamic_scan

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
            raise HTTPException(status_code=400, detail="Target URL is required")

        job_id = str(uuid.uuid4())
        job_data = {
            "job_id": job_id,
            "target": req.target.strip(),
            "request": req.model_dump(),
            "created_at": time.time(),
            "status": "QUEUED",
        }
        JOBS_STORAGE[job_id] = job_data
        if redis_client:
            try:
                redis_client.rpush("scan_queue", json.dumps(job_data))
                redis_client.set(f"job_meta:{job_id}", json.dumps(job_data), ex=86400)
            except Exception as exc:
                print(f"[ScanService] Redis queue error: {exc}")
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
                    job_data["status"] = "COMPLETED" if raw_st in ["done", "completed"] else "RUNNING"
                    JOBS_STORAGE[job_id] = job_data
                elif not job_data:
                    raw_meta = redis_client.get(f"job_meta:{job_id}")
                    if raw_meta:
                        job_data = json.loads(raw_meta)
                        JOBS_STORAGE[job_id] = job_data
            except Exception:
                pass

        if not job_data:
            raise HTTPException(status_code=404, detail=f"Scan job '{job_id}' not found")
        return job_data

    @staticmethod
    def copilot_chat(req: CopilotChatRequest) -> Dict[str, Any]:
        try:
            from backend.core.ai_copilot.copilot_engine import ADQSecurityCopilot
            copilot = ADQSecurityCopilot()
            raw_res = copilot._call_gemini_api(req.prompt)
            text = raw_res.get("text") if isinstance(raw_res, dict) else str(raw_res)
            return {"copilot_response": text}
        except Exception:
            return {"copilot_response": "Copilot ghi nhận yêu cầu của bạn."}

    @staticmethod
    def discover_endpoints(target_url: str) -> Dict[str, Any]:
        raw = target_url.strip()
        clean = raw if raw.startswith(("http://", "https://")) else f"https://{raw}"

        discovered: List[str] = [clean]
        scan_res = perform_real_dynamic_scan(clean, tier_choice=1)

        if scan_res.get("exposed_paths"):
            for p in scan_res["exposed_paths"]:
                clean_path = p.split(" ")[0]
                if clean_path not in discovered:
                    discovered.append(clean_path)

        # Cào thêm Next.js manifest
        try:
            import requests
            resp = requests.get(clean, timeout=4, verify=False)
            manifests = re.findall(r'src=["\'](/_next/static/[^"\']+/_buildManifest\.js)["\']', resp.text)
            for mf in manifests:
                mf_url = f"{clean.rstrip('/')}{mf}"
                mf_resp = requests.get(mf_url, timeout=3, verify=False)
                routes = re.findall(r'["\'](/[a-zA-Z0-9_\-\/]+)["\']', mf_resp.text)
                for r in routes:
                    if not any(r.endswith(ext) for ext in [".js", ".css", ".json"]):
                        full_r = f"{clean.rstrip('/')}{r}"
                        if full_r not in discovered and len(discovered) < 25:
                            discovered.append(full_r)
        except Exception:
            pass

        return {"ok": True, "target": clean, "total_found": len(discovered), "endpoints": discovered}

    @staticmethod
    def detect_waf(req: WafDetectRequest) -> Dict[str, Any]:
        detector = WAFFingerprintDetector()
        waf_res = detector.detect_waf(req.target_url)

        detected_wafs = waf_res.get("detected_wafs", [])
        primary_waf = detected_wafs[0] if detected_wafs else "No WAF / Generic Server"

        input_label = "Mã Bypass / Secret Token"
        input_placeholder = "Nhập mã bypass hoặc token xác thực"
        detected_slug = "standard"

        if "Vercel" in primary_waf:
            detected_slug = "vercel"
            input_label = "Vercel Protection Bypass Secret"
            input_placeholder = "rsE... (Chỉ cần dán chuỗi Secret)"
        elif "Cloudflare" in primary_waf:
            detected_slug = "cloudflare"
            input_label = "Cloudflare cf_clearance / Token"
            input_placeholder = "Nhập token cf_clearance hoặc Service Secret"
        elif "AWS" in primary_waf:
            detected_slug = "awswaf"
            input_label = "AWS WAF x-api-key"
            input_placeholder = "Nhập chuỗi API Key x-api-key"

        return {
            "ok": True,
            "target_url": req.target_url,
            "detected_waf": detected_slug,
            "waf_name": primary_waf,
            "input_label": input_label,
            "input_placeholder": input_placeholder,
        }

    @staticmethod
    def run_stress_test(req: StressRequest) -> Dict[str, Any]:
        try:
            from backend.core.stress_test.stress_orchestrator import StressOrchestrator
            orchestrator = StressOrchestrator()
            result = orchestrator.execute_stress_test(
                target_url=req.target_url,
                target_requests=req.target_requests or 1000,
                duration=req.duration or "5s",
                bypass_code=req.bypass_code or "",
                waf_type=req.waf_type or "standard",
                custom_headers=req.custom_headers,
                custom_cookies=req.custom_cookies,
            )
            return {"ok": True, "result": result}
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Stress test error: {str(exc)}")
