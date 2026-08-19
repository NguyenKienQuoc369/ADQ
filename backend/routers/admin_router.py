from fastapi import APIRouter, Depends, Query, status, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from backend.schemas.admin import (
    UserCreateManual,
    UserStatusUpdate,
    UserRolePackageUpdate,
    RedeemCodeCreate,
    RedeemCodeRedeem,
)
from backend.services.admin_service import AdminService
from backend.core.auth import get_current_user, require_admin_role

router = APIRouter(prefix="/api", tags=["Admin & SOC Root Console"])

class AdminLoginRequest(BaseModel):
    master_key: str
    admin_id: Optional[str] = "root"

@router.post("/admin/auth/login")
def admin_root_login(payload: AdminLoginRequest):
    # Khóa bí mật quản trị viên
    ROOT_SECRET = os.getenv("ADMIN_ROOT_SECRET", "ADQ_SOC_ROOT_2026_SECURE_KEY")
    if payload.master_key != ROOT_SECRET:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sai Master Access Key")
    
    return {
        "ok": True,
        "token": f"soc_root_{uuid.uuid4().hex}",
        "role": "ADMIN",
        "name": "SOC Root Operator"
    }

@router.get("/admin/telemetry")
def get_system_telemetry(admin_user: Dict[str, Any] = Depends(require_admin_role)):
    return AdminService.get_system_health()

@router.get("/admin/global-scans")
def get_global_scans(admin_user: Dict[str, Any] = Depends(require_admin_role)):
    return {"scans": AdminService.get_global_scan_history()}

@router.post("/admin/global-scans/{job_id}/kill")
def kill_scan(job_id: str, admin_user: Dict[str, Any] = Depends(require_admin_role)):
    return AdminService.kill_scan_job(job_id)

@router.get("/admin/users")
def get_admin_users(
    search: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    packageTier: Optional[str] = Query(None),
    admin_user: Dict[str, Any] = Depends(require_admin_role),
):
    users = AdminService.get_users(search=search, role=role, package_tier=packageTier)
    return {"users": users}

@router.post("/admin/users", status_code=status.HTTP_201_CREATED)
def create_manual_user(
    input_data: UserCreateManual,
    admin_user: Dict[str, Any] = Depends(require_admin_role),
):
    return AdminService.create_manual_user(input_data)

@router.patch("/admin/users/{user_id}/status")
def update_user_status(
    user_id: str,
    status_payload: UserStatusUpdate,
    admin_user: Dict[str, Any] = Depends(require_admin_role),
):
    return {"user": AdminService.update_user_status(user_id, status_payload)}

@router.patch("/admin/users/{user_id}/role-package")
def update_user_role_and_package(
    user_id: str,
    payload: UserRolePackageUpdate,
    admin_user: Dict[str, Any] = Depends(require_admin_role),
):
    return {"user": AdminService.update_user_role_and_package(user_id, payload)}

@router.delete("/admin/users/{user_id}")
def delete_admin_user(
    user_id: str,
    admin_user: Dict[str, Any] = Depends(require_admin_role),
):
    return {"ok": True, "deleted": AdminService.delete_user(user_id)}

@router.get("/admin/redeem-codes")
def get_redeem_codes(admin_user: Dict[str, Any] = Depends(require_admin_role)):
    return {"codes": AdminService.get_redeem_codes()}

@router.post("/admin/redeem-codes", status_code=status.HTTP_201_CREATED)
def create_redeem_code(
    input_data: RedeemCodeCreate,
    admin_user: Dict[str, Any] = Depends(require_admin_role),
):
    return {"code": AdminService.create_redeem_code(input_data)}

@router.post("/account/redeem")
def redeem_code(
    payload: RedeemCodeRedeem,
    user: Dict[str, Any] = Depends(get_current_user),
):
    rc = AdminService.redeem_code(payload.code)
    return {"ok": True, "redeemed": rc, "user": user}
