import time
import random
import threading
import concurrent.futures
from typing import Dict, Any, List, Optional, Generator
import requests
from requests.adapters import HTTPAdapter
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

try:
    from backend.core.security.ssrf_guard import (
        resolve_and_validate_target,
        PinnedHTTPAdapter,
        is_dev_private_allowed,
    )
except ImportError:
    from core.security.ssrf_guard import (
        resolve_and_validate_target,
        PinnedHTTPAdapter,
        is_dev_private_allowed,
    )

def _parse_duration_sec(val: Any, default: int = 15) -> int:
    if isinstance(val, (int, float)):
        return max(1, int(val))
    if isinstance(val, str):
        cleaned = val.strip().lower().rstrip("s")
        try:
            return max(1, int(cleaned))
        except ValueError:
            pass
    return default

class GlobalRatePacer:
    """
    Global thread-safe token/clock pacer to enforce strict global RPS pacing
    across all concurrent worker threads in ThreadPoolExecutor.
    """
    def __init__(self, target_rps: float):
        self.interval = 1.0 / max(0.1, float(target_rps))
        self.lock = threading.Lock()
        self.next_time = time.monotonic()

    def acquire(self):
        with self.lock:
            now = time.monotonic()
            if self.next_time <= now:
                self.next_time = now + self.interval
                sleep_time = 0.0
            else:
                sleep_time = self.next_time - now
                self.next_time += self.interval
        if sleep_time > 0:
            time.sleep(sleep_time)

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

    def _get_client_session(self, headers: dict, cookies: dict, pinned_ip: Optional[str] = None):
        s = requests.Session()
        if headers:
            s.headers.update(headers)
        if cookies:
            s.cookies.update(cookies)
        if pinned_ip:
            adapter = PinnedHTTPAdapter(pinned_ip=pinned_ip, pool_connections=100, pool_maxsize=100, max_retries=0)
        else:
            adapter = HTTPAdapter(pool_connections=100, pool_maxsize=100, max_retries=0)
        s.mount("https://", adapter)
        s.mount("http://", adapter)
        return s, False

    def verify_bypass(self, target_url: str, bypass_code: str = "", waf_type: str = "standard") -> Dict[str, Any]:
        origin, resolved_ips = resolve_and_validate_target(target_url)
        pinned_ip = resolved_ips[0]
        actual_verify = not is_dev_private_allowed()
        clean_url = origin
        
        status_no_bypass = 0
        try:
            s_raw, _ = self._get_client_session({"User-Agent": "Mozilla/5.0"}, {}, pinned_ip=pinned_ip)
            r1 = s_raw.get(clean_url, timeout=4, verify=actual_verify, allow_redirects=False)
            status_no_bypass = r1.status_code
        except Exception:
            status_no_bypass = 0

        final_url, headers, cookies = self._prepare_request_config(clean_url, bypass_code, waf_type)
        status_with_bypass = 0
        try:
            s_bypass, _ = self._get_client_session(headers, cookies, pinned_ip=pinned_ip)
            r2 = s_bypass.get(final_url, timeout=4, verify=actual_verify, allow_redirects=False)
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
        **kwargs: Any,
    ) -> Dict[str, Any]:
        # Handle keyword argument aliases for backwards compatibility
        if "target_requests" in kwargs:
            total_reqs = int(kwargs["target_requests"] or total_reqs)
        if "duration" in kwargs:
            duration_sec = _parse_duration_sec(kwargs["duration"], default=duration_sec)
        if "target_rps" not in kwargs and total_reqs and duration_sec:
            target_rps = max(1, int(round(total_reqs / max(1, duration_sec))))

        # Resolve target and pin IP once before starting worker load
        origin, resolved_ips = resolve_and_validate_target(target_url)
        pinned_ip = resolved_ips[0]
        actual_verify = not is_dev_private_allowed()

        final_url, headers_dict, cookie_dict = self._prepare_request_config(origin, bypass_code, waf_type, custom_headers, custom_cookies)

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
        pacer = GlobalRatePacer(target_rps)

        def get_worker_session():
            if not getattr(thread_local, "session", None):
                s, _ = self._get_client_session(headers_dict, cookie_dict, pinned_ip=pinned_ip)
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
                # Disallow automatic redirect following during active stress to prevent post-launch SSRF redirection
                resp = session.get(final_url, headers=req_headers, timeout=4.0, verify=actual_verify, allow_redirects=False)
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

                pacer.acquire()

                with lock:
                    if metrics["total_requests"] >= total_reqs or time.time() >= end_time:
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

        concurrency = min(50, max(5, int(target_rps * 0.3)))
        start_time = time.time()
        end_time = start_time + duration_sec
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

    def stream_stress_test(
        self,
        target_url: str,
        target_rps: int = 50,
        duration_sec: int = 15,
        total_reqs: int = 500,
        bypass_code: str = "",
        waf_type: str = "standard",
        custom_headers: Optional[Dict[str, str]] = None,
        custom_cookies: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Generator[Dict[str, Any], None, None]:
        # Handle keyword argument aliases for backwards compatibility
        if "target_requests" in kwargs:
            total_reqs = int(kwargs["target_requests"] or total_reqs)
        if "duration" in kwargs:
            duration_sec = _parse_duration_sec(kwargs["duration"], default=duration_sec)
        if "target_rps" not in kwargs and total_reqs and duration_sec:
            target_rps = max(1, int(round(total_reqs / max(1, duration_sec))))

        # Resolve target and pin IP once before starting worker load
        origin, resolved_ips = resolve_and_validate_target(target_url)
        pinned_ip = resolved_ips[0]
        actual_verify = not is_dev_private_allowed()

        final_url, headers_dict, cookie_dict = self._prepare_request_config(origin, bypass_code, waf_type, custom_headers, custom_cookies)

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
        logged_count = 0
        start_time = time.time()
        end_time = start_time + duration_sec
        lock = threading.Lock()
        thread_local = threading.local()
        pacer = GlobalRatePacer(target_rps)

        def get_worker_session():
            if not getattr(thread_local, "session", None):
                s, _ = self._get_client_session(headers_dict, cookie_dict, pinned_ip=pinned_ip)
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
                # Disallow automatic redirect following during active stress
                resp = session.get(final_url, headers=req_headers, timeout=4.0, verify=actual_verify, allow_redirects=False)
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

                pacer.acquire()

                with lock:
                    if metrics["total_requests"] >= total_reqs or time.time() >= end_time:
                        break

                log_entry = fire_request()
                code = log_entry["status"]
                lat = log_entry["latency"]

                with lock:
                    if metrics["total_requests"] < total_reqs:
                        metrics["total_requests"] += 1
                        latencies.append(lat)

                        if len(sample_logs) < 100:
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

        concurrency = min(50, max(5, int(target_rps * 0.3)))
        start_time = time.time()
        end_time = start_time + duration_sec
        executor = concurrent.futures.ThreadPoolExecutor(max_workers=concurrency)
        futures = [executor.submit(worker_batch) for _ in range(concurrency)]

        try:
            while True:
                done_workers = sum(1 for f in futures if f.done())
                is_finished = (done_workers == len(futures)) or (time.time() >= end_time + 0.5) or (metrics["total_requests"] >= total_reqs)

                with lock:
                    now_elapsed = max(0.1, time.time() - start_time)
                    current_metrics = dict(metrics)
                    current_metrics["rps"] = round(current_metrics["total_requests"] / now_elapsed, 1)
                    if latencies:
                        sorted_lat = sorted(latencies)
                        p95_idx = int(len(sorted_lat) * 0.95)
                        current_metrics["p95_latency"] = f"{sorted_lat[min(p95_idx, len(sorted_lat)-1)]}ms"
                    else:
                        current_metrics["p95_latency"] = "0ms"

                    new_logs = sample_logs[logged_count:]
                    logged_count = len(sample_logs)

                if is_finished:
                    break

                yield {
                    "ok": True,
                    "done": False,
                    "is_done": False,
                    "status": "RUNNING",
                    "metrics": current_metrics,
                    "sample_logs": new_logs,
                }
                time.sleep(0.3)

            concurrent.futures.wait(futures, timeout=2.0)
            executor.shutdown(wait=False)

            elapsed = max(0.1, time.time() - start_time)
            with lock:
                final_metrics = dict(metrics)
                final_metrics["rps"] = round(final_metrics["total_requests"] / elapsed, 1)
                if latencies:
                    latencies.sort()
                    p95_idx = int(len(latencies) * 0.95)
                    final_metrics["p95_latency"] = f"{latencies[min(p95_idx, len(latencies)-1)]}ms"
                else:
                    final_metrics["p95_latency"] = "0ms"

                remaining_logs = sample_logs[logged_count:]

            yield {
                "ok": True,
                "done": True,
                "is_done": True,
                "status": "COMPLETED",
                "metrics": final_metrics,
                "sample_logs": remaining_logs,
                "message": f"Hoàn tất stress test: {final_metrics['total_requests']} requests trong {round(elapsed, 1)}s.",
            }

        except Exception as exc:
            executor.shutdown(wait=False)
            yield {
                "ok": False,
                "done": True,
                "is_done": True,
                "status": "FAILED",
                "error": "Stress test execution failed.",
            }
