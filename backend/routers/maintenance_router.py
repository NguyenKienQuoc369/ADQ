from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import redis
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.core.auth import get_current_user

router = APIRouter(prefix="/api/maintenance", tags=["Maintenance"])

REDIS_URL = os.getenv("REDIS_URL", "redis://adq_redis:6379/0")
REDIS_KEY = "adq:system:maintenance:v1"

redis_client = redis.Redis.from_url(
    REDIS_URL,
    decode_responses=True,
    socket_connect_timeout=2,
    socket_timeout=2,
)

DEFAULT_STATE: Dict[str, Any] = {
    "enabled": False,
    "engineer": "",
    "startsAt": None,
    "endsAt": None,
    "message": "Hệ thống đang được bảo trì để nâng cấp dịch vụ.",
    "updatedAt": None,
    "updatedBy": None,
}


class MaintenanceUpdate(BaseModel):
    enabled: bool
    engineer: str = Field(default="", max_length=120)
    startsAt: Optional[datetime] = None
    endsAt: Optional[datetime] = None
    message: str = Field(
        default="Hệ thống đang được bảo trì để nâng cấp dịch vụ.",
        max_length=500,
    )


def _iso(value: Optional[datetime]) -> Optional[str]:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def _load_state() -> Dict[str, Any]:
    try:
        raw = redis_client.get(REDIS_KEY)
        if not raw:
            return dict(DEFAULT_STATE)
        parsed = json.loads(raw)
        return {**DEFAULT_STATE, **parsed}
    except Exception:
        # Public maintenance check must fail open if Redis is temporarily unavailable.
        return dict(DEFAULT_STATE)


def _status_for(state: Dict[str, Any]) -> str:
    if not state.get("enabled"):
        return "OFF"

    now = datetime.now(timezone.utc)

    def parse(value: Optional[str]) -> Optional[datetime]:
        if not value:
            return None
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except Exception:
            return None

    start = parse(state.get("startsAt"))
    end = parse(state.get("endsAt"))

    if start and now < start:
        return "SCHEDULED"
    if end and now > end:
        return "OVERRUN"
    return "IN_PROGRESS"


def _public_payload(state: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "ok": True,
        "maintenance": {
            "enabled": bool(state.get("enabled")),
            "status": _status_for(state),
            "engineer": state.get("engineer") or "",
            "startsAt": state.get("startsAt"),
            "endsAt": state.get("endsAt"),
            "message": state.get("message") or DEFAULT_STATE["message"],
            "updatedAt": state.get("updatedAt"),
        },
    }


def _is_admin(user: Dict[str, Any]) -> bool:
    role = (
        user.get("role")
        or user.get("app_metadata", {}).get("role")
        or user.get("user_metadata", {}).get("role")
        or ""
    )
    return str(role).upper() == "ADMIN"


@router.get("")
def get_maintenance_status():
    return _public_payload(_load_state())


@router.put("")
def update_maintenance_status(
    req: MaintenanceUpdate,
    user: Dict[str, Any] = Depends(get_current_user),
):
    if not _is_admin(user):
        raise HTTPException(status_code=403, detail="ADMIN_REQUIRED")

    if req.enabled:
        if not req.engineer.strip():
            raise HTTPException(status_code=400, detail="Tên kỹ sư phụ trách là bắt buộc.")
        if not req.startsAt or not req.endsAt:
            raise HTTPException(status_code=400, detail="Cần nhập thời gian bắt đầu và kết thúc.")
        if req.endsAt <= req.startsAt:
            raise HTTPException(status_code=400, detail="Thời gian kết thúc phải sau thời gian bắt đầu.")

    updated = {
        "enabled": req.enabled,
        "engineer": req.engineer.strip(),
        "startsAt": _iso(req.startsAt),
        "endsAt": _iso(req.endsAt),
        "message": req.message.strip() or DEFAULT_STATE["message"],
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "updatedBy": str(user.get("id") or user.get("sub") or "admin"),
    }

    try:
        redis_client.set(REDIS_KEY, json.dumps(updated, ensure_ascii=False))
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Không thể lưu Maintenance Mode: {exc}")

    return _public_payload(updated)
