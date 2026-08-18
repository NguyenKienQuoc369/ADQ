import os
import time
import json
import logging
import random
import tempfile
import threading
import subprocess
import urllib.request
import urllib.error
import urllib.parse
import concurrent.futures
from typing import Any, Dict, Optional, List

logger = logging.getLogger(__name__)

class StressOrchestrator:
    def __init__(self, k6_path: Optional[str] = None):
        import shutil
        import sys
        if k6_path:
            self.k6_path = k6_path
        else:
            found = shutil.which("k6")
            if found:
                self.k6_path = found
            else:
                venv_k6 = os.path.join(sys.prefix, "bin", "k6")
                self.k6_path = venv_k6 if os.path.exists(venv_k6) else "k6"

    def is_k6_available(self) -> bool:
        try:
            res = subprocess.run([self.k6_path, "version"], capture_output=True, text=True, timeout=3)
            return res.returncode == 0
        except Exception:
            return False

    def execute_stress_test(
        self,
        target_url: str,
        bearer_token: str = "",
        method: str = "GET",
        headers: Optional[Dict[str, str]] = None,
        body: Optional[str] = None,
        vus: int = 50,
        duration: str = "10s",
        bypass_config: Optional[Dict[str, Any]] = None,
        stats_callback: Optional[Any] = None,
    ) -> Dict[str, Any]:
        duration_sec = 10
        if duration.endswith("s"):
            try:
                duration_sec = int(duration[:-1])
            except ValueError:
                duration_sec = 10
        elif duration.endswith("m"):
            try:
                duration_sec = int(duration[:-1]) * 60
            except ValueError:
                duration_sec = 60

        # Chuẩn hóa Headers & Bypass Profile
        headers_dict = headers.copy() if headers else {}
        
        # 1. Nạp Bypass Headers
        if bypass_config and isinstance(bypass_config.get("headers"), dict):
            for k, v in bypass_config["headers"].items():
                if k and v:
                    headers_dict[k.strip()] = str(v).strip()

        # 2. Nạp Bypass Cookies
        if bypass_config and isinstance(bypass_config.get("cookies"), dict):
            cookie_parts = []
            for k, v in bypass_config["cookies"].items():
                if k and v:
                    cookie_parts.append(f"{k.strip()}={v.strip()}")
            if cookie_parts:
                c_str = "; ".join(cookie_parts)
                if "Cookie" in headers_dict:
                    headers_dict["Cookie"] += f"; {c_str}"
                else:
                    headers_dict["Cookie"] = c_str

        # 3. Nạp Bearer Token / Universal Secret
        if bearer_token:
            clean_token = bearer_token.strip()
            if clean_token.startswith("eyJ") or clean_token.lower().startswith("bearer "):
                headers_dict["Authorization"] = clean_token if clean_token.lower().startswith("bearer ") else f"Bearer {clean_token}"
            else:
                headers_dict["Authorization"] = f"Bearer {clean_token}"
                headers_dict["x-vercel-protection-bypass"] = clean_token
                headers_dict["x-vercel-set-bypass-cookie"] = "true"

        if "User-Agent" not in headers_dict:
            headers_dict["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

        body_bytes = body.encode("utf-8") if body else None

        metrics = {
            "total_requests": 0,
            "status_200": 0,
            "status_403_waf_blocked": 0,
            "status_429_rate_limited": 0,
            "status_500_crashed": 0,
            "other_status": 0,
            "rps": 0.0,
            "p95_latency": "0ms",
        }

        latencies: List[int] = []
        start_time = time.time()
        end_time = start_time + max(1, duration_sec)

        # Kiểm tra curl_cffi để giả lập TLS JA3/JA4 vượt qua Cloudflare/Vercel
        try:
            from curl_cffi import requests as curl_cffi_requests
            has_curl_cffi = True
        except ImportError:
            has_curl_cffi = False

        thread_local = threading.local()

        def get_worker_session():
            if not getattr(thread_local, "session", None):
                if has_curl_cffi:
                    thread_local.session = curl_cffi_requests.Session(impersonate="chrome120", timeout=5)
                else:
                    thread_local.session = None
            return thread_local.session

        enable_ip_spoofing = bypass_config.get("auto_ip_spoof", True) if bypass_config else True

        def single_request_worker(worker_id: int):
            req_headers = headers_dict.copy()

            # Multi-Header IP Spoofing để bypass IP-based Rate Limiter
            if enable_ip_spoofing:
                spoofed_ip = f"{random.randint(11,220)}.{random.randint(1,254)}.{random.randint(1,254)}.{random.randint(1,254)}"
                req_headers["X-Forwarded-For"] = spoofed_ip
                req_headers["X-Real-IP"] = spoofed_ip
                req_headers["True-Client-IP"] = spoofed_ip
                req_headers["Client-IP"] = spoofed_ip

            req_start = time.time()
            status_code = 0
            session = get_worker_session()

            if session is not None:
                try:
                    resp = session.request(
                        method=method.upper(),
                        url=target_url,
                        headers=req_headers,
                        data=body if body else None,
                        timeout=5
                    )
                    status_code = resp.status_code
                except Exception:
                    status_code = 500
            else:
                req = urllib.request.Request(
                    target_url,
                    data=body_bytes,
                    headers=req_headers,
                    method=method.upper()
                )
                try:
                    with urllib.request.urlopen(req, timeout=5) as response:
                        status_code = response.getcode()
                except urllib.error.HTTPError as he:
                    status_code = he.code
                except Exception:
                    status_code = 500

            req_latency = int((time.time() - req_start) * 1000)
            return status_code, req_latency

        workers_count = max(10, min(vus, 300))

        def continuous_worker():
            while time.time() < end_time:
                code, lat = single_request_worker(0)
                latencies.append(lat)
                metrics["total_requests"] += 1

                if code in (200, 201, 204):
                    metrics["status_200"] += 1
                elif code == 403:
                    metrics["status_403_waf_blocked"] += 1
                elif code == 429:
                    metrics["status_429_rate_limited"] += 1
                elif code >= 500 or code == 0:
                    metrics["status_500_crashed"] += 1
                else:
                    metrics["other_status"] += 1

        with concurrent.futures.ThreadPoolExecutor(max_workers=workers_count) as executor:
            futures = [executor.submit(continuous_worker) for _ in range(workers_count)]
            concurrent.futures.wait(futures)

        elapsed = time.time() - start_time
        metrics["rps"] = round(metrics["total_requests"] / max(0.1, elapsed), 1)
        if latencies:
            latencies.sort()
            p95_idx = int(len(latencies) * 0.95)
            metrics["p95_latency"] = f"{latencies[min(p95_idx, len(latencies)-1)]}ms"

        return {
            "ok": True,
            "target_url": target_url,
            "vus": vus,
            "duration": f"{duration_sec}s",
            "metrics": metrics,
            "bypass_applied": bool(bypass_config and (bypass_config.get("headers") or bypass_config.get("cookies"))),
        }
