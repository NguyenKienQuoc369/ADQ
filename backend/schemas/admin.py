from pydantic import BaseModel, Field
from typing import Optional, Literal


class UserCreateManual(BaseModel):
    name: str
    email: str
    role: Literal["USER", "ADMIN"] = "USER"
    packageTier: Literal["FREE", "PRO", "PRO_MAX"] = "FREE"
    password: Optional[str] = None
    status: Optional[str] = "ACTIVE"
    dailyLimit: Optional[int] = 5
    planExpiresAt: Optional[str] = None


class UserStatusUpdate(BaseModel):
    status: Literal["ACTIVE", "PENDING", "LOCKED"]


class UserRolePackageUpdate(BaseModel):
    role: Literal["USER", "ADMIN"]
    packageTier: Literal["FREE", "PRO", "PRO_MAX"]
    planExpiresAt: Optional[str] = None


class RedeemCodeCreate(BaseModel):
    packageTier: Literal["PRO", "PRO_MAX"]
    durationLabel: str
    maxUses: int = 1


class RedeemCodeRedeem(BaseModel):
    code: str
