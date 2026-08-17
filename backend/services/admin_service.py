import uuid
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


class AdminService:
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
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Valid email address is required",
            )

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
            "lastLoginAt": "2026-08-17T00:00:00Z",
        }
        USERS_STORAGE[user_id] = user
        return {"user": user, "temporaryPassword": input_data.password or "DefaultP@ss123!"}

    @staticmethod
    def update_user_status(user_id: str, status_payload: UserStatusUpdate) -> Dict[str, Any]:
        if user_id not in USERS_STORAGE:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID '{user_id}' not found",
            )
        USERS_STORAGE[user_id]["status"] = status_payload.status
        return USERS_STORAGE[user_id]

    @staticmethod
    def update_user_role_and_package(user_id: str, payload: UserRolePackageUpdate) -> Dict[str, Any]:
        if user_id not in USERS_STORAGE:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID '{user_id}' not found",
            )
        USERS_STORAGE[user_id]["role"] = payload.role
        USERS_STORAGE[user_id]["packageTier"] = payload.packageTier
        if payload.planExpiresAt is not None:
            USERS_STORAGE[user_id]["planExpiresAt"] = payload.planExpiresAt
        return USERS_STORAGE[user_id]

    @staticmethod
    def delete_user(user_id: str) -> bool:
        if user_id not in USERS_STORAGE:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID '{user_id}' not found",
            )
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
            "durationLabel": input_data.durationLabel,
            "maxUses": input_data.maxUses,
            "usedCount": 0,
            "status": "UNUSED",
            "activatedBy": None,
            "createdAt": "2026-08-17T00:00:00Z",
        }
        REDEEM_CODES_STORAGE[code_str] = code_data
        return code_data

    @staticmethod
    def redeem_code(code: str) -> Dict[str, Any]:
        if code not in REDEEM_CODES_STORAGE:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invalid or expired redeem code",
            )
        rc = REDEEM_CODES_STORAGE[code]
        if rc["status"] == "USED" or rc["usedCount"] >= rc["maxUses"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Redeem code has already reached maximum uses",
            )
        rc["usedCount"] += 1
        if rc["usedCount"] >= rc["maxUses"]:
            rc["status"] = "USED"
        return rc
