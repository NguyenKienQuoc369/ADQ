import asyncio
import time
from typing import Any, Dict, List, Optional

import aiohttp


class RaceConditionScanner:
    def __init__(self, base_url: str, timeout: float = 8.0):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    async def send_concurrent_requests(
        self,
        endpoint: str,
        method: str = "POST",
        headers: Optional[Dict[str, str]] = None,
        body: Optional[Dict[str, Any]] = None,
        concurrency: int = 50,
        delay_ms: int = 0,
    ) -> List[Dict[str, Any]]:
        url = f"{self.base_url}{endpoint}"
        method = method.upper()
        timeout = aiohttp.ClientTimeout(total=self.timeout)
        headers = headers or {}
        body = body or {}

        start_gate = asyncio.Event()
        results: List[Dict[str, Any]] = []

        async def fire_one(session: aiohttp.ClientSession, idx: int):
            await start_gate.wait()
            if delay_ms > 0:
                await asyncio.sleep(delay_ms / 1000.0)
            started = time.perf_counter()
            try:
                async with session.request(method, url, headers=headers, json=body) as resp:
                    text = await resp.text()
                    results.append(
                        {
                            "idx": idx,
                            "status": resp.status,
                            "content_length": len(text.encode("utf-8")),
                            "elapsed_ms": round((time.perf_counter() - started) * 1000, 2),
                        }
                    )
            except Exception as exc:
                results.append(
                    {
                        "idx": idx,
                        "status": 0,
                        "content_length": 0,
                        "elapsed_ms": round((time.perf_counter() - started) * 1000, 2),
                        "error": str(exc),
                    }
                )

        connector = aiohttp.TCPConnector(limit=max(concurrency, 100))
        async with aiohttp.ClientSession(timeout=timeout, connector=connector) as session:
            tasks = [asyncio.create_task(fire_one(session, i)) for i in range(concurrency)]
            start_gate.set()
            await asyncio.gather(*tasks)

        return sorted(results, key=lambda x: x["idx"])

    def analyze_race_outcome(self, responses: List[Dict[str, Any]], action_limit: int = 1) -> Dict[str, Any]:
        success = [r for r in responses if r.get("status") == 200]
        total = len(responses)
        success_count = len(success)

        severity = "none"
        flagged = False
        reason = "No race condition signal"

        if success_count > action_limit:
            flagged = True
            if success_count >= 3:
                severity = "critical"
            else:
                severity = "high"
            reason = (
                f"Detected {success_count} successful (200) responses for a limited action "
                f"with expected limit={action_limit}."
            )

        return {
            "scanner": "race_condition",
            "flagged": flagged,
            "severity": severity,
            "action_limit": action_limit,
            "success_count": success_count,
            "total_requests": total,
            "reason": reason,
            "responses": responses,
        }

    def scan(
        self,
        endpoint: str,
        method: str = "POST",
        headers: Optional[Dict[str, str]] = None,
        body: Optional[Dict[str, Any]] = None,
        concurrency: int = 50,
        action_limit: int = 1,
        delay_ms: int = 0,
    ) -> Dict[str, Any]:
        responses = asyncio.run(
            self.send_concurrent_requests(
                endpoint=endpoint,
                method=method,
                headers=headers,
                body=body,
                concurrency=concurrency,
                delay_ms=delay_ms,
            )
        )
        return self.analyze_race_outcome(responses, action_limit=action_limit)
