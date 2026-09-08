import os
import time
import zipfile
import threading
import pytest
from unittest.mock import patch, MagicMock

from backend.workers.apk_worker import APKWorker
from backend.services.apk_queue import apk_queue


@pytest.fixture(autouse=True)
def reset_test_queue():
    apk_queue.clear()
    yield
    apk_queue.clear()


def create_mock_apk(dest_path: str, package_name: str = "com.test.workerapp"):
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    with zipfile.ZipFile(dest_path, "w") as zf:
        zf.writestr("AndroidManifest.xml", f'<manifest package="{package_name}"></manifest>')
        zf.writestr("sources/com/test/Secret.java", 'class Secret { String k = "AIzaSy' + 'A' * 35 + '"; }')


# 1. Successful Worker processing & spool cleanup
def test_01_worker_process_success(tmp_path):
    spool_dir = tmp_path / "spool"
    spool_file = spool_dir / "adq_spool_job_01.apk"
    create_mock_apk(str(spool_file), "com.adq.worker.test")

    job_record = {
        "job_id": "job_01",
        "user_id": "user_1",
        "owner_user_id": "user_1",
        "apk_name": "worker.apk",
        "spool_filename": "adq_spool_job_01.apk",
    }
    apk_queue.enqueue_job(job_record)
    claimed = apk_queue.claim_job("worker_test_1")
    assert claimed is not None

    worker = APKWorker(worker_id="worker_test_1", spool_root=str(spool_dir))
    res = worker.process_job(claimed)

    assert res["ok"] is True
    assert res["status"] in {"COMPLETED", "PARTIAL"}
    assert res["result"]["package"] == "com.adq.worker.test"

    # Spool file was cleaned up
    assert not os.path.exists(str(spool_file))

    # Job is ACKed and recorded as COMPLETED in queue
    final_job = apk_queue.get_job("job_01")
    assert final_job["status"] in {"COMPLETED", "PARTIAL"}
    assert final_job["stage"] == "completed"


# 2. Worker handles malformed APK gracefully
def test_02_worker_process_malformed_apk(tmp_path):
    spool_dir = tmp_path / "spool"
    spool_file = spool_dir / "adq_spool_bad.apk"
    os.makedirs(str(spool_dir), exist_ok=True)
    with open(str(spool_file), "wb") as f:
        f.write(b"NOT_A_VALID_ZIP")

    job_record = {
        "job_id": "job_bad",
        "user_id": "user_1",
        "owner_user_id": "user_1",
        "apk_name": "bad.apk",
        "spool_filename": "adq_spool_bad.apk",
    }
    apk_queue.enqueue_job(job_record)
    claimed = apk_queue.claim_job("worker_test_1")

    worker = APKWorker(worker_id="worker_test_1", spool_root=str(spool_dir))
    res = worker.process_job(claimed)

    assert res["ok"] is False
    assert res["status"] == "FAILED"
    assert not os.path.exists(str(spool_file))

    final_job = apk_queue.get_job("job_bad")
    assert final_job["status"] == "FAILED"


# 3. Worker respects pre-execution cancellation
def test_03_worker_pre_execution_cancellation(tmp_path):
    spool_dir = tmp_path / "spool"
    spool_file = spool_dir / "adq_spool_cancel.apk"
    create_mock_apk(str(spool_file))

    job_record = {
        "job_id": "job_cancel_early",
        "user_id": "user_1",
        "owner_user_id": "user_1",
        "apk_name": "cancel.apk",
        "spool_filename": "adq_spool_cancel.apk",
    }
    apk_queue.enqueue_job(job_record)
    claimed = apk_queue.claim_job("worker_test_1")

    # Cancel requested after claim
    apk_queue.request_cancel("job_cancel_early")

    worker = APKWorker(worker_id="worker_test_1", spool_root=str(spool_dir))
    res = worker.process_job(claimed)

    assert res["ok"] is False
    assert res["status"] == "CANCELLED"
    assert not os.path.exists(str(spool_file))


# 4. Worker path containment validation
def test_04_worker_spool_path_containment(tmp_path):
    spool_dir = tmp_path / "spool"
    os.makedirs(str(spool_dir), exist_ok=True)

    job_record = {
        "job_id": "job_traversal",
        "user_id": "user_1",
        "owner_user_id": "user_1",
        "apk_name": "evil.apk",
        "spool_filename": "../../etc/passwd",
    }
    apk_queue.enqueue_job(job_record)
    claimed = apk_queue.claim_job("worker_test_1")

    worker = APKWorker(worker_id="worker_test_1", spool_root=str(spool_dir))
    res = worker.process_job(claimed)

    assert res["ok"] is False
    assert "SECURITY_VIOLATION" in res["error"]
