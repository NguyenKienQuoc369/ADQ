import time
import pytest
from backend.services.apk_queue import APKQueue, APK_QUEUE_LIMIT, APK_PER_USER_CONCURRENCY


@pytest.fixture
def queue():
    q = APKQueue(redis_url="redis://localhost:9999/0")  # will safely fallback to in-memory mode
    q.clear()
    yield q
    q.clear()


# 1. Enqueue / Claim / ACK
def test_01_enqueue_claim_ack(queue):
    job_record = {
        "job_id": "test_job_01",
        "user_id": "user_alpha",
        "owner_user_id": "user_alpha",
        "apk_name": "sample.apk",
    }
    success = queue.enqueue_job(job_record)
    assert success is True
    assert queue.get_total_active_jobs_count() == 1

    claimed = queue.claim_job(worker_id="worker_test_1")
    assert claimed is not None
    assert claimed["job_id"] == "test_job_01"
    assert claimed["status"] == "VALIDATING"
    assert claimed["worker_id"] == "worker_test_1"

    ack_ok = queue.ack_job("test_job_01", "worker_test_1")
    assert ack_ok is True


# 2. Queue Limit
def test_02_queue_limit_enforced(queue):
    for i in range(APK_QUEUE_LIMIT):
        queue.enqueue_job({
            "job_id": f"q_job_{i}",
            "user_id": f"user_{i}",
            "owner_user_id": f"user_{i}",
        })

    with pytest.raises(ValueError, match="QUEUE_FULL"):
        queue.enqueue_job({
            "job_id": "q_job_overflow",
            "user_id": "user_overflow",
            "owner_user_id": "user_overflow",
        })


# 3. Per-user active limit
def test_03_per_user_limit_enforced(queue):
    queue.enqueue_job({
        "job_id": "user_job_1",
        "user_id": "user_shared",
        "owner_user_id": "user_shared",
    })

    with pytest.raises(ValueError, match="USER_CONCURRENCY_LIMIT"):
        queue.enqueue_job({
            "job_id": "user_job_2",
            "user_id": "user_shared",
            "owner_user_id": "user_shared",
        })


# 4. Stale processing marked failed / recoverable (No infinite replay)
def test_04_stale_processing_recovery(queue):
    job_record = {
        "job_id": "stale_job_1",
        "user_id": "user_stale",
        "owner_user_id": "user_stale",
    }
    queue.enqueue_job(job_record)
    claimed = queue.claim_job(worker_id="worker_crashed")
    assert claimed is not None

    # Simulate heartbeat stopped 300 seconds ago
    queue.update_job("stale_job_1", {"heartbeat_at": time.time() - 300})

    recovered = queue.recover_stale_jobs(timeout_sec=60)
    assert "stale_job_1" in recovered

    job = queue.get_job("stale_job_1")
    assert job["status"] == "FAILED"
    assert "timed out" in job["error"] or "crashed" in job["error"]


# 5. Cancellation
def test_05_cancellation_flow(queue):
    queue.enqueue_job({
        "job_id": "cancel_job_1",
        "user_id": "user_cancel",
        "owner_user_id": "user_cancel",
    })

    assert queue.is_cancel_requested("cancel_job_1") is False

    # Cancel while QUEUED
    queue.request_cancel("cancel_job_1")
    job = queue.get_job("cancel_job_1")
    assert job["status"] == "CANCELLED"
    assert queue.is_cancel_requested("cancel_job_1") is True

