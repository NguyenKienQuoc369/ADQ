import os
import time
import json
import logging
import random
import threading
import urllib.request
import urllib.error
import concurrent.futures
from typing import Any, Dict, Optional, List

logger = logging.getLogger(__name__)

class StressOrchestrator:
    def __init__(self, k6_path: Optional[str] = None):
        self.k6_path = k6_path or "k6"

    def execute_stress_test(
        self,
        target_url: str,
        bearer_token: str = "",
        method: str = "GET",
        headers: Optional[Dict[str, str]] = None,
        body: Optional[str] = None,
        target_requests: int = 100,
        duration: str = "5s",
        bypass_config: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        # 1. Chuyển đổi thời gian chạy
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

        total_reqs_target = max(1, target_requests)
        target_rps = round(total_reqs_target / duration_sec, 1)

        # 2. Xây dựng Headers và Cookie Container
        headers_dict: Dict[str, str] = headers.copy() if headers else {}
        cookie_dict: Dict[str, str] = {}

        # Nạp Bypass Headers
        if bypass_config and isinstance(bypass_config.get("headers"), dict):
            for k, v in bypass_config["headers"].items():
                if k and str(v).strip():
                    headers_dict[k.strip()] = str(v).strip()

        # Nạp Bypass Cookies
        if bypass_config and isinstance(bypass_config.get("cookies"), dict):
            for k, v in bypass_config["cookies"].items():
                if k and str(v).strip():
                    cookie_dict[k.strip()] = str(v).strip()

        # Nạp Token / Secret
        if bearer_token and bearer_token.strip():
            clean_tok = bearer_token.strip()
            if clean_tok.startswith("eyJ") or clean_tok.lower().startswith("bearer "):
                headers_dict["Authorization"] = clean_tok if clean_tok.lower().startswith("bearer ") else f"Bearer {clean_tok}"
            else:
                headers_dict["Authorization"] = f"Bearer {clean_tok}"
                headers_dict["x-vercel-protection-bypass"] = clean_tok
                cookie_dict["x-vercel-set-bypass-cookie"] = "true"

        # Gộp Cookie thành chuỗi
        if cookie_dict:
            cookie_header_val = "; ".join([f"{k}={v}" for k, v in cookie_dict.items()])
            headers_dict["Cookie"] = cookie_header_val

        if "User-Agent" not in headers_dict:
            headers_dict["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

        body_bytes = body.encode("utf-8") if body else None

        metrics = {
            "total_requests": 0,
            "target_requests": total_reqs_target,
            "configured_duration": f"{duration_sec}s",
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
        start_time = time.time()
        end_time = start_time + duration_sec

        try:
            from curl_cffi import requests as curl_cffi_requests
            has_curl_cffi = True
        except ImportError:
            has_curl_cffi = False

        thread_local = threading.local()

        def get_worker_session():
            if not getattr(thread_local, "session", None):
                if has_curl_cffi:
                    thread_local.session = curl_cffi_requests.Session(impersonate="chrome120", timeout=4)
                else:
                    thread_local.session = None
            return thread_local.session

        auto_ip = bypass_config.get("auto_ip_spoof", True) if bypass_config else True

        def send_single_request():
            req_headers = headers_dict.copy()
            if auto_ip:
                spoofed = f"{random.randint(11,220)}.{random.randint(1,254)}.{random.randint(1,254)}.{random.randint(1,254)}"
                req_headers["X-Forwarded-For"] = spoofed
                req_headers["X-Real-IP"] = spoofed
                req_headers["True-Client-IP"] = spoofed

            req_start = time.time()
            status_code = 0
            session = get_worker_session()

            if session is not None:
                try:
                    resp = session.request(
                        method=method.upper(),
                        url=target_url,
                        headers=req_headers,
                        cookies=cookie_dict if cookie_dict else None,
                        data=body if body else None,
                        timeout=4
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
                    with urllib.request.urlopen(req, timeout=4) as response:
                        status_code = response.getcode()
                except urllib.error.HTTPError as he:
                    status_code = he.code
                except Exception:
                    status_code = 500

            req_latency = int((time.time() - req_start) * 1000)
            return status_code, req_latency

        # Điều phối luồng request chính xác theo tốc độ (Total Requests / Duration)
        delay_interval = float(duration_sec) / float(total_reqs_target)
        lock = threading.Lock()

        def dispatch_worker(req_idx: int):
            code, lat = send_single_request()
            with lock:
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

        workers_pool = min(150, max(10, int(target_rps * 1.5)))
        with concurrent.futures.ThreadPoolExecutor(max_workers=workers_pool) as executor:
            futures = []
            for i in range(total_reqs_target):
                if time.time() >= end_time:
                    break
                futures.append(executor.submit(dispatch_worker, i))
                time.sleep(delay_interval)

            concurrent.futures.wait(futures, timeout=duration_sec + 2)

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
            "bypass_active": bool(headers_dict.get("x-vercel-protection-bypass") or headers_dict.get("CF-Access-Client-Id") or headers_dict.get("x-api-key") or cookie_dict),
        }
