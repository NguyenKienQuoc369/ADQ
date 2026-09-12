import os
import sys
import time
import signal
import uuid
import logging
import threading
from typing import Optional, Dict, Any

# Ensure repository/app root is on sys.path for direct python execution
_APP_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if _APP_ROOT not in sys.path:
    sys.path.insert(0, _APP_ROOT)

from backend.core.mobile_audit.apk_analyzer import APKAnalyzer
from backend.services.apk_queue import apk_queue

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] (APKWorker) %(message)s")

APK_SPOOL_ROOT = os.getenv("APK_SPOOL_ROOT", "/tmp/adq_apk_spool")


class APKWorker:
    """
    Dedicated Mobile APK Decompilation & Static Analysis Worker Daemon:
    - Runs in dedicated container with OpenJDK, Apktool & JADX
    - Claims jobs from Redis/APKQueue
    - Heartbeat updates & cancel-polling during execution
    - Subprocess termination on cancellation
    - Ephemeral spool cleanup & reliable ACK
    """

    def __init__(self, worker_id: Optional[str] = None, spool_root: str = APK_SPOOL_ROOT):
        self.worker_id = worker_id or f"apk_worker_{uuid.uuid4().hex[:8]}"
        self.spool_root = os.path.abspath(spool_root)
        self.running = False
        self.current_job_id: Optional[str] = None
        self.current_cancel_event: Optional[threading.Event] = None
        os.makedirs(self.spool_root, exist_ok=True)

    def start(self):
        """Starts the worker polling loop."""
        self.running = True
        logger.info(f"Starting APKWorker [{self.worker_id}] listening on queue (spool: {self.spool_root})")

        # Verify Redis availability in production mode
        if not apk_queue._is_explicit_test_mode() and apk_queue.redis_client is None:
            apk_queue._init_redis()
            if apk_queue.redis_client is None:
                raise ConnectionError(f"FATAL: APKWorker cannot connect to Redis at {apk_queue.redis_url}")

        # Register OS signal handlers for graceful shutdown if running in main thread
        if threading.current_thread() is threading.main_thread():
            try:
                signal.signal(signal.SIGINT, self._handle_signal)
                signal.signal(signal.SIGTERM, self._handle_signal)
            except Exception as e:
                logger.warning(f"Could not register signal handler: {e}")

        heartbeat_counter = 0
        while self.running:
            try:
                # Periodic stale job recovery check
                heartbeat_counter += 1
                if heartbeat_counter % 30 == 0:
                    apk_queue.recover_stale_jobs()

                job = apk_queue.claim_job(worker_id=self.worker_id, timeout_sec=2)
                if not job:
                    time.sleep(0.5)
                    continue

                self.process_job(job)

            except Exception as e:
                logger.error(f"Unexpected error in APKWorker loop: {e}", exc_info=True)
                time.sleep(1)

        logger.info(f"APKWorker [{self.worker_id}] stopped cleanly")

    def _handle_signal(self, signum, frame):
        logger.info(f"Received signal {signum}, initiating graceful worker shutdown...")
        self.stop()
        if self.current_cancel_event:
            self.current_cancel_event.set()

    def stop(self):
        self.running = False

    def process_job(self, job: Dict[str, Any]) -> Dict[str, Any]:
        """Processes a single claimed APK analysis job."""
        job_id = job["job_id"]
        spool_filename = job.get("spool_filename") or f"adq_spool_{job_id}.apk"
        spool_path = os.path.abspath(os.path.join(self.spool_root, spool_filename))

        # Security check: verify path is contained within spool_root
        if not spool_path.startswith(self.spool_root + os.sep) and spool_path != self.spool_root:
            err_msg = f"SECURITY_VIOLATION: Spool path {spool_path} escapes designated spool root {self.spool_root}"
            logger.error(err_msg)
            apk_queue.update_job(job_id, {"status": "FAILED", "stage": "failed", "error": err_msg})
            apk_queue.ack_job(job_id, self.worker_id)
            return {"ok": False, "error": err_msg}

        self.current_job_id = job_id
        cancel_event = threading.Event()
        self.current_cancel_event = cancel_event

        # Check early cancel
        if apk_queue.is_cancel_requested(job_id):
            logger.info(f"Job {job_id} cancelled before start")
            self._cleanup_spool(spool_path)
            apk_queue.update_job(job_id, {"status": "CANCELLED", "stage": "cancelled"})
            apk_queue.ack_job(job_id, self.worker_id)
            self.current_job_id = None
            self.current_cancel_event = None
            return {"ok": False, "status": "CANCELLED"}

        # Start background heartbeat & cancel monitor thread
        stop_heartbeat = threading.Event()
        hb_thread = threading.Thread(
            target=self._heartbeat_worker,
            args=(job_id, cancel_event, stop_heartbeat),
            daemon=True,
        )
        hb_thread.start()

        try:
            apk_queue.update_job(job_id, {
                "status": "ANALYZING",
                "stage": "decompiling_and_scanning",
                "progress": 30,
            })

            analyzer = APKAnalyzer(apk_path=spool_path, cancel_event=cancel_event)
            pipeline_res = analyzer.run_pipeline()

            if cancel_event.is_set() or pipeline_res.get("status") == "CANCELLED":
                logger.info(f"Job {job_id} cancelled during analysis")
                apk_queue.update_job(job_id, {
                    "status": "CANCELLED",
                    "stage": "cancelled",
                    "progress": 100,
                })
                return {"ok": False, "status": "CANCELLED"}

            if not pipeline_res.get("ok"):
                err_text = pipeline_res.get("error", "Static analysis failed")
                logger.warning(f"Job {job_id} failed: {err_text}")
                apk_queue.update_job(job_id, {
                    "status": "FAILED",
                    "stage": "failed",
                    "error": err_text,
                    "progress": 100,
                })
                return {"ok": False, "status": "FAILED", "error": err_text}

            is_partial = pipeline_res.get("partial", False)
            status_str = "PARTIAL" if is_partial else "COMPLETED"

            sanitized_result = {
                "status": status_str,
                "analysisMode": pipeline_res.get("analysisMode", "zip_fallback"),
                "partial": is_partial,
                "package": pipeline_res.get("package"),
                "version": pipeline_res.get("version"),
                "sdk": pipeline_res.get("sdk", {}),
                "manifest": pipeline_res.get("manifest", {}),
                "permissions": pipeline_res.get("permissions", []),
                "exportedComponents": pipeline_res.get("exportedComponents", {}),
                "signing": pipeline_res.get("signing", {}),
                "endpoints": pipeline_res.get("endpoints", []),
                "findings": pipeline_res.get("findings", []),
                "toolsUsed": pipeline_res.get("toolsUsed", []),
                "toolFailures": pipeline_res.get("toolFailures", {}),
                # Legacy:
                "apk_name": job.get("apk_name"),
                "decompile_status": pipeline_res.get("decompile_status", {}),
                "results": pipeline_res.get("results", {}),
            }

            apk_queue.update_job(job_id, {
                "status": status_str,
                "stage": "completed",
                "progress": 100,
                "partial": is_partial,
                "result": sanitized_result,
            })
            logger.info(f"Job {job_id} completed successfully (status: {status_str})")
            return {"ok": True, "status": status_str, "result": sanitized_result}

        except Exception as exc:
            logger.error(f"Worker exception processing job {job_id}: {exc}", exc_info=True)
            apk_queue.update_job(job_id, {
                "status": "FAILED",
                "stage": "failed",
                "error": str(exc),
                "progress": 100,
            })
            return {"ok": False, "status": "FAILED", "error": str(exc)}

        finally:
            stop_heartbeat.set()
            self._cleanup_spool(spool_path)
            apk_queue.ack_job(job_id, self.worker_id)
            self.current_job_id = None
            self.current_cancel_event = None

    def _heartbeat_worker(self, job_id: str, cancel_event: threading.Event, stop_event: threading.Event):
        """Periodically reports worker heartbeat and checks for cancel requests."""
        while not stop_event.is_set():
            try:
                apk_queue.heartbeat(job_id, self.worker_id)
                if apk_queue.is_cancel_requested(job_id):
                    logger.info(f"Cancel request detected for job {job_id}")
                    cancel_event.set()
                    break
            except Exception as e:
                logger.debug(f"Heartbeat tick error for job {job_id}: {e}")
            time.sleep(1.0)

    def _cleanup_spool(self, spool_path: str):
        """Purges spooled APK file after processing."""
        if spool_path and os.path.exists(spool_path):
            try:
                os.remove(spool_path)
                logger.info(f"Cleaned up spool file: {spool_path}")
            except Exception as e:
                logger.warning(f"Failed to cleanup spool file {spool_path}: {e}")


if __name__ == "__main__":
    worker = APKWorker()
    worker.start()

