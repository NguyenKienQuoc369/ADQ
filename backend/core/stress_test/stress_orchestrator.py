import time
import random
import threading
import concurrent.futures
from typing import Dict, Any, List, Optional
import requests
from requests.adapters import HTTPAdapter
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

class StressOrchestrator:
    def __init__(self):
        pass

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
                headers["x-vercel-protection-bypass"] = clean_code
                cookies["x-vercel-protection-bypass"] = clean_code
                cookies["cf_clearance"] = clean_code

        return final_url, headers, cookies

    def _get_client_session(self, headers: dict, cookies: dict):
        s = requests.Session()
        if headers:
            s.headers.update(headers)
        if cookies:
            s.cookies.update(cookies)
        adapter = HTTPAdapter(pool_connections=100, pool_maxsize=100, max_retries=0)
        s.mount("https://", adapter)
        s.mount("http://", adapter)
        return s, False

    def verify_bypass(self, target_url: str, bypass_code: str = "", waf_type: str = "standard") -> Dict[str, Any]:
        clean_url = target_url.strip() if target_url.strip().startswith(("http://", "https://")) else f"https://{target_url.strip()}"
        
        status_no_bypass = 0
        try:
            s_raw, _ = self._get_client_session({"User-Agent": "Mozilla/5.0"}, {})
            r1 = s_raw.get(clean_url, timeout=4, verify=False, allow_redirects=True)
            status_no_bypass = r1.status_code
        except Exception:
            status_no_bypass = 0

        final_url, headers, cookies = self._prepare_request_config(clean_url, bypass_code, waf_type)
        status_with_bypass = 0
        try:
            s_bypass, _ = self._get_client_session(headers, cookies)
            r2 = s_bypass.get(final_url, timeout=4, verify=False, allow_redirects=True)
            status_with_bypass = r2.status_code
        except Exception:
            status_with_bypass = 0

        is_valid = status_with_bypass in (200, 201, 204, 304, 301, 302, 307, 308)
        msg = f"Mục tiêu phản hồi thành công (HTTP {status_with_bypass} OK)." if is_valid else f"Server phản hồi mã HTTP {status_with_bypass}."

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
        target_rps: int = 50,
        duration_sec: int = 15,
        total_reqs: int = 500,
        bypass_code: str = "",
        waf_type: str = "standard",
        custom_headers: Optional[Dict[str, str]] = None,
        custom_cookies: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
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
                resp = session.get(final_url, headers=req_headers, timeout=4.0, verify=False, allow_redirects=True)
                status_code = resp.status_code
            except Exception:
                status_code = 0

            req_latency = max(1, int((time.time() - req_start) * 1000))
            log_time = time.strftime("%H:%M:%S", time.localtime())

            return {
                "time": log_time,
                "status": status_code,
                "latency": req_latency,
                "target": final_url
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
                        elif code >= 500:
                            metrics["status_500_crashed"] += 1
                        else:
                            metrics["other_status"] += 1

                # Rate limit pacing nếu cần
                time.sleep(max(0.0, 1.0 / target_rps - 0.005))

        concurrency = min(50, max(10, int(target_rps * 0.3)))
        with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
            futures = [executor.submit(worker_batch) for _ in range(concurrency)]
            concurrent.futures.wait(futures, timeout=duration_sec + 3)

        elapsed = max(0.1, time.time() - start_time)
        metrics["rps"] = round(metrics["total_requests"] / elapsed, 1)

        if latencies:
            latencies.sort()
            p95_idx = int(len(latencies) * 0.95)
            metrics["p95_latency"] = f"{latencies[min(p95_idx, len(latencies)-1)]}ms"
        else:
            metrics["p95_latency"] = "0ms"

        return {
            "ok": True,
            "metrics": metrics,
            "sample_logs": sample_logs,
            "message": f"Hoàn tất stress test: {metrics['total_requests']} requests trong {round(elapsed, 1)}s."
        }
