import time
import json
from typing import Dict, Any

def test_scalable_load_profiles():
    print("=================================================================")
    print("ADQ STRESS TEST — SCALABLE LOAD PROFILES & TIER BOUNDS AUDIT")
    print("=================================================================")

    try:
        from backend.api_server import app
        from backend.core.auth import get_current_user
        from backend.core.security.stress_governor import validate_stress_runtime_limits, STRESS_TIER_LIMITS
        from backend.services.scan_service import redis_client, ScanService
    except ImportError:
        from api_server import app
        from core.auth import get_current_user
        from core.security.stress_governor import validate_stress_runtime_limits, STRESS_TIER_LIMITS
        from services.scan_service import redis_client, ScanService

    from fastapi.testclient import TestClient
    from fastapi import HTTPException

    # 1. Audit Tier Limits
    print("\n--- [1/3] VERIFYING AUTHORITATIVE TIER CEILINGS ---")
    print(f"FREE limits: {STRESS_TIER_LIMITS['FREE']}")
    print(f"PRO limits: {STRESS_TIER_LIMITS['PRO']}")
    print(f"PRO_MAX limits: {STRESS_TIER_LIMITS['PRO_MAX']}")
    print(f"ENTERPRISE limits: {STRESS_TIER_LIMITS['ENTERPRISE']}")

    assert STRESS_TIER_LIMITS["FREE"]["allowed"] is False
    assert STRESS_TIER_LIMITS["PRO"]["max_requests"] == 5000
    assert STRESS_TIER_LIMITS["PRO"]["max_rps"] == 150
    assert STRESS_TIER_LIMITS["PRO_MAX"]["max_requests"] == 25000
    assert STRESS_TIER_LIMITS["PRO_MAX"]["max_rps"] == 300

    # 2. Test Rejection above ceilings
    print("\n--- [2/3] TESTING CEILING REJECTIONS ---")
    # PRO exceeding requests
    try:
        validate_stress_runtime_limits("PRO", 6000, 60)
        assert False, "PRO should reject 6000 requests"
    except HTTPException as ex:
        print(f"PRO > 5000 correctly rejected: {ex.detail}")
        assert ex.status_code == 400

    # PRO exceeding RPS
    try:
        validate_stress_runtime_limits("PRO", 2000, 10) # 200 RPS
        assert False, "PRO should reject 200 RPS"
    except HTTPException as ex:
        print(f"PRO > 150 RPS correctly rejected: {ex.detail}")
        assert ex.status_code == 400

    # PRO_MAX exceeding requests
    try:
        validate_stress_runtime_limits("PRO_MAX", 30000, 120)
        assert False, "PRO_MAX should reject 30000 requests"
    except HTTPException as ex:
        print(f"PRO_MAX > 25000 correctly rejected: {ex.detail}")
        assert ex.status_code == 400

    # PRO_MAX valid higher load profile (10,000 reqs @ 100 RPS)
    reqs, dur, rps = validate_stress_runtime_limits("PRO_MAX", 10000, 100)
    print(f"PRO_MAX 10,000 reqs @ 100 RPS accepted: {reqs} reqs, {dur}s, {rps} RPS")
    assert reqs == 10000 and rps == 100

    # 3. Test Live Scalable Execution (1,000 requests @ 100 RPS)
    print("\n--- [3/3] LIVE RUN (1,000 requests @ 100 RPS) ---")
    user_id = "test_scalable_user"
    tier = "PRO_MAX"
    target_origin = "https://quoc-bank-v8-0.vercel.app"

    test_user = {
        "sub": user_id,
        "id": user_id,
        "email": "scalable@adq.io.vn",
        "role": "authenticated",
        "package_tier": tier,
        "app_metadata": {"packageTier": tier},
        "user_metadata": {"packageTier": tier}
    }
    app.dependency_overrides[get_current_user] = lambda: test_user
    client = TestClient(app)

    k1 = ScanService._get_verification_redis_key(user_id, target_origin, namespace="target_verification")
    k2 = ScanService._get_verification_redis_key(user_id, target_origin, namespace="stress_verification")
    v = json.dumps({"verified": True, "token": "scal-tok", "origin": target_origin, "user_id": user_id, "verified_at": time.time()})
    if redis_client:
        redis_client.set(k1, v, ex=3600)
        redis_client.set(k2, v, ex=3600)

    r_job = client.post("/api/stress/jobs", json={
        "target_url": target_origin,
        "endpoint": "/",
        "target_requests": 1000,
        "duration": "10s",
        "waf_type": "standard",
    })
    print(f"1,000-req Enqueue Status: {r_job.status_code}")
    assert r_job.status_code in (200, 202)
    job_id = r_job.json()["job_id"]

    events = []
    t0 = time.time()
    with client.stream("GET", f"/api/stress/{job_id}/stream") as response:
        for line in response.iter_lines():
            if not line:
                continue
            line_str = line.decode("utf-8") if isinstance(line, bytes) else line
            if line_str.startswith("data: "):
                event = json.loads(line_str[6:])
                events.append(event)
                st = event.get("status")
                tot = event.get("metrics", {}).get("total_requests", 0)
                rps = event.get("metrics", {}).get("rps", 0)
                if len(events) % 10 == 0 or st in ("COMPLETED", "FAILED", "CANCELLED") or event.get("done"):
                    print(f"  [{time.time()-t0:.2f}s] Stream: Status={st} | Req={tot}/1000 | RPS={rps}")
                if st in ("COMPLETED", "FAILED", "CANCELLED") or event.get("done"):
                    break

    final_event = events[-1]
    final_tot = final_event.get("metrics", {}).get("total_requests", 0)
    final_reason = final_event.get("completion_reason")
    print(f"\nFinal Scalable Result: {final_tot}/1000 requests, Reason={final_reason}")
    assert final_tot == 1000, f"Expected 1000 requests, got {final_tot}"
    assert final_reason == "TARGET_REQUESTS_REACHED"

    print("\n✅ ALL SCALABLE LOAD PROFILES & TIER BOUNDS AUDITED AND PASSED!")

if __name__ == "__main__":
    test_scalable_load_profiles()

