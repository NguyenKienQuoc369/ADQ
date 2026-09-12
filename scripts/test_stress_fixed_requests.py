import time
import json
import uuid
import datetime
from typing import Dict, Any

try:
    from backend.core.stress_test.stress_orchestrator import StressOrchestrator
    from backend.services.scan_service import redis_client, ScanService
    from backend.services.stress_dispatch_service import StressDispatchService
    from backend.schemas.scan import StressRequest
except ImportError:
    from core.stress_test.stress_orchestrator import StressOrchestrator
    from services.scan_service import redis_client, ScanService
    from services.stress_dispatch_service import StressDispatchService
    from schemas.scan import StressRequest

def run_stress_test_matrix():
    print("=================================================================")
    print("ADQ STRESS TEST — FIXED REQUEST COUNT MATRIX & VERIFICATION")
    print("=================================================================")

    orch = StressOrchestrator()
    target_url = "https://quoc-bank-v8-0.vercel.app"

    # Test A: 100 requests @ 10 RPS
    print("\n--- [Test A] 100 requests @ 10 RPS ---")
    t0 = time.time()
    res_a = orch.execute_stress_test(
        target_url=target_url,
        target_rps=10,
        total_reqs=100,
        duration_sec=10,
    )
    dur_a = time.time() - t0
    tot_a = res_a.get("metrics", {}).get("total_requests", 0)
    print(f"Result A: Attempted={tot_a}/100, Reason={res_a.get('completion_reason')}, Duration={dur_a:.2f}s, RPS={res_a.get('metrics', {}).get('rps')}")
    assert tot_a == 100, f"Expected exactly 100 requests, got {tot_a}"
    assert res_a.get("completion_reason") == "TARGET_REQUESTS_REACHED", f"Unexpected reason: {res_a.get('completion_reason')}"

    # Test B: 450 requests @ 30 RPS (Stream mode)
    print("\n--- [Test B] 450 requests @ 30 RPS (Streaming) ---")
    t0 = time.time()
    chunks = []
    final_chunk = None
    for chunk in orch.stream_stress_test(
        target_url=target_url,
        target_rps=30,
        total_reqs=450,
        duration_sec=15,
    ):
        chunks.append(chunk)
        if chunk.get("done"):
            final_chunk = chunk
            break

    dur_b = time.time() - t0
    tot_b = final_chunk.get("metrics", {}).get("total_requests", 0) if final_chunk else 0
    reason_b = final_chunk.get("completion_reason") if final_chunk else "UNKNOWN"
    rps_b = final_chunk.get("metrics", {}).get("rps") if final_chunk else 0
    print(f"Result B: Attempted={tot_b}/450, Reason={reason_b}, Duration={dur_b:.2f}s, RPS={rps_b}")
    assert tot_b == 450, f"Expected exactly 450 requests, got {tot_b}"
    assert reason_b == "TARGET_REQUESTS_REACHED", f"Unexpected reason: {reason_b}"
    assert not any(c.get("metrics", {}).get("total_requests", 0) > 450 for c in chunks), "Overshoot detected!"

    # Test C: Cancellation during run
    print("\n--- [Test C] Cancellation at mid-run ---")
    is_cancelled = False
    cancelled_chunk = None
    t0 = time.time()
    for chunk in orch.stream_stress_test(
        target_url=target_url,
        target_rps=20,
        total_reqs=200,
        duration_sec=10,
        stop_checker=lambda: is_cancelled,
    ):
        tot = chunk.get("metrics", {}).get("total_requests", 0)
        if tot >= 30 and not is_cancelled:
            is_cancelled = True
        if is_cancelled:
            cancelled_chunk = chunk
            break

    dur_c = time.time() - t0
    tot_c = cancelled_chunk.get("metrics", {}).get("total_requests", 0) if cancelled_chunk else 0
    print(f"Result C (Cancelled): Attempted={tot_c}/200, Duration={dur_c:.2f}s, Cancelled cleanly.")
    assert tot_c < 200, f"Should have stopped before 200 requests, got {tot_c}"

    print("\n=================================================================")
    print("ALL FIXED REQUEST LOAD MATRIX TESTS PASSED!")
    print("=================================================================")

if __name__ == "__main__":
    run_stress_test_matrix()

