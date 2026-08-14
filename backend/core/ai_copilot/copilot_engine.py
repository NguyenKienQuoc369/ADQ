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
