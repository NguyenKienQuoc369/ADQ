import os
import time
import uuid
import psutil
import redis
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from fastapi import HTTPException, status
from backend.schemas.admin import (
    UserCreateManual,
    UserStatusUpdate,
    UserRolePackageUpdate,
    RedeemCodeCreate,
)

USERS_STORAGE: Dict[str, Dict[str, Any]] = {}
REDEEM_CODES_STORAGE: Dict[str, Dict[str, Any]] = {}
REDIS_URL = os.getenv("REDIS_URL", "redis://adq_redis:6379/0")

try:
    redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
except Exception:
    redis_client = None


class AdminService:
    @staticmethod
    def get_system_health() -> Dict[str, Any]:
        """
        Read-only SOC telemetry.

        Không tạo dữ liệu synthetic. Nếu một nguồn không kiểm tra được,
        trạng thái sẽ là UNKNOWN / OFFLINE thay vì giả READY.
        """
        cpu_percent = psutil.cpu_percent(interval=None)
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage("/")

        # -------------------------------------------------
        # Redis
        # -------------------------------------------------
        redis_ok = False
        redis_error = None

        worker_details = []
        queue_depth = 0
        processing_total = 0

        worker_status = {
            "worker_elite": "UNKNOWN",
            "worker_mobile": "UNKNOWN",
            "worker_light": "UNKNOWN",
        }

        if redis_client:
            try:
                redis_ok = bool(redis_client.ping())

                # Main scan queue
                try:
                    queue_depth = int(
                        redis_client.llen("scan_queue")
                    )
                except Exception:
                    queue_depth = 0

                # Discover worker heartbeat trực tiếp từ Redis.
                heartbeat_keys = sorted(
                    redis_client.scan_iter(
                        "worker_heartbeat:*"
                    )
                )

                heartbeat_workers = set()

                for heartbeat_key in heartbeat_keys:
                    worker_id = heartbeat_key.split(
                        "worker_heartbeat:",
                        1,
                    )[-1]

                    if not worker_id:
                        continue

                    heartbeat_workers.add(worker_id)

                    try:
                        ttl = int(
                            redis_client.ttl(
                                heartbeat_key
                            )
                        )
                    except Exception:
                        ttl = -1

                    processing_key = (
                        f"scan_processing:{worker_id}"
                    )

                    try:
                        processing = int(
                            redis_client.llen(
                                processing_key
                            )
                        )
                    except Exception:
                        processing = 0

                    processing_total += processing

                    worker_details.append({
                        "worker_id": worker_id,
                        "status": (
                            "BUSY"
                            if processing > 0
                            else "READY"
                        ),
                        "heartbeat": True,
                        "heartbeat_ttl_seconds": ttl,
                        "processing_jobs": processing,
                    })

                    wid = worker_id.lower()

                    if "elite" in wid:
                        worker_status[
                            "worker_elite"
                        ] = (
                            "BUSY"
                            if processing > 0
                            else "READY"
                        )

                    if "mobile" in wid:
                        worker_status[
                            "worker_mobile"
                        ] = (
                            "BUSY"
                            if processing > 0
                            else "READY"
                        )

                    if "light" in wid:
                        worker_status[
                            "worker_light"
                        ] = (
                            "BUSY"
                            if processing > 0
                            else "READY"
                        )

                # Processing queue tồn tại nhưng heartbeat mất
                # => worker có khả năng OFFLINE/stale.
                for processing_key in sorted(
                    redis_client.scan_iter(
                        "scan_processing:*"
                    )
                ):
                    worker_id = processing_key.split(
                        "scan_processing:",
                        1,
                    )[-1]

                    if (
                        not worker_id
                        or worker_id in heartbeat_workers
                    ):
                        continue

                    try:
                        pending = int(
                            redis_client.llen(
                                processing_key
                            )
                        )
                    except Exception:
                        pending = 0

                    if pending <= 0:
                        continue

                    worker_details.append({
                        "worker_id": worker_id,
                        "status": "OFFLINE",
                        "heartbeat": False,
                        "heartbeat_ttl_seconds": -2,
                        "processing_jobs": pending,
                    })

                    wid = worker_id.lower()

                    if "elite" in wid:
                        worker_status[
                            "worker_elite"
                        ] = "OFFLINE"

                    if "mobile" in wid:
                        worker_status[
                            "worker_mobile"
                        ] = "OFFLINE"

                    if "light" in wid:
                        worker_status[
                            "worker_light"
                        ] = "OFFLINE"

            except Exception as exc:
                redis_ok = False
                redis_error = str(exc)

        # -------------------------------------------------
        # VPS Host Telemetry
        # -------------------------------------------------
        host_metrics = None
        host_telemetry_error = None

        try:
            import json
            import os
            import urllib.request

            host_telemetry_url = os.getenv(
                "HOST_TELEMETRY_URL",
                "http://host-telemetry:9100/metrics",
            )

            with urllib.request.urlopen(
                host_telemetry_url,
                timeout=1.5,
            ) as response:
                payload = json.load(response)

            if (
                payload.get("ok") is True
                and payload.get("scope") == "VPS_HOST"
            ):
                host_metrics = payload
            else:
                host_telemetry_error = (
                    "Invalid host telemetry response"
                )

        except Exception as exc:
            host_telemetry_error = str(exc)

        # -------------------------------------------------
        # PostgreSQL
        # -------------------------------------------------
        postgres_ok = False
        postgres_error = None

        try:
            from sqlalchemy import text
            from backend.core.engine.db import get_engine

            with get_engine().connect() as conn:
                conn.execute(text("SELECT 1"))

            postgres_ok = True

        except Exception as exc:
            postgres_error = str(exc)

        return {
            "ok": True,
            "timestamp": datetime.now(
                timezone.utc
            ).isoformat(),

            # "server" luôn đại diện cho toàn VPS host.
            # Không fallback sang container metrics nếu collector lỗi.
            "server": {
                "scope": "VPS_HOST",
                "available": host_metrics is not None,

                "cpu_usage_percent": (
                    host_metrics.get(
                        "cpu_usage_percent"
                    )
                    if host_metrics
                    else None
                ),

                "ram_usage_percent": (
                    host_metrics.get(
                        "memory",
                        {},
                    ).get("usage_percent")
                    if host_metrics
                    else None
                ),

                "ram_used_gb": (
                    host_metrics.get(
                        "memory",
                        {},
                    ).get("used_gb")
                    if host_metrics
                    else None
                ),

                "ram_total_gb": (
                    host_metrics.get(
                        "memory",
                        {},
                    ).get("total_gb")
                    if host_metrics
                    else None
                ),

                "disk_usage_percent": (
                    host_metrics.get(
                        "disk",
                        {},
                    ).get("usage_percent")
                    if host_metrics
                    else None
                ),

                "disk_used_gb": (
                    host_metrics.get(
                        "disk",
                        {},
                    ).get("used_gb")
                    if host_metrics
                    else None
                ),

                "disk_total_gb": (
                    host_metrics.get(
                        "disk",
                        {},
                    ).get("total_gb")
                    if host_metrics
                    else None
                ),

                "disk_free_gb": (
                    host_metrics.get(
                        "disk",
                        {},
                    ).get("free_gb")
                    if host_metrics
                    else None
                ),

                "load_1m": (
                    host_metrics.get(
                        "load",
                        {},
                    ).get("load_1m")
                    if host_metrics
                    else None
                ),

                "load_5m": (
                    host_metrics.get(
                        "load",
                        {},
                    ).get("load_5m")
                    if host_metrics
                    else None
                ),

                "load_15m": (
                    host_metrics.get(
                        "load",
                        {},
                    ).get("load_15m")
                    if host_metrics
                    else None
                ),

                "uptime_seconds": (
                    host_metrics.get(
                        "uptime_seconds"
                    )
                    if host_metrics
                    else None
                ),
            },

            # Giữ riêng số liệu process/container để debug backend.
            # SOC không được gọi đây là VPS metrics.
            "backend_runtime": {
                "cpu_usage_percent": round(
                    float(cpu_percent),
                    1,
                ),
                "ram_usage_percent": round(
                    float(mem.percent),
                    1,
                ),
                "ram_used_gb": round(
                    mem.used / (1024**3),
                    2,
                ),
                "ram_total_gb": round(
                    mem.total / (1024**3),
                    2,
                ),
                "disk_usage_percent": round(
                    float(disk.percent),
                    1,
                ),
                "disk_free_gb": round(
                    disk.free / (1024**3),
                    2,
                ),
            },

            "services": {
                # Endpoint này đang thực thi được thì FastAPI
                # bản thân nó đang ONLINE.
                "fastapi_backend": "ONLINE",

                "vps_host": (
                    "ONLINE"
                    if host_metrics is not None
                    else "UNAVAILABLE"
                ),

                "redis_queue": (
                    "HEALTHY"
                    if redis_ok
                    else "OFFLINE"
                ),

                "postgres_db": (
                    "ONLINE"
                    if postgres_ok
                    else "OFFLINE"
                ),

                **worker_status,
            },

            "queues": {
                "scan_queue": queue_depth,
                "processing_jobs": processing_total,
            },

            "workers": worker_details,

            "diagnostics": {
                "host_telemetry_error": host_telemetry_error,
                "redis_error": redis_error,
                "postgres_error": postgres_error,
            },
        }

    @staticmethod
    def get_global_scan_history() -> List[Dict[str, Any]]:
        from backend.services.scan_service import JOBS_STORAGE
        scans = []
        for jid, job in JOBS_STORAGE.items():
            scans.append({
                "job_id": jid,
                "target": job.get("target", "N/A"),
                "status": job.get("status", "QUEUED"),
                "created_at": job.get("created_at"),
                "user_id": job.get("user_id", "usr_system"),
                "user_email": job.get("user_email", "user@adq.io.vn"),
                "total_vulns": len(job.get("vulnerabilities", [])),
                "is_killed": job.get("is_killed", False),
            })
        return sorted(scans, key=lambda x: x.get("created_at") or 0, reverse=True)

    @staticmethod
    def kill_scan_job(job_id: str) -> Dict[str, Any]:
        from backend.services.scan_service import JOBS_STORAGE
        if job_id in JOBS_STORAGE:
            JOBS_STORAGE[job_id]["status"] = "KILLED_BY_ADMIN"
            JOBS_STORAGE[job_id]["is_killed"] = True
            return {"ok": True, "message": f"Scan job {job_id} has been terminated."}
        raise HTTPException(status_code=404, detail="Job not found")

    @staticmethod
    def get_users(search: Optional[str] = None, role: Optional[str] = None, package_tier: Optional[str] = None) -> List[Dict[str, Any]]:
        users = list(USERS_STORAGE.values())
        if search:
            search_lower = search.lower()
            users = [u for u in users if search_lower in u.get("name", "").lower() or search_lower in u.get("email", "").lower()]
        if role and role != "ALL":
            users = [u for u in users if u.get("role") == role]
        if package_tier and package_tier != "ALL":
            users = [u for u in users if u.get("packageTier") == package_tier]
        return users

    @staticmethod
    def create_manual_user(input_data: UserCreateManual) -> Dict[str, Any]:
        if not input_data.email or "@" not in input_data.email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Valid email address is required")

        user_id = f"usr_{uuid.uuid4().hex[:8]}"
        user = {
            "id": user_id,
            "name": input_data.name,
            "email": input_data.email,
            "role": input_data.role,
            "packageTier": input_data.packageTier,
            "status": input_data.status or "ACTIVE",
            "dailyLimit": input_data.dailyLimit or 5,
            "scansToday": 0,
            "telegramConnected": False,
            "planExpiresAt": input_data.planExpiresAt,
            "lastLoginAt": datetime.now(timezone.utc).isoformat(),
        }
        USERS_STORAGE[user_id] = user
        return {"user": user, "temporaryPassword": input_data.password or "DefaultP@ss123!"}

    @staticmethod
    def update_user_status(user_id: str, status_payload: UserStatusUpdate) -> Dict[str, Any]:
        if user_id not in USERS_STORAGE:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with ID '{user_id}' not found")
        USERS_STORAGE[user_id]["status"] = status_payload.status
        return USERS_STORAGE[user_id]

    @staticmethod
    def update_user_role_and_package(user_id: str, payload: UserRolePackageUpdate) -> Dict[str, Any]:
        if user_id not in USERS_STORAGE:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with ID '{user_id}' not found")
        USERS_STORAGE[user_id]["role"] = payload.role
        USERS_STORAGE[user_id]["packageTier"] = payload.packageTier
        if payload.planExpiresAt is not None:
            USERS_STORAGE[user_id]["planExpiresAt"] = payload.planExpiresAt
        return USERS_STORAGE[user_id]

    @staticmethod
    def delete_user(user_id: str) -> bool:
        if user_id not in USERS_STORAGE:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with ID '{user_id}' not found")
        del USERS_STORAGE[user_id]
        return True

    @staticmethod
    def get_redeem_codes() -> List[Dict[str, Any]]:
        return list(REDEEM_CODES_STORAGE.values())

    @staticmethod
    def create_redeem_code(input_data: RedeemCodeCreate) -> Dict[str, Any]:
        code_str = f"ADQ-{input_data.packageTier}-{uuid.uuid4().hex[:6].upper()}"
        code_data = {
            "id": f"rc_{uuid.uuid4().hex[:8]}",
            "code": code_str,
            "packageTier": input_data.packageTier,
            "durationLabel": input_data.durationLabel or "30 Ngày",
            "maxUses": input_data.maxUses or 1,
            "usedCount": 0,
            "status": "UNUSED",
            "activatedBy": None,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
        REDEEM_CODES_STORAGE[code_str] = code_data
        return code_data

    @staticmethod
    def redeem_code(code: str) -> Dict[str, Any]:
        if code not in REDEEM_CODES_STORAGE:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid or expired redeem code")
        rc = REDEEM_CODES_STORAGE[code]
        if rc["status"] == "USED" or rc["usedCount"] >= rc["maxUses"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Redeem code has already reached maximum uses")
        rc["usedCount"] += 1
        if rc["usedCount"] >= rc["maxUses"]:
            rc["status"] = "USED"
        return rc
