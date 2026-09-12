import pytest
import time
import json
from unittest.mock import MagicMock, patch
from fastapi import HTTPException

from backend.routers.scan_router import (
    enforce_stress_quota,
    get_user_usage,
    record_user_usage_increment,
    USAGE_TRACKER,
    redis_client,
)
from backend.core.security.stress_governor import validate_stress_runtime_limits
from backend.services.stress_dispatch_service import StressDispatchService
from backend.schemas.scan import StressRequest

class TestStressAndRedeemReliability:

    def setup_method(self):
        USAGE_TRACKER.clear()
        if redis_client:
            try:
                for k in redis_client.keys("user_usage:user_*"):
                    redis_client.delete(k)
            except Exception:
                pass

    # 1. STRESS QUOTA TESTS
    def test_free_tier_stress_blocked(self):
        free_user = {"id": "user_free_1", "email": "free@adq.io.vn", "package_tier": "FREE"}
        with pytest.raises(HTTPException) as exc_info:
            enforce_stress_quota(free_user)
        assert exc_info.value.status_code == 403
        assert "TIER_LOCKED" in str(exc_info.value.detail)

    def test_pro_tier_quota_limit_enforced(self):
        pro_user = {"id": "user_pro_test_1", "email": "pro@adq.io.vn", "package_tier": "PRO"}
        # 1st run allowed
        tier, usage = enforce_stress_quota(pro_user)
        assert tier == "PRO"
        assert usage["stress_count"] == 1

        # 2nd run blocked
        with pytest.raises(HTTPException) as exc_info:
            enforce_stress_quota(pro_user)
        assert exc_info.value.status_code == 403
        assert "DAILY_LIMIT" in str(exc_info.value.detail)
        assert "1 lượt" in str(exc_info.value.detail)

    def test_pro_max_tier_quota_limit_enforced(self):
        promax_user = {"id": "user_promax_test_1", "email": "promax@adq.io.vn", "package_tier": "PRO_MAX"}
        for i in range(10):
            tier, usage = enforce_stress_quota(promax_user)
            assert tier == "PRO_MAX"
            assert usage["stress_count"] == i + 1

        # 11th run blocked
        with pytest.raises(HTTPException) as exc_info:
            enforce_stress_quota(promax_user)
        assert exc_info.value.status_code == 403
        assert "10 lượt" in str(exc_info.value.detail)

    def test_quota_persistence_in_redis(self):
        fake_redis = MagicMock()
        stored_data = {}
        def fake_get(k):
            return stored_data.get(k)
        def fake_set(k, v, ex=None):
            stored_data[k] = v
            return True
        fake_redis.get.side_effect = fake_get
        fake_redis.set.side_effect = fake_set

        with patch("backend.routers.scan_router.redis_client", fake_redis):
            user = {"id": "user_persist_1", "email": "p@adq.io.vn", "package_tier": "PRO"}
            enforce_stress_quota(user)
            assert len(stored_data) > 0
            
            # Clear in-memory dict to simulate server restart
            USAGE_TRACKER.clear()

            # Next call must read from Redis and reject because limit 1 is reached
            with pytest.raises(HTTPException) as exc_info:
                enforce_stress_quota(user)
            assert exc_info.value.status_code == 403

    # 2. STRESS RUNTIME LIMITS
    def test_runtime_limits_validation(self):
        # PRO tier valid input
        reqs, dur, rps = validate_stress_runtime_limits("PRO", 1000, 10)
        assert reqs == 1000
        assert dur == 10
        assert rps == 100

        # PRO tier exceeding limits raises 400
        with pytest.raises(HTTPException) as exc:
            validate_stress_runtime_limits("PRO", 5000, 10)
        assert exc.value.status_code == 400

        # PRO MAX tier valid input
        reqs_max, dur_max, rps_max = validate_stress_runtime_limits("PRO_MAX", 3000, 30)
        assert reqs_max == 3000
        assert dur_max == 30
        assert rps_max == 100

    # 3. STRESS TARGET AUTHORIZATION
    def test_unverified_target_blocked(self):
        user = {"id": "user_test_1", "email": "test@adq.io.vn", "package_tier": "PRO"}
        req = StressRequest(target_url="https://unverified-domain.com", duration="5s", target_requests=100)

        with patch("backend.services.stress_dispatch_service.ScanService.is_stress_target_verified", return_value=False), \
             patch("backend.services.stress_dispatch_service.resolve_and_validate_target", return_value=("https://unverified-domain.com", "93.184.216.34")), \
             patch("backend.services.stress_dispatch_service.enforce_stress_quota", return_value=("PRO", {"stress_count": 1})):
            with pytest.raises(HTTPException) as exc_info:
                StressDispatchService.enqueue_stress_job(req, user)
            assert exc_info.value.status_code == 403
            assert "xác minh quyền sở hữu" in str(exc_info.value.detail)

    # 4. STRESS MULTI-TENANT ISOLATION
    def test_stress_job_multi_tenant_isolation(self):
        user_a = "user_alpha_1"
        user_b = "user_beta_2"
        job_id = "stress_abc123"

        fake_job_state = {
            "job_id": job_id,
            "user_id": user_a,
            "tier": "PRO",
            "target_url": "https://adq.io.vn",
            "status": "RUNNING",
        }

        with patch("backend.services.stress_dispatch_service.StressDispatchService.get_stress_job_state", return_value=fake_job_state):
            # User B attempts to stop User A's job
            with pytest.raises(HTTPException) as exc_info:
                StressDispatchService.stop_stress_job(job_id, user_b)
            assert exc_info.value.status_code == 403
            assert "quyền" in str(exc_info.value.detail)

    # 5. STRESS LIFECYCLE & CANCELLATION
    def test_stress_job_cancellation(self):
        user_id = "user_cancel_1"
        job_id = "stress_cancelling_1"
        fake_job_state = {
            "job_id": job_id,
            "user_id": user_id,
            "tier": "PRO",
            "target_url": "https://adq.io.vn",
            "status": "RUNNING",
            "events": [],
        }

        fake_redis = MagicMock()
        with patch("backend.services.stress_dispatch_service.redis_client", fake_redis), \
             patch("backend.services.stress_dispatch_service.StressDispatchService.get_stress_job_state", return_value=fake_job_state), \
             patch("backend.services.stress_dispatch_service.save_stress_job"):
            res = StressDispatchService.stop_stress_job(job_id, user_id)
            assert res["ok"] is True
            assert res["status"] == "CANCELLED"
            assert fake_job_state["status"] == "CANCELLED"

    # 6. FAIL-CLOSED QUOTA TESTS
    def test_quota_fail_closed_when_redis_unavailable(self):
        user = {"id": "user_fail_closed_1", "email": "fc@adq.io.vn", "package_tier": "PRO"}
        with patch("backend.routers.scan_router.redis_client", None):
            with pytest.raises(HTTPException) as exc_info:
                enforce_stress_quota(user)
            assert exc_info.value.status_code == 503
            assert "QUOTA_SERVICE_UNAVAILABLE" in str(exc_info.value.detail)

    def test_quota_uses_vietnam_date_key(self):
        fake_redis = MagicMock()
        stored_keys = []
        def fake_get(k):
            stored_keys.append(k)
            return None
        def fake_set(k, v, ex=None):
            return True
        fake_redis.get.side_effect = fake_get
        fake_redis.set.side_effect = fake_set

        with patch("backend.routers.scan_router.redis_client", fake_redis):
            user = {"id": "user_vn_tz_1", "email": "vn@adq.io.vn", "package_tier": "PRO"}
            enforce_stress_quota(user)
            assert len(stored_keys) > 0
            # Key format: user_usage:user_id:YYYY-MM-DD
            assert "user_usage:user_vn_tz_1:" in stored_keys[0]

    # 7. DURABLE POSTGRESQL FALLBACK TESTS
    def test_stress_job_durable_fallback_from_db_when_redis_expired(self):
        job_id = "stress_expired_in_redis_1"
        db_job = {
            "job_id": job_id,
            "user_id": "user_hist_1",
            "tier": "PRO",
            "target_url": "https://adq.io.vn",
            "status": "COMPLETED",
            "progress": 100,
            "metrics": {"rps": 50.0, "p95_latency": "120ms"},
            "created_at": 1700000000.0,
        }

        fake_redis = MagicMock()
        fake_redis.get.return_value = None  # Key expired in Redis

        with patch("backend.services.stress_dispatch_service.redis_client", fake_redis), \
             patch("backend.services.stress_dispatch_service.get_stress_job", return_value=db_job):
            state = StressDispatchService.get_stress_job_state(job_id)
            assert state is not None
            assert state["job_id"] == job_id
            assert state["status"] == "COMPLETED"
            assert state["metrics"]["rps"] == 50.0

    def test_stress_user_history_merges_db_and_redis(self):
        user_id = "user_merge_1"
        pg_jobs = [
            {"job_id": "stress_pg_1", "user_id": user_id, "status": "COMPLETED", "created_at": 1000.0},
            {"job_id": "stress_shared_2", "user_id": user_id, "status": "COMPLETED", "created_at": 2000.0},
        ]
        redis_job_shared = {"job_id": "stress_shared_2", "user_id": user_id, "status": "COMPLETED", "created_at": 2000.0}
        redis_job_active = {"job_id": "stress_redis_live_3", "user_id": user_id, "status": "RUNNING", "created_at": 3000.0}

        fake_redis = MagicMock()
        fake_redis.lrange.return_value = ["stress_redis_live_3", "stress_shared_2"]
        def fake_get(k):
            if "stress_redis_live_3" in k:
                return json.dumps(redis_job_active)
            if "stress_shared_2" in k:
                return json.dumps(redis_job_shared)
            return None
        fake_redis.get.side_effect = fake_get

        with patch("backend.services.stress_dispatch_service.redis_client", fake_redis), \
             patch("backend.services.stress_dispatch_service.get_stress_jobs_by_user", return_value=pg_jobs):
            history = StressDispatchService.get_user_stress_history(user_id)
            assert len(history) == 3
            # Sorted newest first (3000 -> 2000 -> 1000)
            assert history[0]["job_id"] == "stress_redis_live_3"
            assert history[1]["job_id"] == "stress_shared_2"
            assert history[2]["job_id"] == "stress_pg_1"


