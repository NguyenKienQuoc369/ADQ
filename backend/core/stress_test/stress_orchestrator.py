import os
import time
import logging
import threading
import concurrent.futures
from typing import Any, Dict, Optional, List, Tuple

import requests

logger = logging.getLogger(__name__)


class StressOrchestrator:
    """Authorized load-test executor.

    WAF/CDN credentials are treated as explicit test-access profiles. The class
    does not spoof client IPs or guess provider secrets. A short preflight is
    executed first so a bad profile fails fast instead of generating a wall of
    403 responses.
    """

    def __init__(self, k6_path: Optional[str] = None):
        self.k6_path = k6_path or "k6"
        self.verify_tls = os.getenv("ADQ_STRESS_VERIFY_TLS", "true").lower() not in {"0", "false", "no"}
        self.max_workers = max(4, min(int(os.getenv("ADQ_STRESS_MAX_WORKERS", "80")), 200))

    @staticmethod
    def _duration_to_seconds(duration: str) -> int:
        raw = (duration or "5s").strip().lower()
        try:
            if raw.endswith("s"):
                return max(1, int(raw[:-1]))
            if raw.endswith("m"):
                return max(1, int(raw[:-1]) * 60)
            return max(1, int(raw))
        except (TypeError, ValueError):
            return 5

    @staticmethod
    def _parse_pair_profile(raw: str) -> Dict[str, str]:
        """Parse `key=value;key2=value2` without logging secret values."""
        parsed: Dict[str, str] = {}
        for part in (raw or "").replace("\n", ";").split(";"):
            part = part.strip()
            if not part:
                continue
            if "=" in part:
                key, value = part.split("=", 1)
            elif ":" in part:
                key, value = part.split(":", 1)
            else:
                continue
            key, value = key.strip(), value.strip()
            if key and value:
                parsed[key.lower()] = value
        return parsed

    def _build_authorized_profile(
        self,
        bypass_code: str,
        waf_type: str,
        custom_headers: Optional[Dict[str, str]],
        custom_cookies: Optional[Dict[str, str]],
    ) -> Tuple[Dict[str, str], Dict[str, str], Dict[str, Any]]:
        headers: Dict[str, str] = dict(custom_headers or {})
        cookies: Dict[str, str] = dict(custom_cookies or {})
        profile = (waf_type or "standard").strip().lower()
        secret = (bypass_code or "").strip()

        diagnostics: Dict[str, Any] = {
            "profile": profile,
            "configured": False,
            "valid_shape": True,
            "message": "No authorized access profile supplied.",
        }

        if not secret:
            return headers, cookies, diagnostics

        if profile == "vercel":
            headers["x-vercel-protection-bypass"] = secret
            headers["x-vercel-set-bypass-cookie"] = "true"
            diagnostics.update(
                configured=True,
                message="Vercel automation protection profile attached.",
            )
            return headers, cookies, diagnostics

        if profile == "cloudflare":
            pairs = self._parse_pair_profile(secret)
            client_id = pairs.get("client_id") or pairs.get("cf-access-client-id")
            client_secret = pairs.get("client_secret") or pairs.get("cf-access-client-secret")
            if not client_id or not client_secret:
                diagnostics.update(
                    configured=True,
                    valid_shape=False,
                    message=(
                        "Cloudflare Access requires both client_id and client_secret, "
                        "for example: client_id=...;client_secret=..."
                    ),
                )
                return headers, cookies, diagnostics
            headers["CF-Access-Client-Id"] = client_id
            headers["CF-Access-Client-Secret"] = client_secret
            diagnostics.update(
                configured=True,
                message="Cloudflare Access service-token profile attached.",
            )
            return headers, cookies, diagnostics

        if profile in {"awswaf", "aws", "api-gateway"}:
            headers["x-api-key"] = secret
            diagnostics.update(
                configured=True,
                message="AWS API Gateway API-key profile attached.",
            )
            return headers, cookies, diagnostics

        # Generic/standard mode supports an explicitly named header or cookie.
        # We intentionally do not guess provider-specific fields from a bare secret.
        pairs = self._parse_pair_profile(secret)
        if pairs:
            for key, value in pairs.items():
                if key.startswith("cookie."):
                    cookies[key.removeprefix("cookie.")] = value
                elif key.startswith("header."):
                    headers[key.removeprefix("header.")] = value
                else:
                    headers[key] = value
            diagnostics.update(
                configured=True,
                message="Custom authorized header/cookie profile attached.",
            )
        else:
            diagnostics.update(
                configured=True,
                valid_shape=False,
                message="Standard profile needs an explicit key/value credential.",
            )
        return headers, cookies, diagnostics

    def _preflight(
        self,
        target_url: str,
        headers: Dict[str, str],
        cookies: Dict[str, str],
    ) -> Dict[str, Any]:
        started = time.perf_counter()
        try:
            response = requests.get(
                target_url,
                headers=headers,
                cookies=cookies,
                timeout=6,
                verify=self.verify_tls,
                allow_redirects=True,
            )
            return {
                "ok": response.status_code < 400,
                "status": response.status_code,
                "latency_ms": max(1, int((time.perf_counter() - started) * 1000)),
                "final_url": response.url,
                "server": response.headers.get("server", ""),
                "request_id": response.headers.get("x-vercel-id")
                or response.headers.get("cf-ray")
                or response.headers.get("x-amzn-requestid")
                or "",
            }
        except requests.RequestException as exc:
            return {
                "ok": False,
                "status": 0,
                "latency_ms": max(1, int((time.perf_counter() - started) * 1000)),
                "error": exc.__class__.__name__,
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
        final_target_url = (target_url or "").strip()
        if not final_target_url.startswith(("http://", "https://")):
            raise ValueError("target_url must start with http:// or https://")

        duration_sec = self._duration_to_seconds(duration)
        total_reqs = max(1, min(int(target_requests or 1), 50000))
        target_rps = max(1, int(total_reqs / duration_sec))

        headers_dict, cookie_dict, profile_diag = self._build_authorized_profile(
            bypass_code=bypass_code,
            waf_type=waf_type,
            custom_headers=custom_headers,
            custom_cookies=custom_cookies,
        )
        headers_dict.setdefault("User-Agent", "ADQ-Authorized-Load-Test/1.0")
        headers_dict.setdefault("Accept", "*/*")

        if not profile_diag["valid_shape"]:
            return {
                "ok": False,
                "target_url": final_target_url,
                "duration": f"{duration_sec}s",
                "profile": profile_diag,
                "preflight": None,
                "metrics": {
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
                },
                "sample_logs": [],
            }

        preflight = self._preflight(final_target_url, headers_dict, cookie_dict)
        # Fail fast on 401/403 when a credential profile was supplied. This avoids
        # turning a bad credential into thousands of knowingly rejected requests.
        if profile_diag["configured"] and preflight.get("status") in {401, 403}:
            profile_diag["message"] = (
                f"Authorized profile was rejected with HTTP {preflight['status']}. "
                "Verify that the credential belongs to this deployment/application and is enabled for automation."
            )
            return {
                "ok": False,
                "target_url": final_target_url,
                "duration": f"{duration_sec}s",
                "profile": profile_diag,
                "preflight": preflight,
                "metrics": {
                    "total_requests": 0,
                    "target_requests": total_reqs,
                    "target_rps": target_rps,
                    "status_200": 0,
                    "status_403_waf_blocked": 1 if preflight.get("status") == 403 else 0,
                    "status_429_rate_limited": 0,
                    "status_500_crashed": 0,
                    "other_status": 1 if preflight.get("status") == 401 else 0,
                    "rps": 0.0,
                    "p95_latency": f"{preflight.get('latency_ms', 0)}ms",
                },
                "sample_logs": [],
            }

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
        lock = threading.Lock()
        stop_event = threading.Event()
        start_time = time.perf_counter()
        end_time = start_time + duration_sec
        thread_local = threading.local()

        def get_worker_session() -> requests.Session:
            session = getattr(thread_local, "session", None)
            if session is None:
                session = requests.Session()
                session.headers.update(headers_dict)
                session.cookies.update(cookie_dict)
                adapter = requests.adapters.HTTPAdapter(
                    pool_connections=self.max_workers,
                    pool_maxsize=self.max_workers,
                    max_retries=0,
                )
                session.mount("https://", adapter)
                session.mount("http://", adapter)
                thread_local.session = session
            return session

        def fire_single_request(worker_id: int) -> Dict[str, Any]:
            session = get_worker_session()
            req_start = time.perf_counter()
            status_code = 0
            try:
                response = session.get(
                    final_target_url,
                    timeout=5,
                    verify=self.verify_tls,
                    allow_redirects=True,
                    headers={"X-ADQ-Test-Worker": str(worker_id)},
                )
                status_code = response.status_code
            except requests.RequestException:
                status_code = 0

            latency = max(1, int((time.perf_counter() - req_start) * 1000))
            return {
                "time": time.strftime("%H:%M:%S", time.localtime()),
                "ip": f"worker-{worker_id:02d}",
                "status": status_code,
                "latency": latency,
            }

        def worker(worker_id: int) -> None:
            while not stop_event.is_set() and time.perf_counter() < end_time:
                with lock:
                    if metrics["total_requests"] >= total_reqs:
                        stop_event.set()
                        return

                entry = fire_single_request(worker_id)
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

        concurrency = min(self.max_workers, max(4, min(total_reqs, int(target_rps * 0.20) + 4)))
        with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
            futures = [executor.submit(worker, i + 1) for i in range(concurrency)]
            concurrent.futures.wait(futures, timeout=duration_sec + 6)
            stop_event.set()

        elapsed = max(0.1, time.perf_counter() - start_time)
        metrics["rps"] = round(metrics["total_requests"] / elapsed, 1)
        if latencies:
            latencies.sort()
            p95_index = min(len(latencies) - 1, max(0, int((len(latencies) - 1) * 0.95)))
            metrics["p95_latency"] = f"{latencies[p95_index]}ms"

        return {
            "ok": True,
            "target_url": final_target_url,
            "duration": f"{duration_sec}s",
            "metrics": metrics,
            "sample_logs": sample_logs,
            "profile": profile_diag,
            "preflight": preflight,
            "waf_applied": (waf_type or "standard").lower().strip(),
        }
