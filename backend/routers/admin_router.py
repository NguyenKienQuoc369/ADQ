from fastapi import APIRouter, Depends, Query, status
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

router = APIRouter(prefix="/api", tags=["Admin & User Management"])


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
    res = AdminService.create_manual_user(input_data)
    return res


@router.patch("/admin/users/{user_id}/status")
def update_user_status(
    user_id: str,
    status_payload: UserStatusUpdate,
    admin_user: Dict[str, Any] = Depends(require_admin_role),
):
    user = AdminService.update_user_status(user_id, status_payload)
    return {"user": user}


@router.patch("/admin/users/{user_id}/role-package")
def update_user_role_and_package(
    user_id: str,
    payload: UserRolePackageUpdate,
    admin_user: Dict[str, Any] = Depends(require_admin_role),
):
    user = AdminService.update_user_role_and_package(user_id, payload)
    return {"user": user}


@router.delete("/admin/users/{user_id}")
def delete_admin_user(
    user_id: str,
    admin_user: Dict[str, Any] = Depends(require_admin_role),
):
    deleted = AdminService.delete_user(user_id)
    return {"ok": True, "deleted": deleted}


@router.get("/admin/redeem-codes")
def get_redeem_codes(admin_user: Dict[str, Any] = Depends(require_admin_role)):
    codes = AdminService.get_redeem_codes()
    return {"codes": codes}


@router.post("/admin/redeem-codes", status_code=status.HTTP_201_CREATED)
def create_redeem_code(
    input_data: RedeemCodeCreate,
    admin_user: Dict[str, Any] = Depends(require_admin_role),
):
    code = AdminService.create_redeem_code(input_data)
    return {"code": code}


@router.post("/account/redeem")
def redeem_code(
    payload: RedeemCodeRedeem,
    user: Dict[str, Any] = Depends(get_current_user),
):
    rc = AdminService.redeem_code(payload.code)
    return {"ok": True, "redeemed": rc, "user": user}
