import os
import re
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
            except Exception as e:
                print(f"[ScanService] get_job_status error: {e}")

        if not job_data:
            raise HTTPException(status_code=404, detail=f"Scan job with ID '{job_id}' not found")
        return job_data

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
            return {"copilot_response": "Không thể kết nối máy chủ AI lúc này."}

    @staticmethod
    def discover_endpoints(target_url: str) -> Dict[str, Any]:
        target = target_url.strip()
        if not target.startswith("http"):
            target = f"https://{target}"

        discovered: List[str] = [target]
        base_clean = target.rstrip("/")

        for path in ["/robots.txt", "/sitemap.xml"]:
            try:
                req = urllib.request.Request(f"{base_clean}{path}", headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=4) as resp:
                    content = resp.read().decode("utf-8", errors="ignore")
                    for line in content.splitlines():
                        if "Disallow:" in line or "Allow:" in line:
                            p = line.split(":", 1)[1].strip()
                            if p and p != "/" and not p.startswith("*"):
                                full_p = f"{base_clean}{p}"
                                if full_p not in discovered:
                                    discovered.append(full_p)
            except Exception:
                pass

        try:
            req = urllib.request.Request(base_clean, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                html_body = resp.read().decode("utf-8", errors="ignore")
                links = re.findall(r'(?:href|src|action)=["\'](/[^"\'>\s]+)["\']', html_body)
                api_calls = re.findall(r'["\'](/api/[a-zA-Z0-9_\-\/]+)["\']', html_body)
                all_found = list(set(links + api_calls))
                for link in all_found:
                    if any(link.endswith(ext) for ext in [".css", ".png", ".jpg", ".svg", ".ico", ".woff"]):
                        continue
                    full_ep = f"{base_clean}{link}"
                    if full_ep not in discovered and len(discovered) < 25:
                        discovered.append(full_ep)
        except Exception:
            pass

        common_probes = ["/api/auth/login", "/api/v1/user", "/api/health", "/login", "/register", "/dashboard"]
        for cp in common_probes:
            full_probe = f"{base_clean}{cp}"
            if full_probe not in discovered and len(discovered) < 20:
                discovered.append(full_probe)

        return {"ok": True, "target": target, "total_found": len(discovered), "endpoints": discovered}

    @staticmethod
    def detect_waf(req: WafDetectRequest) -> Dict[str, Any]:
        target = req.target_url.strip()
        if not target.startswith("http"):
            target = f"https://{target}"

        headers_detected = {}
        detected_waf = "standard"
        waf_name = "Standard Origin (Nginx / Linux)"
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

        server_header = headers_detected.get("server", "").lower()

        if "cf-ray" in headers_detected or "cloudflare" in server_header:
            detected_waf = "cloudflare"
            waf_name = "Cloudflare Edge Security / WAF"
            bypass_suggestions = {
                "header_key": "CF-Access-Client-Id",
                "header_value": "",
                "cookie_key": "cf_clearance",
                "cookie_value": "",
                "note": "Cần cung cấp Header CF-Access hoặc Cookie cf_clearance."
            }
        elif "x-vercel-id" in headers_detected or "vercel" in server_header:
            detected_waf = "vercel"
            waf_name = "Vercel Edge Network / Deployment Protection"
            bypass_suggestions = {
                "header_key": "x-vercel-protection-bypass",
                "header_value": "",
                "cookie_key": "x-vercel-set-bypass-cookie",
                "cookie_value": "true",
                "note": "Cung cấp Protection Bypass Secret từ Vercel Project Settings."
            }
        elif "x-amz-cf-id" in headers_detected or "awselb" in server_header:
            detected_waf = "awswaf"
            waf_name = "AWS WAF / Amazon CloudFront"
            bypass_suggestions = {
                "header_key": "x-api-key",
                "header_value": "",
                "cookie_key": "",
                "cookie_value": "",
                "note": "Cung cấp API Key x-api-key được cấp quyền."
            }
        elif "nginx" in server_header:
            detected_waf = "nginx"
            waf_name = "Nginx ngx_http_limit_req (Rate Limiting)"
            bypass_suggestions = {
                "header_key": "X-Forwarded-For",
                "header_value": "127.0.0.1",
                "cookie_key": "",
                "cookie_value": "",
                "note": "Bật Multi-Header IP Spoofing để kiểm tra tính năng bypass Rate Limit."
            }

        return {"ok": True, "target_url": target, "detected_waf": detected_waf, "waf_name": waf_name, "bypass_suggestions": bypass_suggestions}

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
                target_requests=req.target_requests or 100,
                duration=req.duration or "5s",
                bypass_config=req.bypass_config
            )
            return {"ok": True, "result": result}
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Stress test error: {str(exc)}")
