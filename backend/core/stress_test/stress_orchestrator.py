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
        self.verify_tls = False

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
        # 1. Tính toán thời gian và tốc độ
        duration_sec = 5
        raw_dur = (duration or "5s").strip().lower()
        if raw_dur.endswith("s"):
            try:
                duration_sec = max(1, int(raw_dur[:-1]))
            except ValueError:
                duration_sec = 5
        elif raw_dur.endswith("m"):
            try:
                duration_sec = max(1, int(raw_dur[:-1]) * 60)
            except ValueError:
                duration_sec = 60

        total_reqs = max(5, min(int(target_requests or 1000), 50000))
        target_rps = max(1, int(total_reqs / duration_sec))

        # 2. Chuẩn hóa Headers Browser thực thụ (Tránh bị WAF Bot Filter chặn)
        headers_dict: Dict[str, str] = custom_headers.copy() if custom_headers else {}
        headers_dict["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        headers_dict["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
        headers_dict["Accept-Language"] = "en-US,en;q=0.9"
        headers_dict["Connection"] = "keep-alive"

        cookie_dict: Dict[str, str] = custom_cookies.copy() if custom_cookies else {}
        clean_code = (bypass_code or "").strip()
        norm_waf = (waf_type or "standard").lower().strip()
        final_target_url = target_url.strip()

        # 3. TIÊM MÃ BYPASS 3 TẦNG (URL QUERY + HEADERS + COOKIES)
        if clean_code:
            if ":" in clean_code and not clean_code.startswith("http"):
                k, v = clean_code.split(":", 1)
                headers_dict[k.strip()] = v.strip()
            elif "=" in clean_code and not clean_code.startswith("eyJ"):
                k, v = clean_code.split("=", 1)
                cookie_dict[k.strip()] = v.strip()
            elif clean_code.startswith("eyJ") or clean_code.lower().startswith("bearer "):
                headers_dict["Authorization"] = clean_code if clean_code.lower().startswith("bearer ") else f"Bearer {clean_code}"
            else:
                # Tiêm Vercel Protection Bypass
                headers_dict["x-vercel-protection-bypass"] = clean_code
                headers_dict["x-vercel-set-bypass-cookie"] = "samesitenone"
                cookie_dict["x-vercel-protection-bypass"] = clean_code
                cookie_dict["_vercel_jwt"] = clean_code

                # Tiêm URL Query Parameter
                sep = "&" if "?" in final_target_url else "?"
                final_target_url += f"{sep}x-vercel-protection-bypass={clean_code}&x-vercel-set-bypass-cookie=samesitenone"

                # Tiêm Cloudflare & AWS WAF
                headers_dict["CF-Access-Client-Id"] = clean_code
                headers_dict["CF-Access-Client-Secret"] = clean_code
                headers_dict["x-api-key"] = clean_code
                cookie_dict["cf_clearance"] = clean_code

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
        start_time = time.perf_counter()
        end_time = start_time + duration_sec
        lock = threading.Lock()
        stop_event = threading.Event()
        thread_local = threading.local()

        # Dải IP cụm mô phỏng trinh sát
        ip_prefixes = ["108.162.24", "162.158.10", "172.70.142", "172.70.13", "198.41.214", "103.21.244"]

        def get_worker_session() -> requests.Session:
            session = getattr(thread_local, "session", None)
            if session is None:
                session = requests.Session()
                session.headers.update(headers_dict)
                session.cookies.update(cookie_dict)
                adapter = requests.adapters.HTTPAdapter(pool_connections=60, pool_maxsize=60, max_retries=0)
                session.mount("https://", adapter)
                session.mount("http://", adapter)
                thread_local.session = session
            return session

        def fire_single_request() -> Dict[str, Any]:
            session = get_worker_session()
            prefix = random.choice(ip_prefixes)
            spoofed_ip = f"{prefix}.{random.randint(1, 254)}"
            req_headers = {
                "X-Forwarded-For": spoofed_ip,
                "X-Real-IP": spoofed_ip,
                "True-Client-IP": spoofed_ip,
            }

            req_start = time.perf_counter()
            status_code = 0

            try:
                resp = session.get(
                    final_target_url,
                    headers=req_headers,
                    timeout=4.0,
                    verify=False,
                    allow_redirects=True
                )
                status_code = resp.status_code
            except requests.exceptions.HTTPError as he:
                status_code = he.response.status_code if he.response else 500
            except Exception:
                status_code = 500

            latency = max(1, int((time.perf_counter() - req_start) * 1000))
            return {
                "time": time.strftime("%H:%M:%S", time.localtime()),
                "ip": spoofed_ip,
                "status": status_code,
                "latency": latency,
            }

        def worker():
            while not stop_event.is_set() and time.perf_counter() < end_time:
                with lock:
                    if metrics["total_requests"] >= total_reqs:
                        stop_event.set()
                        return

                entry = fire_single_request()
                code = entry["status"]
                latency = entry["latency"]

                with lock:
                    if metrics["total_requests"] >= total_reqs:
                        stop_event.set()
                        return

                    metrics["total_requests"] += 1
                    latencies.append(latency)
                    if len(sample_logs) < 160:
                        sample_logs.append(entry)

                    if code in (200, 201, 202, 204, 206, 301, 302, 304):
                        metrics["status_200"] += 1
                    elif code == 403:
                        metrics["status_403_waf_blocked"] += 1
                    elif code == 429:
                        metrics["status_429_rate_limited"] += 1
                    elif code == 0 or code >= 500:
                        metrics["status_500_crashed"] += 1
                    else:
                        metrics["other_status"] += 1

        concurrency = min(120, max(8, int(target_rps * 0.35)))
        with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
            futures = [executor.submit(worker) for _ in range(concurrency)]
            concurrent.futures.wait(futures, timeout=duration_sec + 5)
            stop_event.set()

        elapsed = max(0.1, time.perf_counter() - start_time)
        metrics["rps"] = round(metrics["total_requests"] / elapsed, 1)
        if latencies:
            latencies.sort()
            p95_idx = min(len(latencies) - 1, max(0, int((len(latencies) - 1) * 0.95)))
            metrics["p95_latency"] = f"{latencies[p95_idx]}ms"

        return {
            "ok": True,
            "target_url": final_target_url,
            "duration": f"{duration_sec}s",
            "metrics": metrics,
            "sample_logs": sample_logs,
            "bypass_active": bool(clean_code),
            "waf_applied": norm_waf,
        }
