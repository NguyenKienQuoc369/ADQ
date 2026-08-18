import os
import re
import sys
import json
import uuid
import time
import ssl
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

ssl_unverified_context = ssl._create_unverified_context()

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
        target = target_url.strip()
        if not target.startswith("http"):
            target = f"https://{target}"

        discovered: List[str] = [target]
        base_clean = target.rstrip("/")
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }

        # 1. Bóc tách robots.txt & sitemap.xml
        for path in ["/robots.txt", "/sitemap.xml"]:
            try:
                req = urllib.request.Request(f"{base_clean}{path}", headers=headers)
                with urllib.request.urlopen(req, timeout=4, context=ssl_unverified_context) as resp:
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

        # 2. Cào mã nguồn HTML & Bóc tách Next.js Build Manifest
        try:
            req = urllib.request.Request(base_clean, headers=headers)
            with urllib.request.urlopen(req, timeout=5, context=ssl_unverified_context) as resp:
                html_body = resp.read().decode("utf-8", errors="ignore")
                
                manifest_matches = re.findall(r'src=["\'](/_next/static/[^"\']+/_buildManifest\.js)["\']', html_body)
                for mf in manifest_matches:
                    try:
                        mf_url = f"{base_clean}{mf}"
                        mf_req = urllib.request.Request(mf_url, headers=headers)
                        with urllib.request.urlopen(mf_req, timeout=4, context=ssl_unverified_context) as mf_resp:
                            mf_js = mf_resp.read().decode("utf-8", errors="ignore")
                            routes = re.findall(r'["\'](/[a-zA-Z0-9_\-\/]+)["\']', mf_js)
                            for r in routes:
                                if not any(r.endswith(ext) for ext in [".js", ".css", ".json"]):
                                    full_route = f"{base_clean}{r}"
                                    if full_route not in discovered and len(discovered) < 30:
                                        discovered.append(full_route)
                    except Exception:
                        pass

                links = re.findall(r'(?:href|src|action)=["\'](/[^"\'>\s]+)["\']', html_body)
                api_calls = re.findall(r'["\'](/api/[a-zA-Z0-9_\-\/]+)["\']', html_body)
                for link in list(set(links + api_calls)):
                    if any(link.endswith(ext) for ext in [".css", ".png", ".jpg", ".svg", ".ico", ".woff", ".woff2"]):
                        continue
                    full_ep = f"{base_clean}{link}"
                    if full_ep not in discovered and len(discovered) < 25:
                        discovered.append(full_ep)
        except Exception:
            pass

        # 3. Dự phòng các API endpoints phổ biến
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
        default_bypass_hint = "x-forwarded-for: 127.0.0.1"

        try:
            req_probe = urllib.request.Request(
                target,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
                method="HEAD"
            )
            with urllib.request.urlopen(req_probe, timeout=5, context=ssl_unverified_context) as resp:
                headers_detected = {k.lower(): v for k, v in resp.getheaders()}
        except urllib.error.HTTPError as he:
            headers_detected = {k.lower(): v for k, v in he.headers.items()}
        except Exception:
            pass

        server_h = headers_detected.get("server", "").lower()
        if "cf-ray" in headers_detected or "cloudflare" in server_h:
            detected_waf = "cloudflare"
            waf_name = "Cloudflare WAF / DDoS Protection"
            default_bypass_hint = "cf_clearance=<token>"
        elif "x-vercel-id" in headers_detected or "vercel" in server_h:
            detected_waf = "vercel"
            waf_name = "Vercel Edge Deployment Protection"
            default_bypass_hint = "x-vercel-protection-bypass: <secret>"
        elif "x-amz-cf-id" in headers_detected or "awselb" in server_h:
            detected_waf = "awswaf"
            waf_name = "AWS WAF / CloudFront"
            default_bypass_hint = "x-api-key: <token>"

        return {
            "ok": True,
            "target_url": target,
            "detected_waf": detected_waf,
            "waf_name": waf_name,
            "default_bypass_hint": default_bypass_hint,
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
                custom_headers=req.custom_headers,
                custom_cookies=req.custom_cookies,
            )
            return {"ok": True, "result": result}
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Stress test error: {str(exc)}")
