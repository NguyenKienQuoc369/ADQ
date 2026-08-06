import time
import random
import re
from typing import Any, Dict, List, Optional, Callable
import requests


# Common WAF Block Signatures in Response Body or Headers
WAF_SIGNATURES = [
    r"cloudflare",
    r"attention required! \| cloudflare",
    r"aws waf",
    r"akamai",
    r"imperva",
    r"incapsula",
    r"mod_security",
    r"sucuri",
    r"barracuda",
    r"fortinet",
    r"f5 BIG-IP",
    r"access denied",
    r"request blocked",
    r"web application firewall",
]

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) Gecko/20100101 Firefox/123.0",
]


class AdaptiveWAFEvasionEngine:
    """
    Adaptive WAF Evasion & Dynamic Rate-Limiting Engine
    - Detects WAF Block Signatures (Cloudflare, AWS WAF, Akamai, Imperva, etc.)
    - Implements Dynamic Delay + Randomized Jitter (0.1s - 2.5s)
    - Automatic Backoff on 429 Too Many Requests or 403 Forbidden
    - User-Agent & Spoofing Header Rotation (X-Forwarded-For, X-Real-IP, Client-IP)
    """

    def __init__(self, base_delay: float = 0.2, max_delay: float = 10.0, max_retries: int = 3):
        self.base_delay = base_delay
        self.current_delay = base_delay
        self.max_delay = max_delay
        self.max_retries = max_retries
        self.consecutive_blocks = 0

    def get_random_headers(self, custom_headers: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        spoof_ip = f"{random.randint(1,254)}.{random.randint(1,254)}.{random.randint(1,254)}.{random.randint(1,254)}"
        headers = {
            "User-Agent": random.choice(USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate, br",
            "X-Forwarded-For": spoof_ip,
            "X-Real-IP": spoof_ip,
            "X-Client-IP": spoof_ip,
        }
        if custom_headers:
            headers.update(custom_headers)
        return headers

    def detect_waf(self, response: requests.Response) -> Optional[str]:
        if response.status_code in (403, 406, 429, 503):
            server_header = response.headers.get("Server", "").lower()
            body_sample = response.text[:3000].lower()

            for sig in WAF_SIGNATURES:
                if re.search(sig, server_header) or re.search(sig, body_sample):
                    return sig.upper()
            if response.status_code == 429:
                return "RATE_LIMIT_429"
            if response.status_code == 403:
                return "GENERIC_WAF_BLOCK_403"
        return None

    def apply_jitter_delay(self):
        """Add randomized jitter delay to prevent static request rate detection."""
        jitter = random.uniform(0.1, 0.8)
        total_wait = self.current_delay + jitter
        time.sleep(total_wait)

    def execute_request_safe(
        self,
        request_func: Callable[[], requests.Response],
    ) -> Dict[str, Any]:
        retries = 0
        while retries <= self.max_retries:
            self.apply_jitter_delay()
            try:
                resp = request_func()
                waf_type = self.detect_waf(resp)

                if waf_type:
                    self.consecutive_blocks += 1
                    # Exponential Backoff
                    self.current_delay = min(self.max_delay, self.current_delay * 2.0)
                    retries += 1
                    if retries > self.max_retries:
                        return {
                            "success": False,
                            "waf_detected": waf_type,
                            "status_code": resp.status_code,
                            "error": f"Request blocked by WAF ({waf_type}) after {retries} retries",
                        }
                    continue

                # Request succeeded without WAF block
                self.consecutive_blocks = 0
                self.current_delay = max(self.base_delay, self.current_delay * 0.8)  # Gradually recover speed
                return {
                    "success": True,
                    "status_code": resp.status_code,
                    "response": resp,
                    "delay_used": round(self.current_delay, 3),
                }
            except Exception as exc:
                retries += 1
                self.current_delay = min(self.max_delay, self.current_delay * 1.5)
                if retries > self.max_retries:
                    return {"success": False, "error": str(exc)}
        return {"success": False, "error": "Max retries exceeded"}
