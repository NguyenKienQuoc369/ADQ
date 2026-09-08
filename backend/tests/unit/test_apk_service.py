import os
import zipfile
import pytest

from backend.services.apk_service import APKService
from backend.services.apk_queue import apk_queue, APK_QUEUE_LIMIT


@pytest.fixture(autouse=True)
def reset_apk_state(tmp_path):
    apk_queue.clear()
    yield
    apk_queue.clear()


def test_service_create_job_success(tmp_path):
    spool_dir = tmp_path / "spool"
    service = APKService(spool_root=str(spool_dir))

    apk_file = tmp_path / "valid.apk"
    with zipfile.ZipFile(apk_file, "w") as zf:
        zf.writestr("AndroidManifest.xml", '<manifest package="com.test.service"></manifest>')

    job_status = service.create_job(
        user_id="user_123",
        user_email="user@test.com",
        temp_apk_path=str(apk_file),
        original_filename="valid.apk",
        project_id="proj_1",
    )

    assert job_status["ok"] is True
    assert job_status["status"] == "QUEUED"
    assert job_status["project_id"] == "proj_1"
    jid = job_status["job_id"]

    # Original temp file was moved into spool directory
    assert not os.path.exists(str(apk_file))
    spool_expected = spool_dir / f"adq_spool_{jid}.apk"
    assert os.path.exists(str(spool_expected))

    # Job is recorded in queue
    job_in_q = apk_queue.get_job(jid)
    assert job_in_q is not None
    assert job_in_q["user_id"] == "user_123"


def test_service_per_user_concurrency_limit(tmp_path):
    service = APKService(spool_root=str(tmp_path / "spool"))

    apk_file1 = tmp_path / "app1.apk"
    with zipfile.ZipFile(apk_file1, "w") as zf:
        zf.writestr("AndroidManifest.xml", '<manifest package="com.app1"></manifest>')

    service.create_job(
        user_id="user_limit",
        user_email="user@test.com",
        temp_apk_path=str(apk_file1),
        original_filename="app1.apk",
    )

    apk_file2 = tmp_path / "app2.apk"
    with zipfile.ZipFile(apk_file2, "w") as zf:
        zf.writestr("AndroidManifest.xml", '<manifest package="com.app2"></manifest>')

    with pytest.raises(ValueError, match="USER_CONCURRENCY_LIMIT"):
        service.create_job(
            user_id="user_limit",
            user_email="user@test.com",
            temp_apk_path=str(apk_file2),
            original_filename="app2.apk",
        )


def test_service_global_queue_limit(tmp_path):
    service = APKService(spool_root=str(tmp_path / "spool"))

    # Fill up queue limit
    for i in range(APK_QUEUE_LIMIT):
        apk_queue.enqueue_job({
            "job_id": f"dummy_job_{i}",
            "user_id": f"user_{i}",
            "owner_user_id": f"user_{i}",
        })

    apk_file = tmp_path / "app_overflow.apk"
    with zipfile.ZipFile(apk_file, "w") as zf:
        zf.writestr("AndroidManifest.xml", '<manifest package="com.overflow"></manifest>')

    with pytest.raises(ValueError, match="QUEUE_FULL"):
        service.create_job(
            user_id="user_overflow",
            user_email="overflow@test.com",
            temp_apk_path=str(apk_file),
            original_filename="app_overflow.apk",
        )


def test_service_cancel_job(tmp_path):
    service = APKService(spool_root=str(tmp_path / "spool"))

    apk_file = tmp_path / "cancel.apk"
    with zipfile.ZipFile(apk_file, "w") as zf:
        zf.writestr("AndroidManifest.xml", '<manifest package="com.cancel"></manifest>')

    job = service.create_job(
        user_id="user_cancel",
        user_email="cancel@test.com",
        temp_apk_path=str(apk_file),
        original_filename="cancel.apk",
    )
    jid = job["job_id"]

    cancelled = service.cancel_job(jid)
    assert cancelled is True

    record = service.get_job(jid)
    assert record["status"] == "CANCELLED"

