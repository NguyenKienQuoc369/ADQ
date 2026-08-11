import hashlib
import json
import logging
import os
import time
from typing import Any, Dict, List, Optional, Tuple, Union
import requests
try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv()
except ImportError:
    pass

try:
    from core.copilot_masker import SensitiveDataMasker  # type: ignore
except ImportError:
    from copilot_masker import SensitiveDataMasker  # type: ignore

try:
    import redis  # type: ignore
    HAS_REDIS = True
except ImportError:
    HAS_REDIS = False

logger = logging.getLogger("ADQ.Copilot")

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")
GEMINI_MODEL_FALLBACKS = [
    m.strip() for m in os.environ.get(
        "GEMINI_MODEL_FALLBACKS",
        "gemini-3.6-flash,gemini-3.5-flash,gemini-flash-latest",
    ).split(",") if m.strip()
]
DEFAULT_CREDITS_PER_1K_TOKENS = 10  # 1,000 tokens = 10 credits


class ADQSecurityCopilot:
    """
    ADQ Security Copilot - Agentic AI Middleware Orchestrator
    Powered by Google Gemini API
    
    1. Architectural View: Orchestrates AI logic between FastAPI, Supabase Context, and Workers.
    2. Agentic Workflow View:
       - Phase 1: Ingestion & Log Compression
       - Phase 2: Chain-of-Thought Correlation
       - Phase 3: Function Calling Execution
       - Phase 4: Executive Synthesis & Remediation
    3. SecOps & Privacy View: Sensitive Data Masking & Zero-Retention
    4. Product & UX View: Interactive Context Reports & One-Click Fix Code Patches
    5. FinOps View: Token Compression, Redis LLM Caching, and Credit Deduction
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        redis_url: Optional[str] = None,
    ):
        self.api_key = api_key or GEMINI_API_KEY
        self.model = model or GEMINI_MODEL
        self.masker = SensitiveDataMasker()
        self.redis_client = None

        r_url = redis_url or os.environ.get("REDIS_URL", "redis://localhost:6379/0")
        if HAS_REDIS:
            try:
                self.redis_client = redis.Redis.from_url(r_url, decode_responses=True)
            except Exception as e:
                logger.warning(f"Copilot Redis cache initialization warning: {e}")

    # =========================================================================
    # FINOPS: LOG COMPRESSION & REDIS CACHING
    # =========================================================================

    def _compress_scan_findings(self, scan_results: Dict[str, Any]) -> Dict[str, Any]:
        """FinOps: Compress raw scan logs by grouping noise and retaining anomalies."""
        target = scan_results.get("target", "unknown")
        raw_vulns = scan_results.get("vulnerabilities", []) or scan_results.get("highlights", {}).get("nuclei", [])
        live_hosts = scan_results.get("live_hosts", [])

        # Group vulnerabilities by template_id / type to reduce token payload
        grouped_vulns: Dict[str, Dict[str, Any]] = {}
        for v in raw_vulns:
            v_type = v.get("template_id") or v.get("title") or "generic_finding"
            severity = (v.get("severity") or "info").lower()

            # Skip low/info noise if payload exceeds limit
            if severity in ("info", "low") and len(grouped_vulns) > 20:
                continue

            if v_type not in grouped_vulns:
                grouped_vulns[v_type] = {
                    "template_id": v_type,
                    "severity": severity,
                    "count": 1,
                    "endpoints": [v.get("endpoint") or v.get("host") or ""],
                    "raw_sample": str(v)[:300],
                }
            else:
                grouped_vulns[v_type]["count"] += 1
                if len(grouped_vulns[v_type]["endpoints"]) < 3:
                    grouped_vulns[v_type]["endpoints"].append(v.get("endpoint") or v.get("host") or "")

        compressed = {
            "target": target,
            "total_live_hosts": len(live_hosts),
            "live_hosts_sample": [h.get("url") if isinstance(h, dict) else str(h) for h in live_hosts[:5]],
            "anomalies_summary": list(grouped_vulns.values())[:30],
        }

        # Apply SecOps Data Masking Filter
        return self.masker.mask_dict_or_list(compressed)

    def _get_cache_key(self, prompt: str) -> str:
        """Generates SHA256 hash for LLM prompt caching."""
        return f"adq:copilot_cache:{hashlib.sha256(prompt.encode('utf-8')).hexdigest()}"

    def _check_cache(self, prompt: str) -> Optional[Dict[str, Any]]:
        """Queries Redis cache for duplicate LLM responses."""
        if not self.redis_client:
            return None
        try:
            cache_key = self._get_cache_key(prompt)
            cached = self.redis_client.get(cache_key)
            if cached:
                data = json.loads(cached)
                data["cached"] = True
                return data
        except Exception as e:
            logger.warning(f"Copilot cache lookup error: {e}")
        return None

    def _set_cache(self, prompt: str, response_data: Dict[str, Any], ttl_seconds: int = 86400):
        """Stores LLM response in Redis cache for 24 hours."""
        if not self.redis_client:
            return
        try:
            cache_key = self._get_cache_key(prompt)
            self.redis_client.setex(cache_key, ttl_seconds, json.dumps(response_data))
        except Exception as e:
            logger.warning(f"Copilot cache set error: {e}")

    # =========================================================================
    # GOOGLE GEMINI API CALL & FUNCTION CALLING
    # =========================================================================

    def _models_to_try(self) -> List[str]:
        ordered = [self.model] + GEMINI_MODEL_FALLBACKS
        seen = set()
        result = []
        for item in ordered:
            if item and item not in seen:
                seen.add(item)
                result.append(item)
        return result

    def _call_gemini_api(self, prompt: str, system_instruction: Optional[str] = None) -> Dict[str, Any]:
        """Dispatches request to Google Gemini API."""
        if not self.api_key:
            return {
                "error": "GEMINI_API_KEY is missing. Set GEMINI_API_KEY environment variable.",
                "status": "CONFIG_ERROR",
            }

        # Check Redis Cache
        cached_res = self._check_cache(prompt)
        if cached_res:
            return cached_res

        headers = {"Content-Type": "application/json"}

        payload: Dict[str, Any] = {
            "contents": [
                {
                    "parts": [{"text": prompt}]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "topP": 0.95,
                "maxOutputTokens": 2048,
            }
        }

        if system_instruction:
            payload["systemInstruction"] = {
                "parts": [{"text": system_instruction}]
            }

        errors: List[Dict[str, Any]] = []

        for model_name in self._models_to_try():
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={self.api_key}"
            try:
                resp = requests.post(url, json=payload, headers=headers, timeout=30)
                if resp.status_code != 200:
                    errors.append({
                        "model": model_name,
                        "status_code": resp.status_code,
                        "detail": resp.text[:300],
                    })
                    continue

                res_json = resp.json()
                candidates = res_json.get("candidates", [])
                if not candidates:
                    errors.append({
                        "model": model_name,
                        "status_code": 200,
                        "detail": "No candidates returned",
                    })
                    continue

                text_content = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                usage_metadata = res_json.get("usageMetadata", {})

                input_tokens = usage_metadata.get("promptTokenCount", len(prompt) // 4)
                output_tokens = usage_metadata.get("candidatesTokenCount", len(text_content) // 4)
                total_tokens = usage_metadata.get("totalTokenCount", input_tokens + output_tokens)

                credits_deducted = max(1, (total_tokens * DEFAULT_CREDITS_PER_1K_TOKENS) // 1000)

                result = {
                    "status": "SUCCESS",
                    "text": text_content,
                    "model": model_name,
                    "token_usage": {
                        "input_tokens": input_tokens,
                        "output_tokens": output_tokens,
                        "total_tokens": total_tokens,
                    },
                    "credits_deducted": credits_deducted,
                    "cached": False,
                }

                self._set_cache(prompt, result)
                return result
            except Exception as e:
                errors.append({
                    "model": model_name,
                    "exception": str(e),
                })

        return {
            "status": "API_ERROR",
            "error": "All Gemini model attempts failed",
            "attempts": errors,
        }

    # =========================================================================
    # AGENTIC WORKFLOW 4-PHASE ANALYSIS
    # =========================================================================

    def analyze_scan_job(self, scan_results: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes full 4-Phase Agentic Workflow on a scan job result:
        1. Ingestion & Masking
        2. Chain-of-Thought Correlation
        3. Function Calling Detection
        4. Synthesis & Actionable Remediation
        """
        # Phase 1: Ingestion & Data Masking
        compressed = self._compress_scan_findings(scan_results)

        system_instruction = (
            "Bạn là ADQ Security Copilot - Trí tuệ Nhân tạo Tự chủ (Agentic AI) chuyên sâu về Pentesting & DevSecOps. "
            "Nhiệm vụ: Đánh giá tương quan chuỗi tấn công (Chain-of-Thought), đề xuất lệnh điều phối DAG Workers (Function Calling), "
            "và sinh báo cáo khắc phục lỗ hổng chính xác cho lập trình viên. "
            "Phản hồi ngắn gọn, chính xác bằng tiếng Việt chuẩn DevSecOps."
        )

        prompt = f"""
Dưới đây là dữ liệu rà quét an ninh đã được làm sạch và nén gọn:
{json.dumps(compressed, ensure_ascii=False, indent=2)}

Hãy thực hiện phân tích 4 Pha Agentic AI:
1. [Chain-of-Thought]: Xâu chuỗi các điểm dị thường để chỉ ra kịch bản tấn công nguy hiểm nhất (ví dụ: Lộ credential + Port mở -> DB Compromise).
2. [Function Calling Recommendations]: Đề xuất 1-3 hành động điều phối worker tiếp theo (ví dụ: `run_arjun_idor_scan`, `fuzz_websocket`, `run_deep_js_analysis`).
3. [Executive Summary]: Tóm tắt 3 câu về mức độ rủi ro tổng quan cho C-Level.
4. [One-Click Remediation Code]: Cung cấp mã vá mẫu trực tiếp cho framework tương ứng.
"""

        api_res = self._call_gemini_api(prompt, system_instruction=system_instruction)
        api_res["compressed_findings"] = compressed
        return api_res

    # =========================================================================
    # PRODUCT & UX: ONE-CLICK FIX CODE PATCH GENERATOR
    # =========================================================================

    def generate_one_click_fix(self, vulnerability_type: str, endpoint: str, framework: str = "Next.js") -> Dict[str, Any]:
        """Generates exact, copy-pasteable code patch for specific framework vulnerability."""
        system_instruction = (
            "Bạn là Chuyên gia Lập trình Bảo mật (Secure Code Engineer). "
            "Hãy tạo mã vá lỗi trực tiếp, chuẩn hóa và an toàn nhất cho framework được yêu cầu."
        )

        prompt = f"""
Hãy tạo bản vá mã nguồn One-Click Fix cho lỗ hổng sau:
- Loại lỗ hổng: {vulnerability_type}
- Endpoint ảnh hưởng: {endpoint}
- Framework phát triển: {framework}

Yêu cầu output:
1. Nguyên nhân cốt lõi (1 câu)
2. Đoạn mã vá an toàn (Code block có chú thích)
3. Cấu hình WAF / Header khuyến nghị nếu có.
"""
        return self._call_gemini_api(prompt, system_instruction=system_instruction)
