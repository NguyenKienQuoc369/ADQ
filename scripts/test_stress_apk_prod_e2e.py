import requests
import json
import time
import io
import zipfile
import sys

API_BASE = "http://localhost:8000"

def main():
    print("=================================================================")
    print("ADQ PRODUCTION E2E VERIFICATION: STRESS TEST + APK AUDIT")
    print("=================================================================")

    try:
        from backend.api_server import app
        from backend.core.auth import get_current_user
        from backend.services.scan_service import redis_client
    except ImportError:
        from api_server import app
        from core.auth import get_current_user
        from services.scan_service import redis_client

    from fastapi.testclient import TestClient

    test_user = {
        "sub": "prod_test_user_promax",
        "id": "prod_test_user_promax",
        "email": "promax@adq.io.vn",
        "role": "authenticated",
        "package_tier": "PRO_MAX",
        "app_metadata": {
            "packageTier": "PRO_MAX"
        },
        "user_metadata": {
            "packageTier": "PRO_MAX"
        }
    }
    app.dependency_overrides[get_current_user] = lambda: test_user
    client = TestClient(app)

    # 1. Target Verification setup in Redis
    target_origin = "https://adq.io.vn"
    try:
        from backend.services.scan_service import ScanService
    except ImportError:
        from services.scan_service import ScanService

    key1 = ScanService._get_verification_redis_key("prod_test_user_promax", target_origin, namespace="target_verification")
    key2 = ScanService._get_verification_redis_key("prod_test_user_promax", target_origin, namespace="stress_verification")
    ver_payload = json.dumps({
        "verified": True,
        "token": "adq-verify-mock-token",
        "origin": target_origin,
        "user_id": "prod_test_user_promax",
        "verified_at": time.time(),
    })
    if redis_client:
        redis_client.set(key1, ver_payload, ex=86400)
        redis_client.set(key2, ver_payload, ex=86400)

    # 2. Endpoint Discovery
    print("\n--- [1/6] TEST STRESS ENDPOINTS DISCOVERY ---")
    r_ep = client.get(f"/api/stress/endpoints?target_url={target_origin}")
    print(f"Status: {r_ep.status_code}")
    ep_data = r_ep.json()
    endpoints = ep_data.get("endpoints", [])
    print(f"Discovered {len(endpoints)} endpoints: {[e.get('path') for e in endpoints[:5]]}")
    assert r_ep.status_code == 200, f"Discovery failed: {r_ep.text}"
    assert len(endpoints) > 0, "No endpoints discovered"

    # 3. Verify Bypass Credential
    print("\n--- [2/6] TEST AUTHORIZED CREDENTIAL VERIFICATION ---")
    r_bp = client.post("/api/stress/verify-bypass", json={
        "target_url": target_origin,
        "bypass_code": "secret_bypass_token_99",
        "waf_type": "standard"
    })
    print(f"Status: {r_bp.status_code}")
    bp_data = r_bp.json()
    print(f"Response: {bp_data}")
    assert r_bp.status_code == 200, f"Verify bypass failed: {r_bp.text}"
    assert "is_valid" in bp_data, "Missing is_valid key"

    # 4. Stress Job Execution with Endpoint & Credential
    print("\n--- [3/6] TEST STRESS JOB EXECUTION (CUSTOM ENDPOINT) ---")
    r_job = client.post("/api/stress/jobs", json={
        "target_url": target_origin,
        "endpoint": "/robots.txt",
        "duration": "5s",
        "target_requests": 50,
        "bypass_code": "secret_bypass_token_99",
        "waf_type": "standard"
    })
    print(f"Status: {r_job.status_code}")
    job_resp = r_job.json()
    print(f"Enqueued: {job_resp}")
    assert r_job.status_code in (200, 202), f"Stress enqueue failed: {r_job.text}"
    job_id = job_resp["job_id"]

    # Poll stress job progress & phases
    final_status = None
    final_state = None
    for i in range(20):
        time.sleep(1)
        st = client.get(f"/api/stress/{job_id}").json()
        status = st.get("status")
        phase = st.get("phase")
        tot = st.get("metrics", {}).get("total_requests", 0)
        rps = st.get("metrics", {}).get("rps", 0)
        endpoint = st.get("endpoint")
        print(f"  [{i+1}s] Status: {status} | Phase: {phase} | Req: {tot} | RPS: {rps} | Endpoint: {endpoint}")
        if status in ("COMPLETED", "FAILED", "CANCELLED"):
            final_status = status
            final_state = st
            break

    assert final_status == "COMPLETED", f"Stress job ended with status {final_status}: {final_state}"
    assert final_state.get("endpoint") == "/robots.txt", f"Endpoint lost: {final_state.get('endpoint')}"
    assert final_state.get("metrics", {}).get("total_requests", 0) > 0, "Zero requests sent"

    # 5. Stress History
    print("\n--- [4/6] TEST STRESS HISTORY RETRIEVAL ---")
    r_hist = client.get("/api/stress/history")
    print(f"Status: {r_hist.status_code}")
    hist_items = r_hist.json().get("history", [])
    print(f"History entries: {len(hist_items)}")
    assert any(h.get("job_id") == job_id for h in hist_items), f"Job {job_id} not found in stress history"

    # 6. APK Audit Upload & Worker Pipeline
    print("\n--- [5/6] TEST APK AUDIT UPLOAD & WORKER EXECUTION ---")
    apk_buf = io.BytesIO()
    with zipfile.ZipFile(apk_buf, "w") as z:
        z.writestr("AndroidManifest.xml", b'<manifest package="vn.adq.security.test" xmlns:android="http://schemas.android.com/apk/res/android"><application android:debuggable="true" android:allowBackup="true" android:usesCleartextTraffic="true"/></manifest>')
        z.writestr("classes.dex", b"DEX_MOCK_SECRET_KEY_AIzaSyAdqMockSecret1234567890")
        z.writestr("META-INF/CERT.RSA", b"MOCK_CERTIFICATE_RSA_BYTES")
    apk_bytes = apk_buf.getvalue()

    files = {"file": ("test_security_audit.apk", apk_bytes, "application/vnd.android.package-archive")}
    r_apk = client.post("/api/apk-audit/jobs", files=files)
    print(f"Upload Status: {r_apk.status_code}")
    apk_resp = r_apk.json()
    print(f"Enqueued APK: {apk_resp}")
    assert r_apk.status_code in (200, 202), f"APK upload failed: {r_apk.text}"
    apk_job_id = apk_resp["job_id"]

    # Poll APK worker execution
    final_apk_status = None
    for i in range(20):
        time.sleep(1)
        st = client.get(f"/api/apk-audit/jobs/{apk_job_id}").json()
        status = st.get("status")
        stage = st.get("stage")
        print(f"  [{i+1}s] APK Status: {status} | Stage: {stage}")
        if status in ("COMPLETED", "PARTIAL", "FAILED"):
            final_apk_status = status
            break

    assert final_apk_status in ("COMPLETED", "PARTIAL"), f"APK job failed: {st}"

    # Get APK Result
    r_res = client.get(f"/api/apk-audit/jobs/{apk_job_id}/result")
    print(f"Result Status: {r_res.status_code}")
    res_data = r_res.json().get("result", {})
    manifest = res_data.get("manifest", {})
    findings = res_data.get("findings", [])
    print(f"Package: {res_data.get('package')}")
    print(f"Manifest Flags: debuggable={manifest.get('debuggable')}, allowBackup={manifest.get('allowBackup')}")
    print(f"Findings Count: {len(findings)}")
    assert r_res.status_code == 200, f"Get APK result failed: {r_res.text}"

    # 7. APK History
    print("\n--- [6/6] TEST APK HISTORY RETRIEVAL ---")
    r_apk_hist = client.get("/api/apk-audit/history")
    print(f"Status: {r_apk_hist.status_code}")
    apk_hist_items = r_apk_hist.json().get("history", [])
    print(f"APK History count: {len(apk_hist_items)}")
    assert any(h.get("job_id") == apk_job_id for h in apk_hist_items), f"Job {apk_job_id} not found in APK history"

    print("\n=================================================================")
    print("✅ ALL 6 PRODUCTION E2E HARDENING CHECKS VERIFIED SUCCESSFULLY!")
    print("=================================================================")

if __name__ == "__main__":
    main()
