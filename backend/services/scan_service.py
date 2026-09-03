import os
import re
import json
import uuid
import time
import urllib.parse
from typing import Dict, Any, List
from fastapi import HTTPException
import redis

try:
    from backend.core.engine.db import save_scan_job
except ImportError:
    from core.engine.db import save_scan_job

try:
    from backend.core.config import settings
    from backend.schemas.scan import (
        ScanRequest,
        CopilotChatRequest,
        StressRequest,
        WafDetectRequest,
    )
    from backend.core.recon_scan.waf_detector import WAFFingerprintDetector
    from backend.core.recon_scan.scanner import perform_real_dynamic_scan
    from backend.core.security.ssrf_guard import (
        validate_and_canonicalize_url,
        resolve_and_validate_target,
        create_pinned_session,
        is_dev_private_allowed,
        safe_http_fetch,
    )
except ImportError:
    from core.config import settings
    from schemas.scan import (
        ScanRequest,
        CopilotChatRequest,
        StressRequest,
        WafDetectRequest,
    )
    from core.recon_scan.waf_detector import WAFFingerprintDetector
    from core.recon_scan.scanner import perform_real_dynamic_scan
    from core.security.ssrf_guard import (
        validate_and_canonicalize_url,
        resolve_and_validate_target,
        create_pinned_session,
        is_dev_private_allowed,
        safe_http_fetch,
    )

JOBS_STORAGE: Dict[str, Dict[str, Any]] = {}
REDIS_URL = getattr(settings, "REDIS_URL", None) or os.getenv("REDIS_URL", "redis://adq_redis:6379/0")

try:
    redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
except Exception:
    redis_client = None

class ScanService:
    @staticmethod
    def create_scan_job(req: ScanRequest, skip_ai: bool = False) -> Dict[str, Any]:
        if not req.target or not req.target.strip():
            raise HTTPException(status_code=400, detail="Target URL is required")

        job_id = str(uuid.uuid4())

        request_payload = req.model_dump()
        extra_args = request_payload.get("extra_args") or []

        normalized_args = {
            str(arg).strip().lower()
            for arg in extra_args
            if str(arg).strip()
        }

        # --------------------------------------------------------
        # Capability routing
        #
        # Scan thông thường -> worker light/recon.
        # Các module active đặc biệt -> worker elite.
        # Deep logic -> worker elite/deep_logic.
        #
        # Không thay đổi API schema; routing được suy ra từ extra_args.
        # --------------------------------------------------------
        required_capability = "recon_infra"

        if "--logic-scan" in normalized_args:
            required_capability = "deep_logic"
        elif "--waf-bypass" in normalized_args:
            required_capability = "dast_active"

        queue_name = f"scan_queue:{required_capability}"

        job_data = {
            "job_id": job_id,
            "target": req.target.strip(),
            "request": request_payload,
            "created_at": time.time(),
            "status": "QUEUED",
            "skip_ai": skip_ai,
            "required_capability": required_capability,
            "queue_name": queue_name,
        }
        # Tạo DB record bằng CHÍNH job_id trước khi đưa vào Redis.
        # Nhờ đó FastAPI, Redis worker và PostgreSQL dùng cùng một scan ID.
        try:
            save_scan_job(
                scan_id=job_id,
                target=req.target.strip(),
                status="QUEUED",
                score=0,
            )
        except Exception as exc:
            print(f"[ScanService] Database create job error: {exc}")
            raise HTTPException(
                status_code=500,
                detail=f"Unable to create scan database record: {exc}",
            )

        JOBS_STORAGE[job_id] = job_data

        if redis_client:
            try:
                redis_client.rpush(
                    queue_name,
                    json.dumps(job_data),
                )
                redis_client.set(
                    f"job_meta:{job_id}",
                    json.dumps(job_data),
                    ex=86400,
                )
            except Exception as exc:
                print(f"[ScanService] Redis queue error: {exc}")

                # Queue thất bại thì đánh dấu job FAILED trong DB.
                try:
                    from backend.core.engine.db import update_scan_status
                    update_scan_status(job_id, "FAILED")
                except Exception:
                    pass

                raise HTTPException(
                    status_code=503,
                    detail=f"Unable to queue scan job: {exc}",
                )

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
                    elif raw_st in ["queued", "pending"]:
                        job_data["status"] = "QUEUED"
                    else:
                        job_data["status"] = "RUNNING"
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
    def copilot_analyze(job_id: str) -> Dict[str, Any]:
        """
        Phân tích một scan job bằng Agentic Copilot Engine.
        Không tạo dữ liệu giả nếu job hoặc AI engine lỗi.
        """
        job = ScanService.get_job_status(job_id)

        try:
            from backend.core.ai_copilot.copilot_engine import ADQSecurityCopilot

            copilot = ADQSecurityCopilot()
            result = copilot.analyze_scan_job(job)

            if not isinstance(result, dict):
                raise HTTPException(
                    status_code=502,
                    detail="Copilot analyze returned an invalid response."
                )

            if result.get("status") in {"API_ERROR", "CONFIG_ERROR"}:
                raise HTTPException(
                    status_code=502,
                    detail=result.get("error") or "Copilot analyze failed."
                )

            analysis = result.get("text")
            if not analysis:
                raise HTTPException(
                    status_code=502,
                    detail="Copilot analyze returned no analysis."
                )

            return {
                "job_id": job_id,
                "analysis": str(analysis),
            }

        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Copilot analyze failed: {exc}"
            )


    @staticmethod
    def copilot_patch(
        vulnerability_type: str,
        endpoint: str,
        framework: str = "Next.js",
    ) -> Dict[str, Any]:
        """
        Sinh One-Click Fix bằng engine thật.
        """
        try:
            from backend.core.ai_copilot.copilot_engine import ADQSecurityCopilot

            copilot = ADQSecurityCopilot()
            result = copilot.generate_one_click_fix(
                vulnerability_type=vulnerability_type,
                endpoint=endpoint,
                framework=framework or "Next.js",
            )

            if not isinstance(result, dict):
                raise HTTPException(
                    status_code=502,
                    detail="Copilot patch returned an invalid response."
                )

            if result.get("status") in {"API_ERROR", "CONFIG_ERROR"}:
                raise HTTPException(
                    status_code=502,
                    detail=result.get("error") or "Copilot patch generation failed."
                )

            patch_text = result.get("text")
            if not patch_text:
                raise HTTPException(
                    status_code=502,
                    detail="Copilot patch returned no patch."
                )

            return {
                "patch_result": str(patch_text),
            }

        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Copilot patch failed: {exc}"
            )


    @staticmethod
    def discover_endpoints(target_url: str) -> Dict[str, Any]:
        raw = (target_url or "").strip()
        if not raw:
            raise HTTPException(status_code=400, detail="Target URL is required")

        origin, resolved_ips = resolve_and_validate_target(raw)
        base_origin = origin
        pinned_ip = resolved_ips[0]
        session = create_pinned_session(pinned_ip)
        actual_verify = not is_dev_private_allowed()

        discovered: List[str] = [base_origin]
        exposed_paths = []

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }

        common_paths = [
            "/robots.txt",
            "/sitemap.xml",
            "/.env",
            "/.git/HEAD",
            "/api/health",
            "/api/v1/health",
            "/api/account",
            "/api/auth/session",
            "/docs",
            "/swagger-ui.html",
            "/openapi.json"
        ]

        for path in common_paths:
            test_url = f"{base_origin}{path}"
            try:
                r = session.get(test_url, headers=headers, timeout=3, verify=actual_verify, allow_redirects=False)
                if r.status_code in (200, 301, 302, 401, 403):
                    if test_url not in discovered:
                        discovered.append(test_url)
                    if r.status_code == 200:
                        exposed_paths.append(f"{test_url} (HTTP 200 OK)")
            except Exception:
                pass

        try:
            resp = session.get(base_origin, headers=headers, timeout=4, verify=actual_verify, allow_redirects=False)
            if resp.status_code == 200:
                js_links = re.findall(r'''src=["']([^"']+\.js)["']''', resp.text)
                for link in js_links:
                    full_js = link if link.startswith("http") else f"{base_origin}{link if link.startswith('/') else '/' + link}"
                    if full_js not in discovered and len(discovered) < 40:
                        discovered.append(full_js)

                routes = re.findall(r'''["'](/[a-zA-Z0-9_\-/]{2,50})["']''', resp.text)
                for route in routes:
                    if not any(route.endswith(ext) for ext in [".js", ".css", ".png", ".jpg", ".ico", ".svg", ".json"]):
                        full_route = f"{base_origin}{route}"
                        if full_route not in discovered and len(discovered) < 45:
                            discovered.append(full_route)
        except Exception:
            pass

        return {
            "ok": True,
            "target": base_origin,
            "total_found": len(discovered),
            "endpoints": discovered,
            "exposed_paths": exposed_paths
        }

    @staticmethod
    def detect_waf(req: WafDetectRequest) -> Dict[str, Any]:
        # Validate SSRF target trước khi fetch
        origin, resolved_ips = resolve_and_validate_target(req.target_url)
        pinned_ip = resolved_ips[0]

        detector = WAFFingerprintDetector()
        waf_res = detector.detect_waf(origin, pinned_ip=pinned_ip)

        detected_wafs = waf_res.get("detected_wafs", [])
        primary_waf = detected_wafs[0] if detected_wafs else "No WAF / Generic Server"
        primary_lower = primary_waf.lower()

        input_label = "Mã Bypass / Secret Token"
        input_placeholder = "Nhập mã bypass hoặc token xác thực"
        detected_slug = "standard"

        if "vercel" in primary_lower:
            detected_slug = "vercel"
            input_label = "Vercel Protection Bypass Secret"
            input_placeholder = "rsE... (Chỉ cần dán chuỗi Secret)"
        elif "cloudflare" in primary_lower:
            detected_slug = "cloudflare"
            input_label = "Cloudflare cf_clearance / Token"
            input_placeholder = "Dán chuỗi cf_clearance hoặc Service Token"
        elif "aws" in primary_lower or "api gateway" in primary_lower:
            detected_slug = "awswaf"
            input_label = "AWS API Key (x-api-key)"
            input_placeholder = "Dán chuỗi API Key x-api-key"

        waf_detected = bool(detected_wafs and not any(k in primary_lower for k in ["no waf", "generic"]))

        return {
            "ok": True,
            "target_url": origin,
            "waf_detected": waf_detected,
            "detected_waf": detected_slug,
            "waf_name": primary_waf,
            "input_label": input_label,
            "input_placeholder": input_placeholder,
        }

    @staticmethod
    def normalize_target_origin(raw_url: str) -> str:
        origin, _, _ = validate_and_canonicalize_url(raw_url)
        return origin

    @staticmethod
    def _get_verification_redis_key(user_id: str, normalized_origin: str) -> str:
        import hashlib
        target_hash = hashlib.sha256(normalized_origin.encode("utf-8")).hexdigest()[:16]
        return f"stress_verification:{user_id}:{target_hash}"

    @staticmethod
    def start_stress_verification(user: Dict[str, Any], target_url: str) -> Dict[str, Any]:
        import secrets
        user_id = str(user.get("id") or user.get("sub") or "anonymous")
        origin, _ = resolve_and_validate_target(target_url)
        key = ScanService._get_verification_redis_key(user_id, origin)

        # Kiểm tra token đã có sẵn chưa nếu còn hạn
        token = None
        if redis_client:
            raw = redis_client.get(key)
            if raw:
                try:
                    data = json.loads(raw)
                    if data.get("token") and not data.get("verified"):
                        token = data.get("token")
                except Exception:
                    pass

        if not token:
            token = f"adq-verify-{secrets.token_urlsafe(24)}"

        ttl = 3600
        state = {
            "token": token,
            "origin": origin,
            "user_id": user_id,
            "verified": False,
            "created_at": time.time(),
            "verified_at": None,
        }

        if redis_client:
            redis_client.setex(key, ttl, json.dumps(state))

        meta_tag = f'<meta name="adq-verification" content="{token}">'
        return {
            "ok": True,
            "target": origin,
            "verification_token": token,
            "meta_tag": meta_tag,
            "expires_in": ttl,
            "verified": False,
        }

    @staticmethod
    def check_stress_verification(user: Dict[str, Any], target_url: str) -> Dict[str, Any]:
        import secrets
        user_id = str(user.get("id") or user.get("sub") or "anonymous")
        origin, _ = resolve_and_validate_target(target_url)
        key = ScanService._get_verification_redis_key(user_id, origin)

        state = None
        if redis_client:
            raw = redis_client.get(key)
            if raw:
                try:
                    state = json.loads(raw)
                except Exception:
                    pass

        if not state or not state.get("token"):
            return {
                "ok": False,
                "verified": False,
                "target": origin,
                "message": "Chưa khởi tạo mã xác minh hoặc mã đã hết hạn. Vui lòng bấm Lấy mã mới.",
            }

        expected_token = state.get("token")

        # Fetch homepage với SSRF safety guards & redirect revalidation
        try:
            status_code, html_content, _ = safe_http_fetch(origin, max_redirects=3, timeout=5.0, max_size=512*1024)
        except Exception as exc:
            return {
                "ok": False,
                "verified": False,
                "target": origin,
                "message": f"Không thể kết nối an toàn đến trang chủ mục tiêu: {exc}",
            }

        # Parse meta tag
        found_token = None
        p1 = re.search(r'''<meta\s+[^>]*name=["']adq-verification["'][^>]*content=["']([^"']+)["']''', html_content, re.IGNORECASE)
        if p1:
            found_token = p1.group(1).strip()
        else:
            p2 = re.search(r'''<meta\s+[^>]*content=["']([^"']+)["'][^>]*name=["']adq-verification["']''', html_content, re.IGNORECASE)
            if p2:
                found_token = p2.group(1).strip()

        if found_token and secrets.compare_digest(found_token, expected_token):
            now = time.time()
            state["verified"] = True
            state["verified_at"] = now
            if redis_client:
                # Gia hạn TTL 3600s sau khi xác minh thành công
                redis_client.setex(key, 3600, json.dumps(state))

            return {
                "ok": True,
                "verified": True,
                "target": origin,
                "message": "Xác minh quyền sở hữu mục tiêu thành công! Bạn có thể bắt đầu kiểm thử tải.",
                "verified_at": now,
            }

        return {
            "ok": False,
            "verified": False,
            "target": origin,
            "message": "Không tìm thấy thẻ meta xác minh hợp lệ trong trang chủ. Vui lòng kiểm tra lại thẻ <meta> trong thẻ <head>.",
        }

    @staticmethod
    def is_stress_target_verified(user: Dict[str, Any], target_url: str) -> bool:
        user_id = str(user.get("id") or user.get("sub") or "anonymous")
        try:
            origin = ScanService.normalize_target_origin(target_url)
        except Exception:
            return False
        key = ScanService._get_verification_redis_key(user_id, origin)
        if redis_client:
            raw = redis_client.get(key)
            if raw:
                try:
                    data = json.loads(raw)
                    return bool(data.get("verified"))
                except Exception:
                    pass
        return False

