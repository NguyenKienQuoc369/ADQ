import io
import zipfile
import time
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch

from backend.api_server import app
from backend.core.auth import get_current_user
from backend.services.apk_queue import apk_queue
from backend.workers.apk_worker import APKWorker

@pytest.fixture(autouse=True)
def reset_test_state():
    apk_queue.clear()
    app.dependency_overrides.clear()
    yield
    apk_queue.clear()
    app.dependency_overrides.clear()

client = TestClient(app)


def create_sample_apk_bytes(package_name="com.adq.sample", extra_java=""):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("AndroidManifest.xml", f'<manifest package="{package_name}" android:debuggable="true"></manifest>')
        if extra_java:
            zf.writestr("sources/com/example/Main.java", extra_java)
    return buf.getvalue()


# 1. Anonymous create -> 401
def test_01_anonymous_create_rejected():
    app.dependency_overrides.clear()
    apk_bytes = create_sample_apk_bytes()
    resp = client.post(
        "/api/apk-audit/jobs",
        files={"file": ("test.apk", apk_bytes, "application/vnd.android.package-archive")},
    )
    assert resp.status_code == 401


# 2. FREE tier create -> 403
def test_02_free_tier_rejected():
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "user_free",
        "email": "free@test.com",
        "app_metadata": {"packageTier": "FREE"},
    }
    apk_bytes = create_sample_apk_bytes()
    resp = client.post(
        "/api/apk-audit/jobs",
        files={"file": ("test.apk", apk_bytes, "application/vnd.android.package-archive")},
    )
    assert resp.status_code == 403
    assert "TIER_LOCKED" in resp.json()["detail"]


# 3. PRO tier create -> 403
def test_03_pro_tier_rejected():
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "user_pro",
        "email": "pro@test.com",
        "app_metadata": {"packageTier": "PRO"},
    }
    apk_bytes = create_sample_apk_bytes()
    resp = client.post(
        "/api/apk-audit/jobs",
        files={"file": ("test.apk", apk_bytes, "application/vnd.android.package-archive")},
    )
    assert resp.status_code == 403
    assert "TIER_LOCKED" in resp.json()["detail"]


# 4. Expired PRO_MAX -> 403
def test_04_expired_promax_rejected():
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "user_expired",
        "email": "expired@test.com",
        "app_metadata": {"packageTier": "PRO_MAX", "planExpiresAt": yesterday},
    }
    apk_bytes = create_sample_apk_bytes()
    resp = client.post(
        "/api/apk-audit/jobs",
        files={"file": ("test.apk", apk_bytes, "application/vnd.android.package-archive")},
    )
    assert resp.status_code == 403
    assert "TIER_LOCKED" in resp.json()["detail"]


# 5. Active PRO_MAX -> 202 Accepted
def test_05_active_promax_accepted():
    future = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "user_promax_1",
        "email": "promax@test.com",
        "app_metadata": {"packageTier": "PRO_MAX", "planExpiresAt": future},
    }
    apk_bytes = create_sample_apk_bytes(package_name="com.adq.promax")
    resp = client.post(
        "/api/apk-audit/jobs",
        files={"file": ("app_promax.apk", apk_bytes, "application/vnd.android.package-archive")},
    )
    assert resp.status_code == 202
    data = resp.json()
    assert data["ok"] is True
    assert "job_id" in data
    assert data["status"] == "QUEUED"


# 6. Oversized upload -> 413
def test_06_oversized_upload_rejected():
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "user_promax_oversize",
        "app_metadata": {"packageTier": "PRO_MAX"},
    }
    with patch("backend.routers.apk_router.MAX_UPLOAD_SIZE", 100):  # Mock limit to 100 bytes
        apk_bytes = create_sample_apk_bytes()  # Will be > 100 bytes
        resp = client.post(
            "/api/apk-audit/jobs",
            files={"file": ("huge.apk", apk_bytes, "application/vnd.android.package-archive")},
        )
        assert resp.status_code == 413
        assert "FILE_TOO_LARGE" in resp.json()["detail"]


# 7. Malformed APK -> 400
def test_07_malformed_apk_rejected():
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "user_promax_malformed",
        "app_metadata": {"packageTier": "PRO_MAX"},
    }
    resp = client.post(
        "/api/apk-audit/jobs",
        files={"file": ("bad.apk", b"NOT_A_ZIP_HEADER", "application/vnd.android.package-archive")},
    )
    assert resp.status_code == 400
    assert "MALFORMED_ARCHIVE" in resp.json()["detail"]


# 8. Per-user concurrency enforced -> 429
def test_08_per_user_concurrency_enforced():
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "user_concurrency_test",
        "app_metadata": {"packageTier": "PRO_MAX"},
    }
    # Add active job for this user in queue
    apk_queue.enqueue_job({
        "job_id": "active_concurrency_job",
        "user_id": "user_concurrency_test",
        "owner_user_id": "user_concurrency_test",
    })
    apk_bytes = create_sample_apk_bytes()
    resp = client.post(
        "/api/apk-audit/jobs",
        files={"file": ("test2.apk", apk_bytes, "application/vnd.android.package-archive")},
    )
    assert resp.status_code == 429
    assert "USER_CONCURRENCY_LIMIT" in resp.json()["detail"]


# 9. Global queue bounded -> 503
def test_09_global_queue_bounded():
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "user_global_limit",
        "app_metadata": {"packageTier": "PRO_MAX"},
    }
    # Fill up 10 active jobs
    for i in range(10):
        apk_queue.enqueue_job({
            "job_id": f"global_job_{i}",
            "user_id": f"other_user_{i}",
            "owner_user_id": f"other_user_{i}",
        })

    apk_bytes = create_sample_apk_bytes()
    resp = client.post(
        "/api/apk-audit/jobs",
        files={"file": ("test3.apk", apk_bytes, "application/vnd.android.package-archive")},
    )
    assert resp.status_code == 503
    assert "QUEUE_FULL" in resp.json()["detail"]


# 10. Status ownership enforced -> 404
def test_10_status_ownership_enforced():
    apk_queue.enqueue_job({
        "job_id": "job_alice",
        "user_id": "alice",
        "owner_user_id": "alice",
    })

    # Bob tries to read Alice's job status
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "bob",
        "app_metadata": {"packageTier": "PRO_MAX"},
    }
    resp = client.get("/api/apk-audit/jobs/job_alice")
    assert resp.status_code == 404


# 11. Result ownership enforced -> 404
def test_11_result_ownership_enforced():
    apk_queue.enqueue_job({
        "job_id": "job_alice_res",
        "user_id": "alice",
        "owner_user_id": "alice",
    })
    apk_queue.update_job("job_alice_res", {
        "status": "COMPLETED",
        "result": {"package": "com.secret.app"},
    })

    app.dependency_overrides[get_current_user] = lambda: {
        "id": "bob",
        "app_metadata": {"packageTier": "PRO_MAX"},
    }
    resp = client.get("/api/apk-audit/jobs/job_alice_res/result")
    assert resp.status_code == 404


# 12. Cancel ownership enforced -> 404
def test_12_cancel_ownership_enforced():
    apk_queue.enqueue_job({
        "job_id": "job_alice_cancel",
        "user_id": "alice",
        "owner_user_id": "alice",
    })

    app.dependency_overrides[get_current_user] = lambda: {
        "id": "bob",
        "app_metadata": {"packageTier": "PRO_MAX"},
    }
    resp = client.delete("/api/apk-audit/jobs/job_alice_cancel")
    assert resp.status_code == 404


# 13. Completed result contains no raw filesystem path
def test_13_completed_result_sanitized():
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "user_clean_result",
        "app_metadata": {"packageTier": "PRO_MAX"},
    }
    apk_bytes = create_sample_apk_bytes(
        package_name="com.sanitized.app",
        extra_java='class App { String key = "AIzaSy' + 'K' * 35 + '"; }'
    )
    resp = client.post(
        "/api/apk-audit/jobs",
        files={"file": ("sanitized.apk", apk_bytes, "application/vnd.android.package-archive")},
    )
    assert resp.status_code == 202
    jid = resp.json()["job_id"]

    # Claim and process job using APKWorker
    worker = APKWorker(worker_id="test_worker_1")
    job = apk_queue.claim_job(worker_id="test_worker_1")
    assert job is not None
    assert job["job_id"] == jid
    worker_res = worker.process_job(job)
    assert worker_res["ok"] is True

    res_resp = client.get(f"/api/apk-audit/jobs/{jid}/result")
    assert res_resp.status_code == 200
    res_data = res_resp.json()["result"]

    assert res_data["package"] == "com.sanitized.app"
    # Ensure no /tmp/ path leak
    for finding in res_data.get("findings", []):
        assert not finding["file"].startswith("/tmp/")
        assert "adq_apk_" not in finding["file"]


# 14. Forged client tier in body/query ignored
def test_14_forged_tier_ignored():
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "user_forger",
        "email": "forger@test.com",
        "app_metadata": {"packageTier": "FREE"},
    }
    apk_bytes = create_sample_apk_bytes()
    # Try injecting ?packageTier=PRO_MAX or in form data
    resp = client.post(
        "/api/apk-audit/jobs?packageTier=PRO_MAX",
        files={"file": ("test.apk", apk_bytes, "application/vnd.android.package-archive")},
        data={"packageTier": "PRO_MAX", "tier": "PRO_MAX"},
    )
    assert resp.status_code == 403


# 15. Malformed plan expiry fails closed
def test_15_malformed_expiry_fails_closed():
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "user_bad_expiry",
        "email": "bad_exp@test.com",
        "app_metadata": {"packageTier": "PRO_MAX", "planExpiresAt": "corrupt-invalid-date-format"},
    }
    apk_bytes = create_sample_apk_bytes()
    resp = client.post(
        "/api/apk-audit/jobs",
        files={"file": ("test.apk", apk_bytes, "application/vnd.android.package-archive")},
    )
    assert resp.status_code == 403
    assert "TIER_LOCKED" in resp.json()["detail"]

