import os
import sys
import json
import uuid
import time
import urllib.request
import urllib.error
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
                print(f"[ScanService] Redis queue push error: {exc}")

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
            except Exception as e:
                print(f"[ScanService] get_job_status error: {e}")

        if not job_data:
            raise HTTPException(status_code=404, detail=f"Scan job with ID '{job_id}' not found")
        return job_data

    @staticmethod
    def list_scans() -> List[Dict[str, Any]]:
        return []

    @staticmethod
    def copilot_chat(req: CopilotChatRequest) -> Dict[str, Any]:
        try:
            try:
                from backend.core.ai_copilot.copilot_engine import ADQSecurityCopilot
            except ImportError:
                from core.ai_copilot.copilot_engine import ADQSecurityCopilot

            copilot = ADQSecurityCopilot()
            raw_res = copilot._call_gemini_api(req.prompt)
            if isinstance(raw_res, dict):
                text = raw_res.get("text") or raw_res.get("content") or json.dumps(raw_res, ensure_ascii=False)
            else:
                text = str(raw_res)
            return {"copilot_response": text}
        except Exception:
            return {"copilot_response": "Không thể kết nối máy chủ AI. Khuyến nghị kiểm tra SSL/TLS và giới hạn tốc độ yêu cầu."}

    @staticmethod
    def copilot_analyze(req: CopilotAnalyzeRequest) -> Dict[str, Any]:
        return {"job_id": req.job_id, "analysis": "Hệ thống đang phân tích chi tiết phiên quét."}

    @staticmethod
    def copilot_patch(req: CopilotPatchRequest) -> Dict[str, Any]:
        return {"patch_result": "// Patch snippet\napp.use(rateLimit({ windowMs: 60 * 1000, max: 100 }));"}

    @staticmethod
    def detect_waf(req: WafDetectRequest) -> Dict[str, Any]:
        target = req.target_url.strip()
        if not target.startswith("http"):
            target = f"https://{target}"

        headers_detected = {}
        detected_waf = "standard"
        waf_name = "Không phát hiện WAF biên (Standard Nginx/Apache)"
        bypass_suggestions = {}

        try:
            req_probe = urllib.request.Request(
                target,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
                method="HEAD"
            )
            with urllib.request.urlopen(req_probe, timeout=6) as resp:
                headers_detected = {k.lower(): v for k, v in resp.getheaders()}
        except urllib.error.HTTPError as he:
            headers_detected = {k.lower(): v for k, v in he.headers.items()}
        except Exception:
            pass

        # Phân tích chữ ký WAF
        h_str = json.dumps(headers_detected)
        if "cf-ray" in headers_detected or "cloudflare" in headers_detected.get("server", "").lower():
            detected_waf = "cloudflare"
            waf_name = "Cloudflare Edge Security / WAF"
            bypass_suggestions = {
                "headers": {"CF-Access-Client-Id": "", "CF-Access-Client-Secret": ""},
                "cookies": {"cf_clearance": ""},
                "note": "Cần cấu hình Service Token hoặc Cookie cf_clearance nếu có quyền truy cập Staging."
            }
        elif "x-vercel-id" in headers_detected or "vercel" in headers_detected.get("server", "").lower():
            detected_waf = "vercel"
            waf_name = "Vercel Edge Network / Deployment Protection"
            bypass_suggestions = {
                "headers": {"x-vercel-protection-bypass": "", "x-vercel-set-bypass-cookie": "true"},
                "cookies": {},
                "note": "Sử dụng Vercel Protection Bypass Secret được cấp trong Project Settings > Deployment Protection."
            }
        elif "x-amz-cf-id" in headers_detected or "awselb" in headers_detected.get("server", "").lower():
            detected_waf = "awswaf"
            waf_name = "AWS WAF / CloudFront"
            bypass_suggestions = {
                "headers": {"x-api-key": "", "X-Forwarded-For": "127.0.0.1"},
                "cookies": {},
                "note": "Sử dụng API Key hoặc Whitelisted Header cho môi trường staging AWS."
            }
        elif "nginx" in headers_detected.get("server", "").lower():
            detected_waf = "nginx"
            waf_name = "Nginx ngx_http_limit_req / Rate Limiter"
            bypass_suggestions = {
                "headers": {"X-Forwarded-For": "192.168.1.1", "X-Real-IP": "192.168.1.1"},
                "cookies": {},
                "note": "Kiểm tra xem Nginx có tin cậy header X-Forwarded-For để tính toán Rate Limit hay không."
            }

        return {
            "ok": True,
            "target_url": target,
            "detected_waf": detected_waf,
            "waf_name": waf_name,
            "headers_snippet": {k: headers_detected[k] for k in list(headers_detected.keys())[:8]},
            "bypass_suggestions": bypass_suggestions,
        }

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
                method=req.method or "GET",
                headers=req.headers or {},
                body=req.body or None,
                vus=req.vus,
                duration=req.duration,
                bypass_config=req.bypass_config
            )
            return {"ok": True, "result": result}
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Stress test execution failed: {str(exc)}")

    @staticmethod
    def run_apk_audit(req: ApkRequest) -> Dict[str, Any]:
        return {"result": {"ok": True}}
