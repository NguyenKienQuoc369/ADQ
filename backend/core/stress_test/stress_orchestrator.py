import os
import sys
import time
import json
import logging
import random
import threading
import urllib.parse
import concurrent.futures
from typing import Any, Dict, Optional, List
import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
logger = logging.getLogger(__name__)

class StressOrchestrator:
    def __init__(self, k6_path: Optional[str] = None):
        self.k6_path = k6_path or "k6"

    def _prepare_request_config(self, target_url: str, bypass_code: str = "", waf_type: str = "standard", custom_headers: Optional[Dict[str, str]] = None, custom_cookies: Optional[Dict[str, str]] = None):
        raw_url = target_url.strip()
        final_url = raw_url if raw_url.startswith(("http://", "https://")) else f"https://{raw_url}"

        headers = custom_headers.copy() if custom_headers else {}
        headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        headers["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
        headers["Accept-Language"] = "en-US,en;q=0.9"

        cookies = custom_cookies.copy() if custom_cookies else {}
        clean_code = bypass_code.strip().strip('"').strip("'")

        if clean_code:
            if ":" in clean_code and not clean_code.startswith("http"):
                k, v = clean_code.split(":", 1)
                headers[k.strip()] = v.strip()
            elif "=" in clean_code and not clean_code.startswith("eyJ"):
                k, v = clean_code.split("=", 1)
                cookies[k.strip()] = v.strip()
            elif clean_code.startswith("eyJ") or clean_code.lower().startswith("bearer "):
                headers["Authorization"] = clean_code if clean_code.lower().startswith("bearer ") else f"Bearer {clean_code}"
            else:
                # 1. Header Injection
                headers["x-vercel-protection-bypass"] = clean_code
                headers["x-vercel-set-bypass-cookie"] = "true"
                headers["CF-Access-Client-Id"] = clean_code
                headers["CF-Access-Client-Secret"] = clean_code
                headers["x-api-key"] = clean_code

                # 2. Cookie Injection
                cookies["x-vercel-protection-bypass"] = clean_code
                cookies["_vercel_jwt"] = clean_code
                cookies["cf_clearance"] = clean_code

                # 3. URL Query Parameter Injection
                sep = "&" if "?" in final_url else "?"
                final_url += f"{sep}x-vercel-protection-bypass={clean_code}&_vercel_protection_bypass={clean_code}&x-vercel-set-bypass-cookie=true"

        return final_url, headers, cookies

    def _get_client_session(self, headers: dict, cookies: dict):
        try:
            from curl_cffi import requests as curl_requests
            s = curl_requests.Session(impersonate="chrome120", timeout=4)
            s.headers.update(headers)
            s.cookies.update(cookies)
            return s, True
        except ImportError:
            s = requests.Session()
            s.headers.update(headers)
            s.cookies.update(cookies)
            adapter = requests.adapters.HTTPAdapter(pool_connections=40, pool_maxsize=40, max_retries=0)
            s.mount("https://", adapter)
            s.mount("http://", adapter)
            return s, False

    def verify_bypass(self, target_url: str, bypass_code: str = "", waf_type: str = "standard") -> Dict[str, Any]:
        clean_url = target_url.strip() if target_url.strip().startswith(("http://", "https://")) else f"https://{target_url.strip()}"
        
        status_no_bypass = 0
        try:
            s_raw, _ = self._get_client_session({"User-Agent": "Mozilla/5.0"}, {})
            r1 = s_raw.get(clean_url, timeout=3.5, verify=False, allow_redirects=True)
            status_no_bypass = r1.status_code
        except Exception:
            status_no_bypass = 500

        final_url, headers, cookies = self._prepare_request_config(clean_url, bypass_code, waf_type)
        status_with_bypass = 0
        try:
            s_bypass, _ = self._get_client_session(headers, cookies)
            r2 = s_bypass.get(final_url, timeout=3.5, verify=False, allow_redirects=True)
            status_with_bypass = r2.status_code
        except Exception:
            status_with_bypass = 500

        is_valid = status_with_bypass in (200, 201, 204, 304, 301, 302, 307, 308)
        msg = ""
        if is_valid:
            if status_no_bypass == 403:
                msg = f"Mã Bypass CHÍNH XÁC! Đã mở khóa WAF (HTTP 403 -> HTTP {status_with_bypass} OK)."
            else:
                msg = f"Mục tiêu phản hồi thành công (HTTP {status_with_bypass} OK)."
        else:
            if status_with_bypass == 403:
                msg = "Server vẫn trả về HTTP 403. Hãy kiểm tra lại chuỗi Secret hoặc cấu hình WAF."
            elif status_with_bypass == 429:
                msg = "Server đang kích hoạt Rate Limit (HTTP 429 Too Many Requests)."
            else:
                msg = f"Server phản hồi mã HTTP {status_with_bypass}."

        return {
            "ok": True,
            "is_valid": is_valid,
            "status_no_bypass": status_no_bypass,
            "status_with_bypass": status_with_bypass,
            "message": msg,
            "target": clean_url
        }

    def execute_stress_test(
        self,
        target_url: str,
        target_requests: int = 1000,
        duration: str = "5s",
        bypass_code: str = "",
        waf_type: str = "standard",
        custom_headers: Optional[Dict[str, str]] = None,
        custom_cookies: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        duration_sec = 5
        if duration.endswith("s"):
            try:
                duration_sec = max(1, int(duration[:-1]))
            except ValueError:
                duration_sec = 5
        elif duration.endswith("m"):
            try:
                duration_sec = max(1, int(duration[:-1]) * 60)
            except ValueError:
                duration_sec = 60

        total_reqs = max(5, target_requests)
        target_rps = max(1, int(total_reqs / duration_sec))

        final_url, headers_dict, cookie_dict = self._prepare_request_config(target_url, bypass_code, waf_type, custom_headers, custom_cookies)

        metrics = {
            "total_requests": 0,
            "target_requests": total_reqs,
            "target_rps": target_rps,
            "status_200": 0,
            "status_403_waf_blocked": 0,
            "status_429_rate_limited": 0,
            "status_500_crashed": 0,
            "other_status": 0,
            "rps": 0.0,
            "p95_latency": "0ms",
        }

        latencies: List[int] = []
        sample_logs: List[Dict[str, Any]] = []
        start_time = time.time()
        end_time = start_time + duration_sec
        lock = threading.Lock()
        thread_local = threading.local()

        def get_worker_session():
            if not getattr(thread_local, "session", None):
                s, _ = self._get_client_session(headers_dict, cookie_dict)
                thread_local.session = s
            return thread_local.session

        def fire_request():
            session = get_worker_session()
            spoofed_ip = f"{random.randint(11,220)}.{random.randint(1,254)}.{random.randint(1,254)}.{random.randint(1,254)}"
            req_headers = {
                "X-Forwarded-For": spoofed_ip,
                "X-Real-IP": spoofed_ip,
                "True-Client-IP": spoofed_ip,
            }
            req_start = time.time()
            status_code = 0

            try:
                resp = session.get(final_url, headers=req_headers, timeout=3.0, verify=False, allow_redirects=True)
                status_code = resp.status_code
            except Exception:
                status_code = 500

            req_latency = max(1, int((time.time() - req_start) * 1000))
            log_time = time.strftime("%H:%M:%S", time.localtime())

            return {
                "time": log_time,
                "ip": spoofed_ip,
                "status": status_code,
                "latency": req_latency,
            }

        def worker_batch():
            while time.time() < end_time:
                with lock:
                    if metrics["total_requests"] >= total_reqs:
                        break

                log_entry = fire_request()
                code = log_entry["status"]
                lat = log_entry["latency"]

                with lock:
                    if metrics["total_requests"] < total_reqs:
                        metrics["total_requests"] += 1
                        latencies.append(lat)

                        if len(sample_logs) < 80:
                            sample_logs.append(log_entry)

                        if code in (200, 201, 204, 304, 301, 302, 307, 308):
                            metrics["status_200"] += 1
                        elif code == 403:
                            metrics["status_403_waf_blocked"] += 1
                        elif code == 429:
                            metrics["status_429_rate_limited"] += 1
                        elif code >= 500 or code == 0:
                            metrics["status_500_crashed"] += 1
                        else:
                            metrics["other_status"] += 1

        concurrency = min(40, max(8, int(target_rps * 0.2)))
        with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
            futures = [executor.submit(worker_batch) for _ in range(concurrency)]
            concurrent.futures.wait(futures, timeout=duration_sec + 3)

        elapsed = max(0.1, time.time() - start_time)
        metrics["rps"] = round(metrics["total_requests"] / elapsed, 1)
        if latencies:
            sorted_l = sorted(latencies)
            p95_idx = int(len(sorted_l) * 0.95)
            metrics["p95_latency"] = f"{sorted_l[min(p95_idx, len(sorted_l)-1)]}ms"

        return {
            "ok": True,
            "target_url": final_target_url,
            "duration": f"{duration_sec}s",
            "metrics": metrics,
            "sample_logs": sample_logs,
            "bypass_active": bool(clean_code),
            "waf_applied": (waf_type or "standard").lower().strip(),
        }
