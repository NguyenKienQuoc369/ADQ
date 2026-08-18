import os
import sys
import time
import ssl
import json
import logging
import random
import threading
import urllib.request
import urllib.error
import concurrent.futures
from typing import Any, Dict, Optional, List

logger = logging.getLogger(__name__)
ssl_unverified_context = ssl._create_unverified_context()

class StressOrchestrator:
    def __init__(self, k6_path: Optional[str] = None):
        self.k6_path = k6_path or "k6"

    def execute_stress_test(
        self,
        target_url: str,
        target_requests: int = 1000,
        duration: str = "5s",
        bypass_code: str = "",
        custom_headers: Optional[Dict[str, str]] = None,
        custom_cookies: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        # 1. Tính toán thời gian và số lượng request
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

        # 2. Xử lý & Nạp mã Bypass vào Header và Cookie
        headers_dict: Dict[str, str] = custom_headers.copy() if custom_headers else {}
        headers_dict["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        headers_dict["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        headers_dict["Connection"] = "keep-alive"

        cookie_items: List[str] = []
        if custom_cookies:
            for k, v in custom_cookies.items():
                if k and v:
                    cookie_items.append(f"{k.strip()}={v.strip()}")

        clean_code = bypass_code.strip() if bypass_code else ""
        if clean_code:
            if ":" in clean_code and not clean_code.startswith("http"):
                k, v = clean_code.split(":", 1)
                headers_dict[k.strip()] = v.strip()
            elif "=" in clean_code and not clean_code.startswith("eyJ"):
                k, v = clean_code.split("=", 1)
                cookie_items.append(f"{k.strip()}={v.strip()}")
            elif clean_code.startswith("eyJ") or clean_code.lower().startswith("bearer "):
                headers_dict["Authorization"] = clean_code if clean_code.lower().startswith("bearer ") else f"Bearer {clean_code}"
            else:
                # Universal Bypass Injection
                headers_dict["x-vercel-protection-bypass"] = clean_code
                headers_dict["x-vercel-set-bypass-cookie"] = "true"
                headers_dict["CF-Access-Client-Id"] = clean_code
                headers_dict["x-api-key"] = clean_code
                cookie_items.append(f"cf_clearance={clean_code}")
                cookie_items.append(f"x-vercel-protection-bypass={clean_code}")

        if cookie_items:
            headers_dict["Cookie"] = "; ".join(cookie_items)

        # 3. Khởi tạo bộ lưu trữ dữ liệu thực tế
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

        # Kiểm tra TLS engine
        try:
            from curl_cffi import requests as curl_cffi_requests
            has_curl = True
        except ImportError:
            has_curl = False

        thread_local = threading.local()

        def get_worker_session():
            if not getattr(thread_local, "session", None):
                if has_curl:
                    thread_local.session = curl_cffi_requests.Session(impersonate="chrome120", timeout=3)
                else:
                    thread_local.session = None
            return thread_local.session

        def fire_single_real_request():
            req_headers = headers_dict.copy()
            # Xoay tua IP nguồn thực tế gửi kèm
            spoofed_ip = f"{random.randint(11,220)}.{random.randint(1,254)}.{random.randint(1,254)}.{random.randint(1,254)}"
            req_headers["X-Forwarded-For"] = spoofed_ip
            req_headers["X-Real-IP"] = spoofed_ip
            req_headers["True-Client-IP"] = spoofed_ip

            req_start = time.time()
            status_code = 0
            session = get_worker_session()

            if session is not None:
                try:
                    resp = session.get(target_url, headers=req_headers, timeout=3)
                    status_code = resp.status_code
                except Exception:
                    status_code = 500
            else:
                req = urllib.request.Request(target_url, headers=req_headers, method="GET")
                try:
                    with urllib.request.urlopen(req, timeout=3, context=ssl_unverified_context) as response:
                        status_code = response.getcode()
                except urllib.error.HTTPError as he:
                    status_code = he.code
                except Exception:
                    status_code = 500

            req_latency = max(1, int((time.time() - req_start) * 1000))
            log_time = time.strftime("%H:%M:%S", time.localtime())
            
            return {
                "time": log_time,
                "ip": spoofed_ip,
                "status": status_code,
                "latency": req_latency
            }

        def worker_batch():
            while time.time() < end_time:
                with lock:
                    if metrics["total_requests"] >= total_reqs:
                        break
                
                log_entry = fire_single_real_request()
                code = log_entry["status"]
                lat = log_entry["latency"]

                with lock:
                    if metrics["total_requests"] < total_reqs:
                        metrics["total_requests"] += 1
                        latencies.append(lat)
                        
                        # Lưu tối đa 80 log thực tế để gửi về War Room
                        if len(sample_logs) < 80:
                            sample_logs.append(log_entry)

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

        concurrency = min(200, max(15, int(target_rps * 0.4)))
        with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
            futures = [executor.submit(worker_batch) for _ in range(concurrency)]
            concurrent.futures.wait(futures, timeout=duration_sec + 3)

        elapsed = max(0.1, time.time() - start_time)
        metrics["rps"] = round(metrics["total_requests"] / elapsed, 1)
        if latencies:
            latencies.sort()
            p95_idx = int(len(latencies) * 0.95)
            metrics["p95_latency"] = f"{latencies[min(p95_idx, len(latencies)-1)]}ms"

        return {
            "ok": True,
            "target_url": target_url,
            "duration": f"{duration_sec}s",
            "metrics": metrics,
            "sample_logs": sample_logs,
            "bypass_active": bool(clean_code),
        }
