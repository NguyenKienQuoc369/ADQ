import time
import json
import requests
import datetime
from typing import Dict, Any

def test_live_sse_stream():
    print("=================================================================")
    print("ADQ STRESS TEST — AUTOMATED LIVE SSE STREAM ACCEPTANCE TEST")
    print("=================================================================")

    try:
        from backend.api_server import app
        from backend.core.auth import get_current_user
        from backend.services.scan_service import redis_client, ScanService
    except ImportError:
        from api_server import app
        from core.auth import get_current_user
        from services.scan_service import redis_client, ScanService

    from fastapi.testclient import TestClient

    user_id = "test_live_sse_user"
    tier = "PRO_MAX"
    target_origin = "https://quoc-bank-v8-0.vercel.app"

    test_user = {
        "sub": user_id,
        "id": user_id,
        "email": "sse_test@adq.io.vn",
        "role": "authenticated",
        "package_tier": tier,
        "app_metadata": {"packageTier": tier},
        "user_metadata": {"packageTier": tier}
    }
    app.dependency_overrides[get_current_user] = lambda: test_user
    client = TestClient(app)

    # 1. Target Verification setup in Redis
    k1 = ScanService._get_verification_redis_key(user_id, target_origin, namespace="target_verification")
    k2 = ScanService._get_verification_redis_key(user_id, target_origin, namespace="stress_verification")
    v = json.dumps({"verified": True, "token": "sse-tok", "origin": target_origin, "user_id": user_id, "verified_at": time.time()})
    if redis_client:
        redis_client.set(k1, v, ex=3600)
        redis_client.set(k2, v, ex=3600)

    # 2. Dispatch Stress Job
    print("\n--- [1/2] DISPATCHING STRESS JOB (150 requests @ 30 RPS) ---")
    r_job = client.post("/api/stress/jobs", json={
        "target_url": target_origin,
        "endpoint": "/",
        "target_requests": 150,
        "duration": "5s",
        "waf_type": "standard",
    })
    print(f"Enqueue Status: {r_job.status_code}")
    assert r_job.status_code in (200, 202), f"Enqueue failed: {r_job.text}"
    job_id = r_job.json()["job_id"]
    print(f"Job ID: {job_id}")

    # 3. Connect to SSE Stream and consume live events WITHOUT F5 / polling
    print("\n--- [2/2] CONNECTING TO SSE STREAM: /api/stress/{job_id}/stream ---")
    t0 = time.time()
    events_received = []
    phases_seen = set()
    requests_sequence = []
    rps_sequence = []

    with client.stream("GET", f"/api/stress/{job_id}/stream") as response:
        print(f"SSE Response Status: {response.status_code}")
        print(f"Content-Type: {response.headers.get('content-type')}")
        print(f"Cache-Control: {response.headers.get('cache-control')}")
        assert response.status_code == 200, f"Stream failed: {response.status_code}"
        assert "text/event-stream" in response.headers.get("content-type", "")

        for line in response.iter_lines():
            if not line:
                continue
            line_str = line.decode("utf-8") if isinstance(line, bytes) else line
            if line_str.startswith("data: "):
                data_json = line_str[6:]
                try:
                    event = json.loads(data_json)
                    events_received.append(event)
                    status = event.get("status")
                    phase = event.get("phase")
                    metrics = event.get("metrics") or {}
                    tot = metrics.get("total_requests", 0)
                    rps = metrics.get("rps", 0.0)
                    lat = metrics.get("p95_latency", "0ms")

                    if phase:
                        phases_seen.add(phase)
                    requests_sequence.append(tot)
                    rps_sequence.append(rps)

                    elapsed = time.time() - t0
                    print(f"  [{elapsed:.2f}s] LIVE EVENT #{len(events_received)}: Status={status} | Phase={phase} | Req={tot}/150 | RPS={rps} | p95={lat}")

                    if status in ("COMPLETED", "FAILED", "CANCELLED") or event.get("done"):
                        print(f"\nTerminal event received at {elapsed:.2f}s with status {status}")
                        break
                except Exception as ex:
                    print(f"JSON Parse warning: {ex} on {line_str}")

    print("\n--- SSE STREAM ASSERTIONS ---")
    print(f"Total live events received without F5: {len(events_received)}")
    print(f"Phases traversed: {sorted(list(phases_seen))}")
    print(f"Final requests sent: {requests_sequence[-1] if requests_sequence else 0}")
    print(f"RPS samples: {len(rps_sequence)}")

    assert len(events_received) >= 5, f"Expected at least 5 live stream events, got {len(events_received)}"
    assert "STEADY LOAD" in phases_seen or "COMPLETE" in phases_seen, f"Phases missing: {phases_seen}"
    assert requests_sequence[-1] == 150, f"Expected final request count 150, got {requests_sequence[-1]}"

    print("\n✅ LIVE SSE STREAM ACCEPTANCE TEST PASSED 100% WITHOUT F5!")

if __name__ == "__main__":
    test_live_sse_stream()

