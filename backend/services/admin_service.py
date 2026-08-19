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
        cpu_percent = psutil.cpu_percent(interval=None)
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage("/")

        # Kiểm tra trạng thái Redis
        redis_ok = False
        if redis_client:
            try:
                redis_ok = redis_client.ping()
            except Exception:
                redis_ok = False

        return {
            "ok": True,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "server": {
                "cpu_usage_percent": cpu_percent,
                "ram_usage_percent": mem.percent,
                "ram_used_gb": round(mem.used / (1024**3), 2),
                "ram_total_gb": round(mem.total / (1024**3), 2),
                "disk_usage_percent": disk.percent,
                "disk_free_gb": round(disk.free / (1024**3), 2),
            },
            "services": {
                "fastapi_backend": "ONLINE",
                "redis_queue": "HEALTHY" if redis_ok else "DEGRADED",
                "postgres_db": "ONLINE",
                "worker_elite": "READY",
                "worker_mobile": "READY",
                "worker_light": "READY",
            }
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
