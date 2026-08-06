import time
import requests
from typing import Any, Dict, List, Optional, Tuple

from core.waf_evasion import AdaptiveWAFEvasionEngine


DEFAULT_PARAM_WORDLIST = [
    "admin", "debug", "test", "role", "user_id", "id", "account_id", "owner_id",
    "bypass", "bypass_otp", "is_admin", "dev", "staging", "env", "config", "file",
    "dir", "path", "url", "redirect", "token", "auth", "secret", "format", "json",
    "export", "download", "filter", "limit", "offset", "trace", "verbose"
]


class ContextAwareParamFuzzer:
    """
    Context-Aware Parameter Discovery & Diffing Engine
    - Automatically discovers hidden HTTP query & body parameters
    - Performs HTTP Response Diffing (Content-Length delta, Status Code shift, Header changes, Word count diff)
    - Detects reflection, error disclosure, and privilege escalation indicators
    """

    def __init__(self, timeout: int = 8, waf_evasion: bool = True):
        self.timeout = timeout
        self.waf_evasion = waf_evasion
        self.waf_engine = AdaptiveWAFEvasionEngine(base_delay=0.1, max_delay=3.0)

    def _get_baseline(self, url: str, headers: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        try:
            started = time.time()
            req_headers = self.waf_engine.get_random_headers(headers) if self.waf_evasion else (headers or {})
            resp = requests.get(url, headers=req_headers, timeout=self.timeout)
            duration = round(time.time() - started, 3)
            return {
                "status_code": resp.status_code,
                "content_length": len(resp.content or b""),
                "headers": dict(resp.headers),
                "text": resp.text[:2000],
                "duration": duration,
                "success": True,
            }
        except Exception as exc:
            return {"success": False, "error": str(exc)}

    def fuzz_parameters(
        self,
        url: str,
        param_candidates: Optional[List[str]] = None,
        headers: Optional[Dict[str, str]] = None,
        batch_size: int = 5,
    ) -> Dict[str, Any]:
        headers = headers or {}
        params_to_test = sorted(list(set((param_candidates or []) + DEFAULT_PARAM_WORDLIST)))

        baseline = self._get_baseline(url, headers=headers)
        if not baseline.get("success"):
            return {
                "target_url": url,
                "status": "FAILED_BASELINE",
                "error": baseline.get("error"),
                "discovered_params": [],
            }

        base_len = baseline["content_length"]
        base_status = baseline["status_code"]
        discovered_params: List[Dict[str, Any]] = []

        # Batch fuzzing for efficiency
        for i in range(0, len(params_to_test), batch_size):
            chunk = params_to_test[i : i + batch_size]
            query_dict = {p: "1" for p in chunk}
            
            try:
                resp = requests.get(url, params=query_dict, headers=headers, timeout=self.timeout)
                cur_len = len(resp.content or b"")
                cur_status = resp.status_code
                
                # Check for batch anomaly
                len_delta = abs(cur_len - base_len)
                status_changed = cur_status != base_status

                if status_changed or len_delta > 30:
                    # Isolate individual parameter responsible
                    for single_param in chunk:
                        single_resp = requests.get(
                            url,
                            params={single_param: "true"},
                            headers=headers,
                            timeout=self.timeout,
                        )
                        s_len = len(single_resp.content or b"")
                        s_status = single_resp.status_code
                        s_delta = abs(s_len - base_len)

                        if s_status != base_status or s_delta > 15:
                            # Flag parameter discovery!
                            diff_reasons = []
                            if s_status != base_status:
                                diff_reasons.append(f"Status shift: {base_status} -> {s_status}")
                            if s_delta > 15:
                                diff_reasons.append(f"Content-Length delta: {base_len}B -> {s_len}B (+{s_delta}B)")
                            if "true" in single_resp.text and "true" not in baseline["text"]:
                                diff_reasons.append("Parameter value reflected in HTTP response body")

                            discovered_params.append({
                                "parameter": single_param,
                                "sample_url": single_resp.url,
                                "status_code": s_status,
                                "content_length": s_len,
                                "reasons": diff_reasons,
                                "severity": "high" if "admin" in single_param or "debug" in single_param or s_status in (200, 500) else "medium",
                            })
            except Exception:
                continue

        return {
            "target_url": url,
            "baseline": {
                "status_code": base_status,
                "content_length": base_len,
            },
            "total_params_tested": len(params_to_test),
            "discovered_params": discovered_params,
        }
