import json
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from backend.api_server import app
from backend.services.scan_service import ScanService
from backend.core.security.ssrf_guard import (
    resolve_and_validate_target,
    is_ip_disallowed,
    SSRFSecurityError,
)
from backend.core.auth import get_current_user

client = TestClient(app)

# Dummy test users
USER_A = {"id": "user_a_123", "sub": "user_a_123", "email": "usera@example.com", "packageTier": "PRO"}
USER_B = {"id": "user_b_456", "sub": "user_b_456", "email": "userb@example.com", "packageTier": "PRO"}


class FakeRedis:
    def __init__(self):
        self.store = {}

    def get(self, key):
        return self.store.get(key)

    def set(self, key, value, ex=None, nx=False):
        if nx and key in self.store:
            return False
        self.store[key] = value
        return True

    def setex(self, key, ttl, value):
        self.store[key] = value
        return True

    def delete(self, *keys):
        for k in keys:
            self.store.pop(k, None)
        return True

    def rpush(self, queue, val):
        return 1


@pytest.fixture(autouse=True)
def override_auth_and_redis():
    fake_redis = FakeRedis()
    app.dependency_overrides[get_current_user] = lambda: USER_A
    with patch("backend.services.scan_service.redis_client", fake_redis), \
         patch("backend.routers.scan_router.redis_client", fake_redis), \
         patch("backend.services.stress_dispatch_service.redis_client", fake_redis), \
         patch("backend.core.security.ssrf_guard.is_dev_private_allowed", return_value=False):
        yield fake_redis
    app.dependency_overrides.clear()


# ==============================================================================
# 1. DIRECT API BYPASS TESTS (/api/scan)
# ==============================================================================

def test_scan_rejected_without_ownership_proof(override_auth_and_redis):
    """POST /api/scan without verified ownership proof returns 403 and creates no job."""
    with patch("backend.core.security.ssrf_guard.socket.getaddrinfo", return_value=[(None, None, None, None, ("93.184.216.34", 80))]):
        resp = client.post("/api/scan", json={"target": "https://example.com"})
        assert resp.status_code == 403
        assert "chưa được xác minh quyền sở hữu" in resp.json()["detail"]


def test_scan_accepted_with_valid_ownership_proof(override_auth_and_redis):
    """POST /api/scan with valid verified ownership proof returns 201 Created."""
    fake_redis = override_auth_and_redis
    target_origin = "https://example.com"

    # Pre-verify target for USER_A
    state = {
        "token": "adq-verify-validtoken123",
        "origin": target_origin,
        "user_id": USER_A["id"],
        "verified": True,
        "created_at": 1000.0,
        "verified_at": 1005.0,
    }
    key = ScanService._get_verification_redis_key(USER_A["id"], target_origin)
    fake_redis.set(key, json.dumps(state))

    with patch("backend.core.security.ssrf_guard.socket.getaddrinfo", return_value=[(None, None, None, None, ("93.184.216.34", 80))]), \
         patch("backend.services.scan_service.save_scan_job", return_value=True):
        resp = client.post("/api/scan", json={"target": "https://example.com"})
        assert resp.status_code == 201
        data = resp.json()
        assert data["ok"] is True
        assert data["target"] == target_origin
        assert data["status"] == "QUEUED"


def test_scan_rejected_when_proof_belongs_to_other_user(override_auth_and_redis):
    """User B cannot scan a target verified only by User A."""
    fake_redis = override_auth_and_redis
    target_origin = "https://example.com"

    # Verify target for USER_A only
    state = {
        "token": "adq-verify-validtoken123",
        "origin": target_origin,
        "user_id": USER_A["id"],
        "verified": True,
        "created_at": 1000.0,
        "verified_at": 1005.0,
    }
    key = ScanService._get_verification_redis_key(USER_A["id"], target_origin)
    fake_redis.set(key, json.dumps(state))

    # Switch authenticated user to USER_B
    app.dependency_overrides[get_current_user] = lambda: USER_B

    with patch("backend.core.security.ssrf_guard.socket.getaddrinfo", return_value=[(None, None, None, None, ("93.184.216.34", 80))]):
        resp = client.post("/api/scan", json={"target": "https://example.com"})
        assert resp.status_code == 403
        assert "chưa được xác minh quyền sở hữu" in resp.json()["detail"]


def test_scan_rejected_when_proof_for_different_target(override_auth_and_redis):
    """Proof for target A cannot authorize scanning target B."""
    fake_redis = override_auth_and_redis
    target_a = "https://target-a.com"
    target_b = "https://target-b.com"

    # Verify target A for USER_A
    state = {
        "token": "adq-verify-tokenA",
        "origin": target_a,
        "user_id": USER_A["id"],
        "verified": True,
        "created_at": 1000.0,
        "verified_at": 1005.0,
    }
    key_a = ScanService._get_verification_redis_key(USER_A["id"], target_a)
    fake_redis.set(key_a, json.dumps(state))

    with patch("backend.core.security.ssrf_guard.socket.getaddrinfo", return_value=[(None, None, None, None, ("93.184.216.34", 80))]):
        resp = client.post("/api/scan", json={"target": target_b})
        assert resp.status_code == 403


def test_scan_rejected_when_proof_expired(override_auth_and_redis):
    """Scan request is rejected when verification proof key has expired in Redis."""
    target_origin = "https://example.com"
    # No key set in Redis (simulating expiration)
    with patch("backend.core.security.ssrf_guard.socket.getaddrinfo", return_value=[(None, None, None, None, ("93.184.216.34", 80))]):
        resp = client.post("/api/scan", json={"target": target_origin})
        assert resp.status_code == 403


def test_scan_rejected_on_scheme_mismatch(override_auth_and_redis):
    """Verification for http:// cannot authorize https:// and vice versa."""
    fake_redis = override_auth_and_redis
    http_origin = "http://example.com"

    # Verify http:// only
    state = {
        "token": "adq-verify-token",
        "origin": http_origin,
        "user_id": USER_A["id"],
        "verified": True,
        "created_at": 1000.0,
        "verified_at": 1005.0,
    }
    key_http = ScanService._get_verification_redis_key(USER_A["id"], http_origin)
    fake_redis.set(key_http, json.dumps(state))

    with patch("backend.core.security.ssrf_guard.socket.getaddrinfo", return_value=[(None, None, None, None, ("93.184.216.34", 80))]):
        resp = client.post("/api/scan", json={"target": "https://example.com"})
        assert resp.status_code == 403


def test_scan_rejected_on_port_mismatch(override_auth_and_redis):
    """Verification for default port 443 cannot authorize custom port 8443."""
    fake_redis = override_auth_and_redis
    standard_origin = "https://example.com"

    state = {
        "token": "adq-verify-token",
        "origin": standard_origin,
        "user_id": USER_A["id"],
        "verified": True,
        "created_at": 1000.0,
        "verified_at": 1005.0,
    }
    key = ScanService._get_verification_redis_key(USER_A["id"], standard_origin)
    fake_redis.set(key, json.dumps(state))

    with patch("backend.core.security.ssrf_guard.socket.getaddrinfo", return_value=[(None, None, None, None, ("93.184.216.34", 8443))]):
        resp = client.post("/api/scan", json={"target": "https://example.com:8443"})
        assert resp.status_code == 403


# ==============================================================================
# 2. SSRF REGRESSION TESTS
# ==============================================================================

@pytest.mark.parametrize("disallowed_ip", [
    "127.0.0.1",
    "127.0.0.2",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "::1",
    "100.64.0.1",
    "0.0.0.0",
])
def test_ssrf_disallowed_ips(disallowed_ip):
    """Production IP validation strictly blocks loopback, private, metadata, and link-local ranges."""
    assert is_ip_disallowed(disallowed_ip) is True


def test_ssrf_allows_public_ip():
    """Public IP address is permitted through IP validation."""
    assert is_ip_disallowed("93.184.216.34") is False
    assert is_ip_disallowed("1.1.1.1") is False
    assert is_ip_disallowed("8.8.8.8") is False


def test_ssrf_resolve_and_validate_target_blocks_private_target():
    """resolve_and_validate_target raises SSRFSecurityError when hostname resolves to private IP."""
    with patch("backend.core.security.ssrf_guard.is_dev_private_allowed", return_value=False), \
         patch("backend.core.security.ssrf_guard.socket.getaddrinfo", return_value=[(None, None, None, None, ("127.0.0.1", 80))]):
        with pytest.raises(SSRFSecurityError):
            resolve_and_validate_target("http://localhost")


# ==============================================================================
# 3. WORKER FAIL-CLOSED TEST
# ==============================================================================

def test_worker_fails_closed_when_ownership_proof_expires_before_execution():
    """Worker fails closed without launching scanner subprocess if ownership proof expired."""
    from backend.runtime_services import execute_job

    fake_redis = FakeRedis()
    job_id = "test-job-fail-closed"
    target = "https://example.com"

    job_data = {
        "job_id": job_id,
        "user_id": USER_A["id"],
        "target": target,
        "request": {"target": target},
    }

    # Verification is NOT in Redis (expired/missing)
    with patch("backend.core.security.ssrf_guard.socket.getaddrinfo", return_value=[(None, None, None, None, ("93.184.216.34", 443))]), \
         patch("backend.core.security.ssrf_guard.is_dev_private_allowed", return_value=False), \
         patch("subprocess.Popen") as mock_popen, \
         patch("backend.core.engine.db.update_scan_status") as mock_update_db:

        execute_job(job_id, job_data, fake_redis, "worker-1")

        # Subprocess must NEVER be called
        mock_popen.assert_not_called()

        # Database and Redis must record FAILED status
        mock_update_db.assert_called_with(job_id, "FAILED")
        raw_res = fake_redis.get(f"job_result:{job_id}")
        assert raw_res is not None
        result = json.loads(raw_res)
        assert result["status"] == "failed"
        assert "OWNERSHIP_VERIFICATION_EXPIRED" in result["error"]


def test_worker_fails_closed_on_ssrf_target_violation():
    """Worker fails closed if target resolves to private address during execution."""
    from backend.runtime_services import execute_job

    fake_redis = FakeRedis()
    job_id = "test-job-ssrf-block"
    target = "http://internal-service.local"

    job_data = {
        "job_id": job_id,
        "user_id": USER_A["id"],
        "target": target,
        "request": {"target": target},
    }

    with patch("backend.core.security.ssrf_guard.socket.getaddrinfo", return_value=[(None, None, None, None, ("10.0.0.5", 80))]), \
         patch("backend.core.security.ssrf_guard.is_dev_private_allowed", return_value=False), \
         patch("subprocess.Popen") as mock_popen, \
         patch("backend.core.engine.db.update_scan_status") as mock_update_db:

        execute_job(job_id, job_data, fake_redis, "worker-1")

        mock_popen.assert_not_called()
        mock_update_db.assert_called_with(job_id, "FAILED")
        raw_res = fake_redis.get(f"job_result:{job_id}")
        assert raw_res is not None
        result = json.loads(raw_res)
        assert result["status"] == "failed"
        assert "SSRF_SECURITY_BLOCK" in result["error"]


# ==============================================================================
# 4. STRESS VERIFICATION REGRESSION TEST
# ==============================================================================

def test_stress_verification_and_dispatch_regression(override_auth_and_redis):
    """Stress verification and job dispatch work seamlessly with generalized verification."""
    fake_redis = override_auth_and_redis
    target_origin = "https://example.com"

    # 1. Start verification via unified API
    with patch("backend.core.security.ssrf_guard.socket.getaddrinfo", return_value=[(None, None, None, None, ("93.184.216.34", 443))]):
        start_res = client.post("/api/verification/start", json={"target_url": target_origin})
        assert start_res.status_code == 200
        start_data = start_res.json()
        assert start_data["ok"] is True
        token = start_data["verification_token"]
        assert token.startswith("adq-verify-")

        # 2. Mock HTML containing meta tag and check verification
        mock_html = f'<html><head><meta name="adq-verification" content="{token}"></head><body>OK</body></html>'
        with patch("backend.services.scan_service.safe_http_fetch", return_value=(200, mock_html, {})):
            check_res = client.post("/api/verification/check", json={"target_url": target_origin})
            assert check_res.status_code == 200
            assert check_res.json()["verified"] is True

        # 3. Dispatch stress job succeeds because target is verified
        with patch("backend.services.stress_dispatch_service.StressSlotGovernor.acquire", return_value=True):
            stress_res = client.post("/api/stress/jobs", json={
                "target_url": target_origin,
                "target_requests": 500,
                "duration": "5s",
                "waf_type": "standard",
            })
            assert stress_res.status_code == 202
            assert stress_res.json()["ok"] is True
            assert stress_res.json()["status"] == "QUEUED"
