import os
import time
import uuid
import logging
from typing import Dict, Any, Optional

from backend.services.apk_queue import apk_queue

logger = logging.getLogger(__name__)

APK_SPOOL_ROOT = os.getenv("APK_SPOOL_ROOT", "/tmp/adq_apk_spool")
os.makedirs(APK_SPOOL_ROOT, exist_ok=True)


class APKService:
    """
    API Service layer for APK Audit management:
    - Handshakes with APKQueue (Redis/Memory)
    - Enforces file spooling into shared volume
    - Performs zero in-process heavy decompilation on API server
    - Strictly acts as the control plane
    """

    def __init__(self, spool_root: str = APK_SPOOL_ROOT):
        self.spool_root = os.path.abspath(spool_root)
        os.makedirs(self.spool_root, exist_ok=True)

    def create_job(
        self,
        user_id: str,
        user_email: Optional[str],
        temp_apk_path: str,
        original_filename: str,
        project_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Transfers temporary uploaded APK to shared spool directory and enqueues job."""
        job_id = f"apk_{uuid.uuid4().hex[:12]}"
        spool_filename = f"adq_spool_{job_id}.apk"
        spool_target = os.path.join(self.spool_root, spool_filename)

        # Move/copy temp upload into shared spool
        if os.path.exists(temp_apk_path):
            os.replace(temp_apk_path, spool_target)
        else:
            raise FileNotFoundError(f"Source APK file not found at {temp_apk_path}")

        job_record: Dict[str, Any] = {
            "job_id": job_id,
            "owner_user_id": user_id,
            "user_id": user_id,
            "owner_email": user_email,
            "user_email": user_email,
            "project_id": project_id,
            "status": "QUEUED",
            "stage": "queued",
            "progress": 0,
            "created_at": time.time(),
            "started_at": None,
            "completed_at": None,
            "error": None,
            "error_safe": None,
            "result": None,
            "partial": False,
            "apk_name": original_filename,
            "spool_filename": spool_filename,
        }

        try:
            apk_queue.enqueue_job(job_record)
            return self.get_public_job_status(job_id) or job_record
        except Exception as exc:
            # If enqueue fails, cleanup spooled file
            if os.path.exists(spool_target):
                try:
                    os.remove(spool_target)
                except Exception:
                    pass
            raise exc

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        return apk_queue.get_job(job_id)

    def get_public_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        job = self.get_job(job_id)
        if not job:
            return None
        return {
            "ok": True,
            "job_id": job["job_id"],
            "user_id": job.get("owner_user_id") or job.get("user_id"),
            "project_id": job.get("project_id"),
            "status": job["status"],
            "stage": job.get("stage", "unknown"),
            "progress": job.get("progress", 0),
            "created_at": job.get("created_at"),
            "started_at": job.get("started_at"),
            "completed_at": job.get("completed_at"),
            "error": job.get("error_safe") or job.get("error"),
            "partial": job.get("partial", False),
        }

    def cancel_job(self, job_id: str) -> bool:
        return apk_queue.request_cancel(job_id)


# Global singleton instance of APKService
apk_service = APKService()
