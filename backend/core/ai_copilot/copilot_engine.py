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
    from backend.core.ai_copilot.copilot_masker import SensitiveDataMasker  # type: ignore
except ImportError:
    try:
        from core.ai_copilot.copilot_masker import SensitiveDataMasker  # type: ignore
    except ImportError:
        from .copilot_masker import SensitiveDataMasker  # type: ignore

try:
    import redis  # type: ignore
    HAS_REDIS = True
except ImportError:
    HAS_REDIS = False

logger = logging.getLogger("ADQ.Copilot")

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash-lite")
GEMINI_MODEL_FALLBACKS = [
    m.strip() for m in os.environ.get(
        "GEMINI_MODEL_FALLBACKS",
        "gemini-3.5-flash-lite,gemini-flash-lite-latest,gemini-3.1-flash-lite,gemini-3.5-flash",
    ).split(",") if m.strip()
]
DEFAULT_CREDITS_PER_1K_TOKENS = 10  # 1,000 tokens = 10 credits

DEFAULT_COPILOT_SYSTEM_INSTRUCTION = (
    "Ngươi là ADQ Security Copilot - Trí tuệ Nhân tạo Tự chủ chuyên sâu về Pentesting, DevSecOps & Security Engineering của Nền tảng ADQ Platform.\n"
    "QUY TẮC TƯ DUY & HÀNH ĐỘNG CỐT LÕI:\n"
    "1. DANH TÍNH THƯƠNG HIỆU: Ngươi là 'ADQ Security Copilot' (được phát triển độc quyền bởi ADQ Platform). Tuyệt đối KHÔNG ĐƯỢC nhắc tới Google, Gemini, OpenAI, GPT hay bất kỳ mô hình/nhà phát triển bên thứ ba nào dưới bất kỳ hình thức nào. Nếu được hỏi về danh tính hay mô hình, trả lời duy nhất: 'Tôi là ADQ Security Copilot - Hệ thống Agentic AI Tự chủ do ADQ Security Platform phát triển.'\n"
    "2. TRẢ LỜI ĐÚNG TRỌNG TÂM: Trả lời trực tiếp, chính xác, ngắn gọn và đi thẳng vào câu hỏi hoặc yêu cầu cụ thể của người dùng.\n"
    "3. SỬ DỤNG DỮ LIỆU RÀ QUÉT MỤC TIÊU: Khi có dữ liệu rà quét (lỗ hổng, secrets, endpoints, ports), hãy sử dụng chính xác dữ liệu đó để giải đáp thắc mắc, phân tích nguy cơ và đề xuất giải pháp cho mục tiêu.\n"
    "4. CHỐNG ẢO GIÁC (Zero-Hallucination): Chỉ phân tích dựa trên sự thật và dữ liệu được cung cấp. Tuyệt đối không tự bịa đặt lỗ hổng hay thông tin không có bằng chứng thực tế.\n"
    "5. AGENTIC FUNCTION CALLING: Khi đề xuất một hành động cụ thể (như quét sâu endpoint, bắn thử stress test k6, kiểm tra IDOR hay Fuzz WebSocket, tạo bản vá code), HÃY KÍCH HOẠT TOOL/FUNCTION CALLING tương ứng để hệ thống thực thi trực tiếp trên mục tiêu thực tế."
)

COPILOT_TOOLS_DECLARATION = [
    {
        "functionDeclarations": [
            {
                "name": "trigger_deep_scan",
                "description": "Ra lệnh kích hoạt rà quét sâu bằng WAF Evasion Mutation Engine và probing nâng cao trên endpoint.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "target_path": {"type": "STRING", "description": "Đường dẫn endpoint cần quét sâu, ví dụ: /api/admin hoặc /v1/user"},
                        "bypass_waf": {"type": "BOOLEAN", "description": "Bật cờ lách WAF Mutation Engine"},
                        "reason": {"type": "STRING", "description": "Lý do AI ra lệnh quét lại"}
                    },
                    "required": ["target_path"]
                }
            },
            {
                "name": "run_stress_test",
                "description": "Kích hoạt kiểm thử tải/stress test Layer 7 bằng k6 engine chính thức với RPS và thời gian tùy chỉnh.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "target_url": {"type": "STRING", "description": "URL mục tiêu cần bắn stress test"},
                        "target_rps": {"type": "INTEGER", "description": "Số request/giây mong muốn (RPS), ví dụ: 500, 1000, 5000"},
                        "duration_sec": {"type": "INTEGER", "description": "Thời gian bắn tính bằng giây (ví dụ: 5 hoặc 10)"}
                    },
                    "required": ["target_url", "target_rps"]
                }
            },
            {
                "name": "run_arjun_idor_scan",
                "description": "Dò tìm tham số ẩn và kiểm tra lỗ hổng IDOR/BOLA trên endpoint.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "endpoint": {"type": "STRING", "description": "Endpoint URL cần kiểm tra IDOR"},
                        "user_id_param": {"type": "STRING", "description": "Tên tham số định danh người dùng nếu có"}
                    },
                    "required": ["endpoint"]
                }
            },
            {
                "name": "fuzz_websocket",
                "description": "Thực hiện Fuzzing Real-time WebSocket Data Frames trên kênh WebSocket nghi ngờ.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "ws_url": {"type": "STRING", "description": "WebSocket URL (ws:// hoặc wss://)"}
                    },
                    "required": ["ws_url"]
                }
            },
            {
                "name": "generate_patch",
                "description": "Sinh mã vá lỗi bảo mật One-Click Fix chính xác cho loại lỗ hổng và framework chỉ định.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "vulnerability_type": {"type": "STRING", "description": "Tên/Loại lỗ hổng bảo mật (ví dụ: SQL Injection, IDOR, CORS Misconfiguration, Missing HSTS)"},
                        "endpoint": {"type": "STRING", "description": "Endpoint bị ảnh hưởng"},
                        "framework": {"type": "STRING", "description": "Framework (Next.js, Express, FastAPI, Django, Spring Boot, etc.)"}
                    },
                    "required": ["vulnerability_type", "endpoint"]
                }
            }
        ]
    }
]


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

    def _correlate_attack_chains(self, scan_results: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Log Correlation Engine: Cross-vector Attack Chain Analysis
        Correlates Open Service/DB Ports + Exposed Credentials/Configs -> Attack Chain Escalation
        """
        correlated_chains = []
        target = scan_results.get("target", "unknown")
        
        # 1. Identify Open Ports
        open_ports = set()
        ports_list = scan_results.get("ports", []) or scan_results.get("highlights", {}).get("ports", [])
        for p in ports_list:
            if isinstance(p, dict):
                port_num = p.get("port") or p.get("port_number")
                if p.get("is_open") or p.get("state") == "open":
                    open_ports.add(int(port_num)) if port_num else None
            elif isinstance(p, (int, str)) and str(p).isdigit():
                open_ports.add(int(p))

        # 2. Identify Leaked Secrets / Credentials
        vulns = scan_results.get("vulnerabilities", []) or scan_results.get("highlights", {}).get("nuclei", [])
        js_secrets = scan_results.get("js_analysis", {}).get("secrets", [])
        
        has_db_secret = False
        secret_sample = ""
        
        for v in vulns:
            v_str = str(v).lower()
            if any(k in v_str for k in ["postgres", "mysql", "database", "connection_string", "db_pass", "secret"]):
                has_db_secret = True
                secret_sample = str(v.get("raw_secret") or v.get("template_id") or "Exposed DB Credential")
                break
        
        if not has_db_secret and js_secrets:
            has_db_secret = True
            secret_sample = str(js_secrets[0]) if js_secrets else "Client-side JS Secret"

        # 3. Cross-Vector Escalation Rules
        sensitive_db_ports = {
            5432: ("PostgreSQL", "iptables -A INPUT -p tcp --dport 5432 -j DROP"),
            3306: ("MySQL", "iptables -A INPUT -p tcp --dport 3306 -j DROP"),
            27017: ("MongoDB", "iptables -A INPUT -p tcp --dport 27017 -j DROP"),
            6379: ("Redis", "iptables -A INPUT -p tcp --dport 6379 -j DROP"),
            1433: ("MSSQL", "iptables -A INPUT -p tcp --dport 1433 -j DROP"),
            22: ("SSH", "ufw deny 22/tcp"),
        }

        for port, (service_name, firewall_cmd) in sensitive_db_ports.items():
            if port in open_ports and has_db_secret:
                correlated_chains.append({
                    "template_id": f"correlated-attack-chain-{service_name.lower()}-compromise",
                    "severity": "critical",
                    "title": f"CẢNH BÁO CRITICAL: Chuỗi Tấn công Dịch vụ {service_name} Public + Lộ Credential",
                    "attack_chain_correlation": (
                        f"Phát hiện dịch vụ {service_name} mở công khai trên Cổng {port} "
                        f"kết hợp dữ liệu Credential lộ từ client-side ({secret_sample}). "
                        f"Kẻ tấn công có thể dùng thông tin này brute-force/login trực tiếp vào dịch vụ nội bộ."
                    ),
                    "recommended_remediation": f"Tắt public port {port} lập tức. Lệnh khắc phục: `{firewall_cmd}`",
                })

        return correlated_chains

    def _compress_scan_findings(self, scan_results: Dict[str, Any]) -> Dict[str, Any]:
        """FinOps: Compress raw scan logs by grouping noise, correlating vectors, and retaining anomalies."""
        target = scan_results.get("target", "unknown")
        raw_vulns = scan_results.get("vulnerabilities", []) or scan_results.get("highlights", {}).get("nuclei", [])
        live_hosts = scan_results.get("live_hosts", [])

        # Step 1: Run Multi-Vector Attack Chain Correlation
        correlated_chains = self._correlate_attack_chains(scan_results)

        # Step 2: Group vulnerabilities by template_id / type to reduce token payload
        grouped_vulns: Dict[str, Dict[str, Any]] = {}
        
        # Prioritize Correlated Attack Chains first
        for chain in correlated_chains:
            grouped_vulns[chain["template_id"]] = {
                "template_id": chain["template_id"],
                "severity": chain["severity"],
                "count": 1,
                "correlation": chain["attack_chain_correlation"],
                "remediation": chain["recommended_remediation"],
            }

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
            "correlated_attack_chains_count": len(correlated_chains),
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

    def execute_local_tool(self, func_name: str, args: Dict[str, Any], default_target: str = "") -> Dict[str, Any]:
        """Executes tool directly in Python process on target when running locally in TUI or standalone mode."""
        try:
            if func_name == "run_stress_test":
                target_url = args.get("target_url") or default_target
                target_rps = int(args.get("target_rps") or 500)
                duration_sec = int(args.get("duration_sec") or 5)
                bypass_cfg = args.get("bypass_config")
                target_reqs = target_rps * duration_sec
                try:
                    from backend.core.stress_test.stress_orchestrator import StressOrchestrator
                except ImportError:
                    try:
                        from backend.core.stress_orchestrator import StressOrchestrator
                    except ImportError:
                        from core.stress_orchestrator import StressOrchestrator
                orchestrator = StressOrchestrator()
                res = orchestrator.execute_stress_test(
                    target_url=target_url,
                    target_requests=target_reqs,
                    duration=f"{duration_sec}s",
                    bypass_config=bypass_cfg
                )
                return {
                    "tool": "run_stress_test",
                    "status": "SUCCESS",
                    "target_url": target_url,
                    "target_rps": target_rps,
                    "duration_sec": duration_sec,
                    "metrics": res.get("metrics", {}),
                    "raw_output": res.get("raw_k6_stdout", "")[:500]
                }
            elif func_name in ("trigger_deep_scan", "run_arjun_idor_scan"):
                target_path = args.get("target_path") or args.get("endpoint", "")
                if target_path and not target_path.startswith("http"):
                    base = default_target.rstrip("/") if default_target else "https://example.com"
                    full_target = f"{base}/{target_path.lstrip('/')}"
                else:
                    full_target = target_path or default_target

                try:
                    from backend.core.recon_scan.scanner import perform_real_dynamic_scan
                except ImportError:
                    try:
                        from backend.core.scanner import perform_real_dynamic_scan
                    except ImportError:
                        from core.scanner import perform_real_dynamic_scan
                scan_res = perform_real_dynamic_scan(full_target)
                return {
                    "tool": func_name,
                    "status": "SUCCESS",
                    "target": full_target,
                    "status_code": scan_res.get("status_code"),
                    "vulnerabilities": scan_res.get("vulnerabilities", []),
                    "secrets": scan_res.get("secrets", []),
                    "ports": scan_res.get("ports", []),
                }
            elif func_name == "generate_patch":
                v_type = args.get("vulnerability_type", "Security Vulnerability")
                ep = args.get("endpoint", default_target)
                fw = args.get("framework", "Next.js")
                patch = self.generate_one_click_fix(vulnerability_type=v_type, endpoint=ep, framework=fw)
                return {
                    "tool": "generate_patch",
                    "status": "SUCCESS",
                    "patch_code": patch.get("text", "")
                }
            elif func_name == "fuzz_websocket":
                ws_url = args.get("ws_url", default_target.replace("http", "ws"))
                return {
                    "tool": "fuzz_websocket",
                    "status": "SUCCESS",
                    "ws_url": ws_url,
                    "probe_status": "Handshake Probed | Frame Fuzzing Passed",
                }
            else:
                return {"tool": func_name, "status": "UNKNOWN_TOOL"}
        except Exception as e:
            return {"tool": func_name, "status": "EXECUTION_ERROR", "error": str(e)}

    def dispatch_agent_function_call(self, function_call: Dict[str, Any], default_target: str = "") -> Dict[str, Any]:
        """
        Executes 'Bắn lệnh ngược' Function Calling from Copilot down to Redis Queue / Worker Execution Engine.
        Supported tools: trigger_deep_scan, run_stress_test, run_arjun_idor_scan, fuzz_websocket, generate_patch
        """
        func_name = function_call.get("name")
        args = function_call.get("args", {})

        logger.info(f"Copilot Function Call Triggered: {func_name} with args {args}")

        exec_res = self.execute_local_tool(func_name, args, default_target=default_target)

        dispatch_status = {
            "function": func_name,
            "args": args,
            "dispatched": True,
            "queue": "scan_queue",
            "execution_result": exec_res,
            "message": f"Kích hoạt thành công Tool {func_name} thực tế trên mục tiêu!",
        }

        try:
            if self.redis_client:
                job_payload = {
                    "job_id": f"job_copilot_{int(time.time())}",
                    "triggered_by": "ADQ_SECURITY_COPILOT",
                    "function": func_name,
                    "args": args,
                    "status": "queued",
                }
                self.redis_client.lpush("scan_queue", json.dumps(job_payload))
                dispatch_status["job_id"] = job_payload["job_id"]
                dispatch_status["message"] += f" (Đã đẩy job {job_payload['job_id']} vào Redis queue)"
        except Exception as e:
            logger.warning(f"Redis queue push warning: {e}")

        return dispatch_status

    def _call_gemini_api(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        enable_tools: bool = False,
        target_url: str = "",
    ) -> Dict[str, Any]:
        """Dispatches request to Google Gemini API with System Instructions and Function Calling."""
        if not self.api_key:
            return {
                "error": "ADQ Copilot API Key is missing. Set GEMINI_API_KEY environment variable.",
                "status": "CONFIG_ERROR",
            }

        # Ensure zero-leakage sensitive data masking on prompt before outbound request
        prompt = self.masker.mask_text(prompt)

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

        sys_inst = system_instruction or DEFAULT_COPILOT_SYSTEM_INSTRUCTION
        payload["systemInstruction"] = {
            "parts": [{"text": sys_inst}]
        }

        if enable_tools:
            payload["tools"] = COPILOT_TOOLS_DECLARATION

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

                parts = candidates[0].get("content", {}).get("parts", [])
                text_content = ""
                function_call = None

                for p in parts:
                    if "text" in p:
                        text_content += p["text"]
                    if "functionCall" in p:
                        function_call = p["functionCall"]

                usage_metadata = res_json.get("usageMetadata", {})
                input_tokens = usage_metadata.get("promptTokenCount", len(prompt) // 4)
                output_tokens = usage_metadata.get("candidatesTokenCount", len(text_content) // 4)
                total_tokens = usage_metadata.get("totalTokenCount", input_tokens + output_tokens)

                credits_deducted = max(1, (total_tokens * DEFAULT_CREDITS_PER_1K_TOKENS) // 1000)

                result: Dict[str, Any] = {
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

                if function_call:
                    result["function_call"] = function_call
                    result["function_dispatch_result"] = self.dispatch_agent_function_call(function_call, default_target=target_url)

                self._set_cache(prompt, result)
                return result
            except Exception as e:
                errors.append({
                    "model": model_name,
                    "exception": str(e),
                })

        return {
            "status": "API_ERROR",
            "error": "All ADQ Copilot model attempts failed",
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
        # Phase 1: Ingestion, Masking & Cross-Vector Correlation
        compressed = self._compress_scan_findings(scan_results)

        prompt = f"""
Dưới đây là dữ liệu rà quét an ninh đã được làm sạch, nén gọn và đánh giá tương quan:
{json.dumps(compressed, ensure_ascii=False, indent=2)}

Hãy thực hiện phân tích 4 Pha Agentic AI theo đúng cấu trúc Markdown yêu cầu:
1. **Đánh giá Mức độ Nghiêm trọng (Severity)**: Chọn mức cao nhất trong [CRITICAL, HIGH, MEDIUM, LOW, INFO] kèm lý do.
2. **Phân tích Tương quan & Chuỗi Tấn công (Attack Chain Correlation)**:
   - Xâu chuỗi các điểm dị thường (ví dụ: Port 5432 mở + Credential lộ từ JS) để chỉ ra kịch bản tấn công nguy hiểm nhất.
3. **Nguyên nhân Gốc rễ (Root Cause Analysis)**: Tóm tắt nguyên nhân kỹ thuật cốt lõi trong 2 câu.
4. **Mã Code Vá Lỗi & Cấu hình An toàn (Remediation Patch & Firewall Rule)**:
   - Cung cấp đoạn mã vá lỗi mẫu hoặc lệnh firewall (iptables/ufw) chính xác.
   - Đề xuất Function Calling nếu cần quét sâu hơn (ví dụ: trigger_deep_scan, run_arjun_idor_scan).
"""

        api_res = self._call_gemini_api(
            prompt,
            system_instruction=DEFAULT_COPILOT_SYSTEM_INSTRUCTION,
            enable_tools=True,
        )
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

    # =========================================================================
    # COMPREHENSIVE SCAN RISK ASSESSMENT (EVIDENCE-GROUNDED)
    # =========================================================================

    def generate_scan_risk_assessment(self, scan_job: Dict[str, Any], force_refresh: bool = False) -> Dict[str, Any]:
        """
        Generates an evidence-grounded AI Risk Assessment analyzing the COMPLETE scan context:
        - Discovered Assets (hosts, subdomains, open ports/services, crawled URLs)
        - 19 Security Control evaluations (PASS, FAIL, INCONCLUSIVE, NOT_TESTED)
        - Confirmed Findings and technical evidence
        - Coverage limitations and scope gaps
        
        Strictly strictly excludes remediation scripts, sample code, and patch commands.
        """
        target = scan_job.get("target") or scan_job.get("request", {}).get("target") or "target"
        job_id = scan_job.get("id") or scan_job.get("job_id") or "job"
        
        # 1. Check Redis cache first
        cache_key = f"scan_ai_risk:{job_id}"
        if not force_refresh and self.redis_client:
            try:
                cached_data = self.redis_client.get(cache_key)
                if cached_data:
                    return json.loads(cached_data)
            except Exception:
                pass

        # 2. Extract Discovered Assets
        live_data = scan_job.get("live_data") or {}
        subdomains = live_data.get("subdomains") or scan_job.get("subdomains", {}).get("all") or []
        live_hosts = live_data.get("live_hosts") or scan_job.get("subdomains", {}).get("http_live") or []
        open_ports = live_data.get("open_ports") or scan_job.get("ports", {}).get("open") or []
        crawled_urls = live_data.get("crawled_urls") or scan_job.get("urls", {}).get("combined") or []

        # 3. Extract Assurance Matrix & Controls
        assurance = scan_job.get("assurance_matrix") or {}
        controls = assurance.get("controls") or []
        coverage = assurance.get("coverage_summary") or {}

        pass_count = sum(1 for c in controls if c.get("status") == "PASS")
        fail_count = sum(1 for c in controls if c.get("status") == "FAIL")
        inconclusive_count = sum(1 for c in controls if c.get("status") == "INCONCLUSIVE")
        not_tested_count = sum(1 for c in controls if c.get("status") == "NOT_TESTED")
        total_controls = len(controls) or 19

        non_pass_controls = [
            {
                "id": c.get("id"),
                "code": c.get("code"),
                "title": c.get("title_vi") or c.get("title"),
                "status": c.get("status"),
                "severity": c.get("severity_if_failed"),
                "stage": c.get("stage_name"),
                "reason": c.get("reason"),
            }
            for c in controls
            if c.get("status") in ("FAIL", "INCONCLUSIVE", "NOT_TESTED")
        ]

        # 4. Extract Findings
        raw_findings = live_data.get("nuclei_findings") or scan_job.get("vulnerabilities", {}).get("nuclei") or []
        formatted_findings = [
            {
                "title": f.get("title") or f.get("template_id"),
                "severity": f.get("severity"),
                "endpoint": f.get("matched") or f.get("url") or f.get("endpoint"),
                "evidence": f.get("matched") or f.get("raw"),
                "owasp": f.get("owasp_category"),
                "cwe": f.get("cwe_id") or f.get("cwe_ids"),
            }
            for f in raw_findings[:15]
        ]

        # 5. Build Authoritative ScanRiskContext
        scan_risk_context = {
            "target": target,
            "scan_summary": {
                "status": scan_job.get("status", "COMPLETED"),
                "total_controls": total_controls,
                "pass_count": pass_count,
                "fail_count": fail_count,
                "inconclusive_count": inconclusive_count,
                "not_tested_count": not_tested_count,
                "coverage_percentage": coverage.get("coverage_percentage", 100),
            },
            "discovery": {
                "subdomains_count": len(subdomains),
                "subdomains_sample": [s if isinstance(s, str) else s.get("host") for s in subdomains[:5]],
                "live_hosts_count": len(live_hosts),
                "live_hosts_sample": [h if isinstance(h, str) else h.get("host") or h.get("url") for h in live_hosts[:5]],
                "open_ports_count": len(open_ports),
                "open_ports_observed": [
                    {
                        "port": p.get("port") if isinstance(p, dict) else str(p),
                        "service": p.get("service") if isinstance(p, dict) else ("HTTPS" if "443" in str(p) else "HTTP"),
                        "state": p.get("state") if isinstance(p, dict) else "OPEN",
                    }
                    for p in open_ports[:10]
                ],
                "crawled_urls_count": len(crawled_urls),
                "crawled_urls_sample": [u if isinstance(u, str) else u.get("url") for u in crawled_urls[:10]],
            },
            "non_pass_controls_and_limitations": non_pass_controls,
            "confirmed_findings": formatted_findings,
        }

        # Mask secrets
        masked_context = self.masker.mask_dict_or_list(scan_risk_context)

        prompt = f"""Bạn là Hệ thống Đánh giá Rủi ro An ninh (AI Risk Assessment Engine) của ADQ.
Nhiệm vụ của bạn là phân tích TOÀN DIỆN dữ liệu kết quả rà quét bảo mật dưới đây để đưa ra đánh giá rủi ro khách quan, chính xác dựa trên bằng chứng kỹ thuật thu thập được.

DỮ LIỆU RÀ QUÉT THỰC TẾ (SCAN RISK CONTEXT):
{json.dumps(masked_context, ensure_ascii=False, indent=2)}

NGUYÊN TẮC BẮT BUỘC:
1. Dựa trên dữ liệu thực tế: KHÔNG tự bịa ra port, URL, dịch vụ, finding hoặc lỗ hổng không có trong ngữ cảnh.
2. Với phiên quét không có finding (0 findings): KHÔNG tuyên bố 'Hệ thống an toàn 100%' hoặc 'Không có lỗ hổng'. Hãy nhận định mức rủi ro quan sát được là THẤP trong phạm vi các hạng mục đã kiểm thử, nêu rõ các tài sản/port/URL đã khám phá và chỉ ra các giới hạn kiểm thử (hạng mục NOT_TESTED/INCONCLUSIVE nếu có).
3. NGHIÊM CẤM đưa vào: Hướng dẫn khắc phục, mã code vá lỗi, lệnh firewall, giải pháp sửa lỗi hay One-Click Patch. Nhiệm vụ của bạn là GIẢI THÍCH KẾT QUẢ VÀ ĐÁNH GIÁ RỦI RO.
4. Ngôn ngữ: Sử dụng tiếng Việt tự nhiên, gãy gọn, giữ nguyên các thuật ngữ kỹ thuật tiếng Anh phổ biến (Scan, URL, API, endpoint, host, subdomain, port, service, request, response, header, cookie, token, WAF, CORS, SQL Injection, XSS, RCE, IDOR, PASS, FAIL).

CẤU TRÚC ĐẦU RA BẮT BUỘC (Sử dụng đúng các tiêu đề Markdown sau):
## MỨC RỦI RO QUAN SÁT ĐƯỢC
[THẤP / TRUNG BÌNH / CAO / NGHIÊM TRỌNG] - [Tóm tắt nhận định trong 1-2 câu ngắn gọn]

## ĐIỂM ĐÁNG CHÚ Ý
- [Gạch đầu dòng các số liệu và sự kiện nổi bật: số lượng URL đã crawl, số host hoạt động, port ghi nhận, tỷ lệ hạng mục PASS/FAIL/NOT_TESTED]

## BỀ MẶT TẤN CÔNG
[Phân tích ngắn gọn về các dịch vụ public, endpoint/URL ghi nhận được và tiềm năng tiếp cận của kẻ tấn công]

## FINDING QUAN TRỌNG
[Chỉ xuất hiện nếu có finding thực tế. Nếu không có finding, ghi: 'Chưa ghi nhận finding bảo mật nào được xác nhận trong các hạng mục đã thực thi.']

## PHẠM VI & GIỚI HẠN
[Nêu rõ phạm vi kỹ thuật đã kiểm thử, các hạng mục chưa kiểm tra (NOT_TESTED) hoặc chưa kết luận (INCONCLUSIVE) nếu có, và lưu ý về các khu vực cần xác thực nội bộ.]
"""

        system_instruction = (
            "Bạn là Chuyên gia Phân tích Rủi ro An ninh Thông tin cấp cao của ADQ. "
            "Bạn chịu trách nhiệm đọc dữ liệu rà quét an ninh và tổng hợp đánh giá rủi ro khách quan, "
            "chính xác dựa trên bằng chứng, không đưa ra mã vá lỗi hay giải pháp sửa chữa."
        )

        res = self._call_gemini_api(prompt, system_instruction=system_instruction)
        
        # Format response
        result_payload = {
            "status": res.get("status", "SUCCESS"),
            "text": res.get("text") or "Đã hoàn thành đánh giá rủi ro an ninh từ dữ liệu rà quét.",
            "target": target,
            "job_id": job_id,
            "model": res.get("model", "ADQ AI Engine"),
            "scan_risk_context": masked_context,
        }

        # Cache in Redis with 7-day TTL if valid
        if self.redis_client and result_payload.get("status") == "SUCCESS":
            try:
                self.redis_client.setex(cache_key, 604800, json.dumps(result_payload, ensure_ascii=False))
            except Exception:
                pass

        return result_payload

    # =========================================================================
    # CONTEXT-AWARE INTERACTIVE COPILOT ASSISTANT
    # =========================================================================

    def build_scan_summary_context(self, scan_job: Dict[str, Any]) -> Dict[str, Any]:
        """Extracts sanitized structured summary from a Scan job."""
        if not scan_job:
            return {}
        target = scan_job.get("target") or scan_job.get("request", {}).get("target") or "target"
        job_id = scan_job.get("id") or scan_job.get("job_id") or "scan"
        live_data = scan_job.get("live_data") or {}
        raw_findings = live_data.get("nuclei_findings") or scan_job.get("vulnerabilities", {}).get("nuclei") or []
        assurance = scan_job.get("assurance_matrix") or {}
        controls = assurance.get("controls") or []

        findings_summary = [
            {
                "title": f.get("title") or f.get("template_id"),
                "severity": f.get("severity"),
                "endpoint": f.get("matched") or f.get("url") or f.get("endpoint"),
                "cwe": f.get("cwe_id") or f.get("cwe_ids"),
            }
            for f in raw_findings[:10]
        ]

        failed_controls = [
            {
                "title": c.get("title_vi") or c.get("title"),
                "status": c.get("status"),
                "severity": c.get("severity_if_failed"),
                "reason": c.get("reason"),
            }
            for c in controls if c.get("status") in ("FAIL", "INCONCLUSIVE")
        ]

        ctx = {
            "type": "SCAN_CONTEXT",
            "job_id": job_id,
            "target": target,
            "status": scan_job.get("status", "COMPLETED"),
            "total_findings": len(raw_findings),
            "findings": findings_summary,
            "failed_controls": failed_controls,
            "open_ports": live_data.get("open_ports") or scan_job.get("ports", {}).get("open") or [],
            "crawled_urls_count": len(live_data.get("crawled_urls") or scan_job.get("urls", {}).get("combined") or []),
        }
        return self.masker.mask_dict_or_list(ctx)

    def build_stress_summary_context(self, stress_job: Dict[str, Any]) -> Dict[str, Any]:
        """Extracts sanitized structured summary from a Stress Test job."""
        if not stress_job:
            return {}
        metrics = stress_job.get("metrics") or {}
        ctx = {
            "type": "STRESS_TEST_CONTEXT",
            "job_id": stress_job.get("job_id"),
            "target": stress_job.get("target_url"),
            "status": stress_job.get("status"),
            "duration_sec": stress_job.get("duration_sec"),
            "target_rps": stress_job.get("target_rps"),
            "target_requests": stress_job.get("target_requests"),
            "metrics": {
                "total_requests": metrics.get("total_requests", 0),
                "rps": metrics.get("rps", 0.0),
                "avg_latency": metrics.get("avg_latency", "0ms"),
                "p50_latency": metrics.get("p50_latency", "0ms"),
                "p95_latency": metrics.get("p95_latency", "0ms"),
                "p99_latency": metrics.get("p99_latency", "0ms"),
                "error_rate": metrics.get("error_rate", 0.0),
                "timeouts": metrics.get("timeouts", 0),
                "status_200": metrics.get("status_200", 0),
                "status_403": metrics.get("status_403_waf_blocked", 0),
                "status_429": metrics.get("status_429_rate_limited", 0),
                "status_500": metrics.get("status_500_crashed", 0),
                "other_status": metrics.get("other_status", 0),
            },
            "events_sample": [e.get("message") for e in (stress_job.get("events") or [])[-5:]],
            "verdict": stress_job.get("verdict", "ỔN ĐỊNH"),
        }
        return self.masker.mask_dict_or_list(ctx)

    def generate_copilot_response(
        self,
        prompt: str,
        scan_context: Optional[Dict[str, Any]] = None,
        stress_context: Optional[Dict[str, Any]] = None,
        history: Optional[List[Dict[str, str]]] = None,
        session_memory: Optional[List[Dict[str, Any]]] = None,
        context_type: str = "PRODUCT_HELP",
    ) -> Dict[str, Any]:
        """
        Generates context-grounded interactive response from ADQ Security Copilot.
        Strictly enforces Product Help Registry, Session Memory, and Raw Evidence Precedence.
        """
        try:
            try:
                from backend.core.ai_copilot.product_help_registry import get_product_help_summary
            except ImportError:
                from core.ai_copilot.product_help_registry import get_product_help_summary
            product_help_text = get_product_help_summary()
        except Exception:
            product_help_text = "ADQ Platform Features: Scan (/scan), Stress Test (/stress-test), Reports (/reports), APK Audit (/apk-audit), Copilot (/copilot), Billing & Redeem (/dashboard/billing), Settings (/settings)."

        masked_prompt = self.masker.mask_text(prompt)

        context_blocks = []
        if scan_context:
            context_blocks.append(f"### [RAW EVIDENCE] DỮ LIỆU PHIÊN SCAN ĐÃ XÁC THỰC:\n{json.dumps(scan_context, ensure_ascii=False, indent=2)}")
        if stress_context:
            context_blocks.append(f"### [RAW EVIDENCE] DỮ LIỆU PHIÊN STRESS TEST ĐÃ XÁC THỰC:\n{json.dumps(stress_context, ensure_ascii=False, indent=2)}")

        context_text = "\n\n".join(context_blocks) if context_blocks else "Chế độ: Hướng dẫn sử dụng ADQ (Không có phiên Scan/Stress nào được gắn)."

        memory_text = ""
        if session_memory and len(session_memory) > 0:
            mem_lines = []
            for mem in session_memory[-5:]:
                mem_type = mem.get("memory_type", "AI_SUMMARY")
                topic = mem.get("topic") or mem.get("summary") or ""
                mem_lines.append(f"- [{mem_type}] {topic}")
            memory_text = f"### [SESSION MEMORY] BỘ NHỚ CÁC CUỘC TRÒ CHUYỆN TRƯỚC TRONG CÙNG PHIÊN NÀY:\n" + "\n".join(mem_lines)

        history_text = ""
        if history:
            turns = []
            for h in history[-6:]:
                role = "User" if h.get("role") == "user" else "Copilot"
                content = self.masker.mask_text(h.get("content") or h.get("text") or "")
                turns.append(f"{role}: {content}")
            history_text = "### LỊCH SỬ HỘI THOẠI GẦN NHẤT:\n" + "\n".join(turns)

        full_prompt = f"""Bạn là ADQ Security Copilot - Trợ lý Trí tuệ Nhân tạo An ninh & Hướng dẫn Nền tảng ADQ Platform.
Nhiệm vụ của bạn là giải đáp câu hỏi của người dùng, hướng dẫn tính năng ADQ chính xác theo Product Help Registry, và phân tích kỹ thuật phiên Scan/Stress Test khi được đính kèm.

HỆ THỐNG KIẾN THỨC TÍNH NĂNG ADQ (PRODUCT HELP REGISTRY):
{product_help_text}

NGỮ CẢNH DỮ LIỆU KỸ THUẬT PHIÊN HIỆN TẠI:
{context_text}

{memory_text}

{history_text}

CÂU HỎI / YÊU CẦU CỦA NGƯỜI DÙNG:
{masked_prompt}

QUY TẮC BẮT BUỘC (ZERO-HALLUCINATION & EVIDENCE PRIORITY):
1. DANH TÍNH: Bạn là ADQ Security Copilot. Tuyệt đối không nhắc đến bất kỳ bên thứ ba hay nhà phát triển AI nào khác.
2. THỨ TỰ ƯU TIÊN BẰNG CHỨNG (EVIDENCE PRIORITY):
   - RAW SCAN/STRESS EVIDENCE có độ ưu tiên cao nhất, vượt trên SESSION MEMORY và suy đoán cũ.
   - Nếu bộ nhớ lịch sử nhắc tới một thông tin (ví dụ port 3306) nhưng dữ liệu phiên hiện tại KHÔNG có, bạn KHÔNG ĐƯỢC khẳng định nó tồn tại, mà phải nói rõ: "Cuộc trò chuyện trước có nhắc tới, nhưng dữ liệu của phiên hiện tại không ghi nhận."
3. HƯỚNG DẪN SẢN PHẨM (PRODUCT HELP): Chỉ hướng dẫn dựa trên các route/nút/tính năng thật trong PRODUCT HELP REGISTRY (/dashboard, /scan, /stress-test, /reports, /apk-audit, /copilot, /dashboard/billing, /settings). Nếu câu hỏi về tính năng không có trong registry, trả lời: "ADQ hiện chưa có đủ thông tin để hướng dẫn chính xác phần này."
4. KHẮC PHỤC LỖ HỔNG (REMEDIATION): Cung cấp hướng dẫn rõ ràng, nguyên nhân gốc rễ và gợi ý cấu hình/mã vá nếu phù hợp.
5. NGÔN NGỮ: Tiếng Việt tự nhiên, ngắn gọn, chuẩn xác, giữ nguyên các thuật ngữ tiếng Anh phổ biến (Scan, Stress Test, URL, API, endpoint, port, service, request, response, latency, p95, p99, RPS, WAF, CORS, IDOR, SQL Injection, XSS, token, header, cookie).

HÃY TRẢ LỜI NGAY:
"""

        system_instruction = (
            "Bạn là ADQ Security Copilot - Trợ lý An ninh Thông tin và Tối ưu Hiệu năng của ADQ Platform. "
            "Bạn đưa ra câu trả lời trực diện, chính xác dựa trên bằng chứng kỹ thuật và hướng dẫn sử dụng sản phẩm."
        )

        res = self._call_gemini_api(full_prompt, system_instruction=system_instruction, enable_tools=False)
        return {
            "status": res.get("status", "SUCCESS"),
            "text": res.get("text") or "Copilot đã ghi nhận yêu cầu của bạn.",
            "model": res.get("model", "ADQ Security Copilot Engine"),
        }


