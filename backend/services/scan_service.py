import os
import re
import json
import uuid
import time
import html
import urllib.parse
from html.parser import HTMLParser
from typing import Dict, Any, List, Optional, Set
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
        sanitize_request_data,
        sanitize_extra_args,
    )
    from backend.core.recon_scan.waf_detector import WAFFingerprintDetector
    from backend.core.recon_scan.scanner import perform_real_dynamic_scan
    from backend.core.security.ssrf_guard import (
        validate_and_canonicalize_url,
        resolve_and_validate_target,
        safe_http_fetch,
        create_pinned_session,
        is_dev_private_allowed,
    )
except ImportError:
    from core.config import settings
    from schemas.scan import (
        ScanRequest,
        CopilotChatRequest,
        StressRequest,
        WafDetectRequest,
        sanitize_request_data,
        sanitize_extra_args,
    )
    from core.recon_scan.waf_detector import WAFFingerprintDetector
    from core.recon_scan.scanner import perform_real_dynamic_scan
    from core.security.ssrf_guard import (
        validate_and_canonicalize_url,
        resolve_and_validate_target,
        safe_http_fetch,
        create_pinned_session,
        is_dev_private_allowed,
    )

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
JOBS_STORAGE: Dict[str, Dict[str, Any]] = {}

try:
    redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
except Exception:
    redis_client = None


class MetaTagTokenParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.found_tokens: Set[str] = set()

    def handle_starttag(self, tag: str, attrs: List[tuple]):
        if tag.lower() != "meta":
            return
        attr_dict = {k.lower(): (v or "").strip() for k, v in attrs}

        name_val = ""
        for key in ("name", "property", "http-equiv", "itemprop", "data-name", "id"):
            if key in attr_dict:
                name_val = attr_dict[key].lower()
                break

        valid_meta_names = {
            "adq-verification",
            "adq:verification",
            "adq_verification",
            "adq-site-verification",
            "adq:site-verification",
            "adq_site_verification",
            "adq-token",
            "adq-code",
            "adq",
        }

        content_val = attr_dict.get("content") or attr_dict.get("value") or attr_dict.get("token") or ""
        if name_val in valid_meta_names and content_val:
            cleaned = html.unescape(content_val).strip().strip("\"'`;")
            if cleaned:
                self.found_tokens.add(cleaned)
                m = re.search(r"(adq-verify-[A-Za-z0-9_-]+)", cleaned)
                if m:
                    self.found_tokens.add(m.group(1))

        for k, v in attr_dict.items():
            if v and "adq-verify-" in v:
                cleaned = html.unescape(v).strip().strip("\"'`;")
                m = re.search(r"(adq-verify-[A-Za-z0-9_-]+)", cleaned)
                if m:
                    self.found_tokens.add(m.group(1))


_VERIFICATION_CACHE: Dict[str, Dict[str, Any]] = {}

def _cache_get_verification(key: str, legacy_key: str = "") -> Optional[Dict[str, Any]]:
    # 1. Try Redis
    if redis_client:
        try:
            raw = redis_client.get(key)
            if not raw and legacy_key:
                raw = redis_client.get(legacy_key)
            if raw:
                return json.loads(raw)
        except Exception:
            pass
    # 2. Try In-Memory Cache
    cached = _VERIFICATION_CACHE.get(key) or (_VERIFICATION_CACHE.get(legacy_key) if legacy_key else None)
    if cached:
        if cached.get("expires_at", 0) > time.time():
            return cached.get("data")
        else:
            _VERIFICATION_CACHE.pop(key, None)
            if legacy_key:
                _VERIFICATION_CACHE.pop(legacy_key, None)
    return None

def _cache_set_verification(key: str, state: Dict[str, Any], ttl: int = 3600, legacy_key: str = ""):
    # 1. Update In-Memory Cache
    now = time.time()
    _VERIFICATION_CACHE[key] = {"data": state, "expires_at": now + ttl}
    if legacy_key:
        _VERIFICATION_CACHE[legacy_key] = {"data": state, "expires_at": now + ttl}
    # 2. Update Redis
    if redis_client:
        try:
            val = json.dumps(state)
            redis_client.setex(key, ttl, val)
            if legacy_key:
                redis_client.setex(legacy_key, ttl, val)
        except Exception:
            pass


class ScanService:
    @staticmethod
    def create_scan_job(
        req: ScanRequest,
        canonical_target: Optional[str] = None,
        user_id: Optional[str] = None,
        skip_ai: bool = False,
    ) -> Dict[str, Any]:
        raw_target = (req.target or "").strip()
        if not raw_target:
            raise HTTPException(status_code=400, detail="Target URL is required")

        effective_target = canonical_target or raw_target
        effective_user_id = user_id or "anonymous"
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
        # --------------------------------------------------------
        required_capability = "recon_infra"

        if "--logic-scan" in normalized_args:
            required_capability = "deep_logic"
        elif "--waf-bypass" in normalized_args:
            required_capability = "dast_active"

        queue_name = f"scan_queue:{required_capability}"

        # Execution payload dành riêng cho worker (giữ raw secret để thực thi)
        execution_job_data = {
            "job_id": job_id,
            "user_id": effective_user_id,
            "target": effective_target,
            "request": request_payload,
            "created_at": time.time(),
            "status": "QUEUED",
            "skip_ai": skip_ai,
            "required_capability": required_capability,
            "queue_name": queue_name,
        }

        # Public payload dành cho status/API/Meta (đã redact secret)
        public_request_payload = sanitize_request_data(request_payload)
        public_job_data = dict(execution_job_data)
        public_job_data["request"] = public_request_payload

        # Tạo DB record bằng CHÍNH job_id trước khi đưa vào Redis.
        try:
            save_scan_job(
                scan_id=job_id,
                target=effective_target,
                status="QUEUED",
                score=0,
            )
        except Exception as exc:
            print(f"[ScanService] Database create job error: {exc}")
            raise HTTPException(
                status_code=500,
                detail=f"Unable to create scan database record: {exc}",
            )

        JOBS_STORAGE[job_id] = public_job_data

        if redis_client:
            try:
                # Execution payload đi vào worker queue
                redis_client.rpush(
                    queue_name,
                    json.dumps(execution_job_data),
                )
                # Public payload sanitized đi vào job_meta
                redis_client.set(
                    f"job_meta:{job_id}",
                    json.dumps(public_job_data),
                    ex=86400,
                )
            except Exception as exc:
                print(f"[ScanService] Redis queue error: {exc}")

                try:
                    from backend.core.engine.db import update_scan_status
                    update_scan_status(job_id, "FAILED")
                except Exception:
                    pass

                raise HTTPException(
                    status_code=503,
                    detail=f"Unable to queue scan job: {exc}",
                )

        return public_job_data

    @staticmethod
    def get_job_status(job_id: str, user_tier: str = "FREE") -> Dict[str, Any]:
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

        # Defense-in-depth: Đảm bảo request metadata trả về API luôn sanitized
        if isinstance(job_data.get("request"), dict):
            job_data["request"] = sanitize_request_data(job_data["request"])

        # Compute / attach 4-state Assurance Matrix
        try:
            try:
                from backend.security_controls.assurance_engine import evaluate_scan_assurance
            except ImportError:
                from security_controls.assurance_engine import evaluate_scan_assurance
            job_data["assurance_matrix"] = evaluate_scan_assurance(job_data, user_tier=user_tier)
        except Exception as exc:
            print(f"[ScanService] Assurance evaluation warning: {exc}")

        # Check and populate AI Risk Assessment for COMPLETED scan jobs
        if job_data.get("status") == "COMPLETED" and user_tier != "FREE":
            if not job_data.get("ai_summary"):
                try:
                    if redis_client:
                        cached_ai = redis_client.get(f"scan_ai_risk:{job_id}")
                        if cached_ai:
                            parsed_ai = json.loads(cached_ai)
                            job_data["ai_summary"] = parsed_ai.get("text")
                except Exception:
                    pass

        return job_data

    @staticmethod
    def get_or_generate_scan_ai_assessment(job_id: str, user_tier: str = "PRO", force_refresh: bool = False) -> Dict[str, Any]:
        """
        Retrieves cached AI Risk Assessment or generates a new one based on complete scan evidence.
        """
        if user_tier == "FREE":
            raise HTTPException(
                status_code=403,
                detail="TIER_LOCKED: AI Risk Assessment yêu cầu gói PRO hoặc PRO MAX."
            )

        job_data = ScanService.get_job_status(job_id, user_tier=user_tier)
        
        try:
            from backend.core.ai_copilot.copilot_engine import ADQSecurityCopilot
            copilot = ADQSecurityCopilot()
            ai_res = copilot.generate_scan_risk_assessment(job_data, force_refresh=force_refresh)
            
            if ai_res.get("status") in ("API_ERROR", "CONFIG_ERROR"):
                raise HTTPException(
                    status_code=502,
                    detail=ai_res.get("error") or "Không thể tạo đánh giá AI lúc này."
                )

            return {
                "ok": True,
                "job_id": job_id,
                "ai_summary": ai_res.get("text"),
                "status": ai_res.get("status", "SUCCESS"),
                "model": ai_res.get("model", "ADQ AI Engine"),
            }
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Lỗi khởi tạo AI Risk Assessment: {str(exc)}")


    @staticmethod
    def copilot_chat(req: CopilotChatRequest) -> Dict[str, Any]:
        try:
            from backend.core.ai_copilot.copilot_engine import ADQSecurityCopilot
            copilot = ADQSecurityCopilot()
            raw_res = copilot.generate_copilot_response(req.prompt)
            text = raw_res.get("text") if isinstance(raw_res, dict) else str(raw_res)
            return {"copilot_response": text, "model": raw_res.get("model")}
        except Exception:
            return {"copilot_response": "Copilot ghi nhận yêu cầu của bạn."}

    @staticmethod
    def copilot_chat_interactive(
        user_id: str,
        prompt: str,
        conv_id: Optional[str] = None,
        scan_job_id: Optional[str] = None,
        stress_job_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Interactive context-aware Copilot chat with conversation persistence,
        session-bound cross-chat memory, and strict multi-tenant authorization in Redis.
        """
        try:
            from backend.core.ai_copilot.copilot_engine import ADQSecurityCopilot
            copilot = ADQSecurityCopilot()

            context_type = "PRODUCT_HELP"
            context_id = None
            target_name = "Hướng dẫn ADQ"

            scan_ctx = None
            if scan_job_id:
                scan_job = ScanService.get_job_status(scan_job_id)
                if scan_job:
                    # Tenant authorization check for scan session
                    if scan_job.get("user_id") and str(scan_job.get("user_id")) != user_id:
                        raise HTTPException(status_code=403, detail="Bạn không có quyền truy cập phiên Scan này.")
                    scan_ctx = copilot.build_scan_summary_context(scan_job)
                    context_type = "SCAN"
                    context_id = scan_job_id
                    target_name = scan_job.get("target") or "Scan Session"

            stress_ctx = None
            if stress_job_id:
                try:
                    from backend.services.stress_dispatch_service import StressDispatchService
                except ImportError:
                    from services.stress_dispatch_service import StressDispatchService
                stress_job = StressDispatchService.get_stress_job_state(stress_job_id)
                if stress_job:
                    # Tenant authorization check for stress session
                    if stress_job.get("user_id") and str(stress_job.get("user_id")) != user_id:
                        raise HTTPException(status_code=403, detail="Bạn không có quyền truy cập phiên Stress Test này.")
                    stress_ctx = copilot.build_stress_summary_context(stress_job)
                    context_type = "STRESS"
                    context_id = stress_job_id
                    target_name = stress_job.get("target_url") or "Stress Test Session"

            # Retrieve session memory (strictly isolated to user_id + context_type + context_id)
            session_memory = []
            mem_key = None
            if context_id and redis_client:
                mem_key = f"copilot_memory:{user_id}:{context_type}:{context_id}"
                try:
                    raw_mems = redis_client.lrange(mem_key, 0, -1) or []
                    for rm in raw_mems:
                        session_memory.append(json.loads(rm))
                except Exception:
                    pass

            # Load recent message history for this conversation
            active_conv_id = conv_id or f"conv_{uuid.uuid4().hex[:12]}"
            history = []
            if redis_client and conv_id:
                try:
                    raw_msgs = redis_client.lrange(f"copilot_msgs:{user_id}:{active_conv_id}", -10, -1)
                    for m in raw_msgs:
                        history.append(json.loads(m))
                except Exception:
                    pass

            ai_res = copilot.generate_copilot_response(
                prompt=prompt,
                scan_context=scan_ctx,
                stress_context=stress_ctx,
                history=history,
                session_memory=session_memory,
                context_type=context_type,
            )

            text_output = ai_res.get("text") or "Copilot đã xử lý yêu cầu nhưng không có phản hồi văn bản."

            # Save user message & assistant message to Redis
            if redis_client:
                now_ts = time.time()
                user_msg = {"id": f"msg_{uuid.uuid4().hex[:8]}", "role": "user", "text": prompt, "timestamp": now_ts}
                asst_msg = {"id": f"msg_{uuid.uuid4().hex[:8]}", "role": "copilot", "text": text_output, "timestamp": now_ts + 0.1}

                msg_key = f"copilot_msgs:{user_id}:{active_conv_id}"
                redis_client.rpush(msg_key, json.dumps(user_msg, ensure_ascii=False), json.dumps(asst_msg, ensure_ascii=False))
                redis_client.expire(msg_key, 604800)  # 7 days

                # Record key memory for session
                if mem_key:
                    try:
                        mem_record = {
                            "id": f"mem_{uuid.uuid4().hex[:8]}",
                            "source_conversation_id": active_conv_id,
                            "context_type": context_type,
                            "context_id": context_id,
                            "memory_type": "AI_SUMMARY",
                            "topic": prompt[:60],
                            "summary": text_output[:120],
                            "created_at": now_ts,
                        }
                        redis_client.rpush(mem_key, json.dumps(mem_record, ensure_ascii=False))
                        redis_client.ltrim(mem_key, -20, -1)
                        redis_client.expire(mem_key, 604800)
                    except Exception:
                        pass

                # Update conversation metadata
                conv_meta = {
                    "id": active_conv_id,
                    "title": prompt[:40] + ("..." if len(prompt) > 40 else ""),
                    "context_type": context_type,
                    "context_id": context_id,
                    "target": target_name,
                    "scan_job_id": scan_job_id,
                    "stress_job_id": stress_job_id,
                    "updated_at": now_ts,
                }
                convs_key = f"copilot_convs:{user_id}"
                existing = redis_client.get(f"copilot_conv_meta:{user_id}:{active_conv_id}")
                if not existing:
                    redis_client.lpush(convs_key, active_conv_id)
                    redis_client.ltrim(convs_key, 0, 49)
                redis_client.set(f"copilot_conv_meta:{user_id}:{active_conv_id}", json.dumps(conv_meta, ensure_ascii=False), ex=604800)

            return {
                "ok": True,
                "conv_id": active_conv_id,
                "copilot_response": text_output,
                "model": ai_res.get("model", "ADQ Security Copilot"),
                "status": ai_res.get("status", "SUCCESS"),
            }
        except HTTPException:
            raise
        except Exception as exc:
            return {
                "ok": False,
                "conv_id": conv_id or "conv_err",
                "copilot_response": f"Lỗi kết nối Copilot: {str(exc)}",
                "status": "ERROR",
            }

    @staticmethod
    def list_copilot_conversations(user_id: str) -> List[Dict[str, Any]]:
        if not redis_client or not user_id:
            return []
        try:
            conv_ids = redis_client.lrange(f"copilot_convs:{user_id}", 0, 29) or []
            convs = []
            for cid in conv_ids:
                raw_meta = redis_client.get(f"copilot_conv_meta:{user_id}:{cid}")
                if raw_meta:
                    convs.append(json.loads(raw_meta))
                else:
                    convs.append({"id": cid, "title": "Hội thoại mới", "context_type": "PRODUCT_HELP", "updated_at": time.time()})
            return convs
        except Exception:
            return []

    @staticmethod
    def get_copilot_conversation(user_id: str, conv_id: str) -> Dict[str, Any]:
        if not redis_client or not user_id or not conv_id:
            return {"id": conv_id, "messages": []}
        try:
            raw_meta = redis_client.get(f"copilot_conv_meta:{user_id}:{conv_id}")
            meta = json.loads(raw_meta) if raw_meta else {"id": conv_id, "title": "Hội thoại"}
            raw_msgs = redis_client.lrange(f"copilot_msgs:{user_id}:{conv_id}", 0, -1) or []
            messages = [json.loads(m) for m in raw_msgs]
            return {**meta, "messages": messages}
        except Exception:
            return {"id": conv_id, "messages": []}

    @staticmethod
    def delete_copilot_conversation(user_id: str, conv_id: str) -> bool:
        if not redis_client or not user_id or not conv_id:
            return False
        try:
            redis_client.delete(f"copilot_msgs:{user_id}:{conv_id}")
            redis_client.delete(f"copilot_conv_meta:{user_id}:{conv_id}")
            redis_client.lrem(f"copilot_convs:{user_id}", 0, conv_id)
            return True
        except Exception:
            return False

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
    def _get_verification_redis_key(user_id: str, normalized_origin: str, namespace: str = "target_verification") -> str:
        import hashlib
        target_hash = hashlib.sha256(normalized_origin.encode("utf-8")).hexdigest()[:16]
        return f"{namespace}:{user_id}:{target_hash}"

    @staticmethod
    def start_target_verification(user: Dict[str, Any], target_url: str) -> Dict[str, Any]:
        import secrets
        user_id = str(user.get("id") or user.get("sub") or "anonymous")
        origin, _ = resolve_and_validate_target(target_url)
        key = ScanService._get_verification_redis_key(user_id, origin, namespace="target_verification")
        legacy_key = ScanService._get_verification_redis_key(user_id, origin, namespace="stress_verification")

        # Kiểm tra token đã có sẵn chưa nếu còn hạn
        token = None
        existing = _cache_get_verification(key, legacy_key)
        if existing and existing.get("token") and not existing.get("verified"):
            token = existing.get("token")

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

        _cache_set_verification(key, state, ttl=ttl, legacy_key=legacy_key)

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
    def extract_verification_tokens(html_content: str) -> Set[str]:
        tokens: Set[str] = set()
        if not html_content:
            return tokens
        try:
            parser = MetaTagTokenParser()
            parser.feed(html_content)
            tokens.update(parser.found_tokens)
        except Exception:
            pass

        # Regex fallback for any unusual minified / unquoted HTML
        meta_patterns = [
            r"""<meta\s+[^>]*?(?:name|property|http-equiv)=["']?(?:adq-verification|adq-site-verification|adq_verification|adq:verification|adq-token)["']?[^>]*?(?:content|value)=["']?([^"'\s>]+)""",
            r"""<meta\s+[^>]*?(?:content|value)=["']?([^"'\s>]+)["']?[^>]*?(?:name|property|http-equiv)=["']?(?:adq-verification|adq-site-verification|adq_verification|adq:verification|adq-token)""",
        ]
        for pattern in meta_patterns:
            for m in re.finditer(pattern, html_content, re.IGNORECASE):
                raw_val = m.group(1)
                cleaned = html.unescape(raw_val).strip().strip("\"'`;")
                match = re.search(r"(adq-verify-[A-Za-z0-9_-]+)", cleaned)
                if match:
                    tokens.add(match.group(1))
                elif cleaned:
                    tokens.add(cleaned)

        # Global fallback: Scan for standard adq-verify-* format across whole document
        for m in re.finditer(r"(adq-verify-[A-Za-z0-9_-]+)", html_content):
            tokens.add(m.group(1))

        return tokens

    @staticmethod
    def check_target_verification(user: Dict[str, Any], target_url: str) -> Dict[str, Any]:
        import secrets
        user_id = str(user.get("id") or user.get("sub") or "anonymous")
        origin, _ = resolve_and_validate_target(target_url)
        key = ScanService._get_verification_redis_key(user_id, origin, namespace="target_verification")
        legacy_key = ScanService._get_verification_redis_key(user_id, origin, namespace="stress_verification")

        state = _cache_get_verification(key, legacy_key)

        if not state or not state.get("token"):
            return {
                "ok": False,
                "verified": False,
                "target": origin,
                "message": "Chưa khởi tạo mã xác minh hoặc mã đã hết hạn. Vui lòng bấm Lấy mã mới.",
            }

        expected_token = state.get("token").strip()

        # Fetch homepage & optional target path with SSRF safety guards & redirect revalidation
        html_content = ""
        fetch_error = None

        # 1. Primary fetch: Try origin (homepage root)
        try:
            _, html_content, _ = safe_http_fetch(origin, max_redirects=5, timeout=6.0, max_size=512*1024)
        except Exception as exc:
            fetch_error = exc

        # 2. Secondary fetch: If origin failed or if raw target_url has a specific subpath that differs from origin
        if not html_content and target_url and target_url.strip() != origin:
            try:
                _, html_content, _ = safe_http_fetch(target_url.strip(), max_redirects=5, timeout=6.0, max_size=512*1024)
            except Exception:
                pass

        if not html_content:
            return {
                "ok": False,
                "verified": False,
                "target": origin,
                "message": f"Không thể kết nối an toàn đến website mục tiêu: {fetch_error or 'Không nhận được dữ liệu HTML'}",
            }

        # Extract tokens using multi-strategy parser
        extracted_tokens = ScanService.extract_verification_tokens(html_content)

        is_verified = False
        for token_candidate in extracted_tokens:
            if secrets.compare_digest(token_candidate, expected_token) or (expected_token in token_candidate):
                is_verified = True
                break

        if is_verified:
            now = time.time()
            state["verified"] = True
            state["verified_at"] = now
            _cache_set_verification(key, state, ttl=3600, legacy_key=legacy_key)

            return {
                "ok": True,
                "verified": True,
                "target": origin,
                "message": "Xác minh quyền sở hữu mục tiêu thành công! Bạn có thể bắt đầu quét an ninh hoặc kiểm thử tải.",
                "verified_at": now,
            }

        return {
            "ok": False,
            "verified": False,
            "target": origin,
            "message": "Không tìm thấy thẻ meta xác minh hợp lệ trong trang chủ. Vui lòng kiểm tra lại thẻ <meta name=\"adq-verification\" content=\"...\"> trong thẻ <head>.",
        }

    @staticmethod
    def get_target_verification_status(user: Dict[str, Any], target_url: str) -> Dict[str, Any]:
        user_id = str(user.get("id") or user.get("sub") or "anonymous")
        try:
            origin = ScanService.normalize_target_origin(target_url)
        except Exception:
            return {
                "ok": False,
                "verified": False,
                "target": target_url,
                "reason": "INVALID_ORIGIN",
            }

        key = ScanService._get_verification_redis_key(user_id, origin, namespace="target_verification")
        legacy_key = ScanService._get_verification_redis_key(user_id, origin, namespace="stress_verification")
        data = _cache_get_verification(key, legacy_key)

        if data:
            verified = bool(data.get("verified"))
            verified_at = data.get("verified_at")
            token = data.get("token")
            ttl = 3600
            if redis_client:
                try:
                    ttl_val = redis_client.ttl(key)
                    if ttl_val is not None and ttl_val > 0:
                        ttl = ttl_val
                except Exception:
                    pass

            expires_at = (time.time() + ttl) if (ttl and ttl > 0) else None

            return {
                "ok": True,
                "verified": verified,
                "target": origin,
                "verified_at": verified_at,
                "expires_at": expires_at,
                "token": token if not verified else None,
                "expires_in": max(0, ttl) if ttl and ttl > 0 else 0,
            }

        return {
            "ok": True,
            "verified": False,
            "target": origin,
            "verified_at": None,
            "expires_at": None,
        }

    @staticmethod
    def is_target_verified(user: Dict[str, Any], target_url: str) -> bool:
        user_id = str(user.get("id") or user.get("sub") or "anonymous")
        try:
            origin = ScanService.normalize_target_origin(target_url)
        except Exception:
            return False

        key = ScanService._get_verification_redis_key(user_id, origin, namespace="target_verification")
        legacy_key = ScanService._get_verification_redis_key(user_id, origin, namespace="stress_verification")
        data = _cache_get_verification(key, legacy_key)
        if data:
            return bool(data.get("verified"))
        return False

    # Backward compatibility aliases for Stress module
    @staticmethod
    def start_stress_verification(user: Dict[str, Any], target_url: str) -> Dict[str, Any]:
        return ScanService.start_target_verification(user, target_url)

    @staticmethod
    def check_stress_verification(user: Dict[str, Any], target_url: str) -> Dict[str, Any]:
        return ScanService.check_target_verification(user, target_url)

    @staticmethod
    def is_stress_target_verified(user: Dict[str, Any], target_url: str) -> bool:
        return ScanService.is_target_verified(user, target_url)


