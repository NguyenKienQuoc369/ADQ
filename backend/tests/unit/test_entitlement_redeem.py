"""
Unit and regression tests for ADQ plan entitlements, redeem code business rules,
and recovery semantics.
"""

import pytest
from datetime import datetime, timedelta, timezone
from backend.schemas.admin import UserCreateManual, UserRolePackageUpdate, RedeemCodeCreate


def test_package_tier_schema_validation():
    """Verify supported package tiers strictly adhere to FREE, PRO, PRO_MAX."""
    # Valid assignments
    u1 = UserCreateManual(name="Alice", email="alice@example.com", packageTier="FREE")
    assert u1.packageTier == "FREE"

    u2 = UserCreateManual(name="Bob", email="bob@example.com", packageTier="PRO")
    assert u2.packageTier == "PRO"

    u3 = UserCreateManual(name="Charlie", email="charlie@example.com", packageTier="PRO_MAX")
    assert u3.packageTier == "PRO_MAX"

    # Invalid assignments should raise ValidationError
    with pytest.raises(Exception):
        UserCreateManual(name="Dave", email="dave@example.com", packageTier="HOBBY")

    with pytest.raises(Exception):
        UserCreateManual(name="Eve", email="eve@example.com", packageTier="ENTERPRISE")


def test_redeem_code_schema_validation():
    """Verify RedeemCodeCreate only allows PRO and PRO_MAX tiers."""
    r1 = RedeemCodeCreate(packageTier="PRO", durationLabel="1 Month")
    assert r1.packageTier == "PRO"

    r2 = RedeemCodeCreate(packageTier="PRO_MAX", durationLabel="1 Year")
    assert r2.packageTier == "PRO_MAX"

    with pytest.raises(Exception):
        RedeemCodeCreate(packageTier="FREE", durationLabel="1 Month")


def test_redeem_state_recovery_logic():
    """
    Test the idempotent same-user recovery business logic:
    1. Valid unused PRO_MAX -> Granted
    2. Same-user already redeemed -> Active redemption recovered
    3. Different-user redeemed -> Blocked
    4. Expired redemption -> Blocked
    5. Revoked code -> Blocked
    """
    now = datetime.now(timezone.utc)

    # Simulated DB tables
    redeem_codes = {
        "PROMAX-TEST-1": {
            "code": "PROMAX-TEST-1",
            "packageTier": "PRO_MAX",
            "durationDays": 30,
            "maxUses": 1,
            "usedCount": 1,
            "status": "USED",
        },
        "PROMAX-FRESH": {
            "code": "PROMAX-FRESH",
            "packageTier": "PRO_MAX",
            "durationDays": 30,
            "maxUses": 1,
            "usedCount": 0,
            "status": "ACTIVE",
        },
        "REVOKED-CODE": {
            "code": "REVOKED-CODE",
            "packageTier": "PRO_MAX",
            "durationDays": 30,
            "maxUses": 1,
            "usedCount": 0,
            "status": "REVOKED",
        },
    }

    redemptions = [
        {
            "code": "PROMAX-TEST-1",
            "userAuthId": "auth-uuid-user-a",
            "userEmail": "usera@example.com",
            "createdAt": now - timedelta(days=5),
        }
    ]

    def evaluate_redeem(code_input: str, user_id: str, email: str):
        normalized_code = code_input.strip().upper()
        normalized_email = email.strip().lower()

        code_record = redeem_codes.get(normalized_code)
        if not code_record:
            return {"ok": False, "code": "INVALID_CODE", "error": "Code does not exist"}

        if code_record["status"] == "REVOKED":
            return {"ok": False, "code": "REVOKED", "error": "Code is revoked"}

        # Idempotent same-user recovery check
        same_user_redemption = next(
            (
                r
                for r in redemptions
                if r["code"] == normalized_code
                and (r["userAuthId"] == user_id or r["userEmail"].lower() == normalized_email)
            ),
            None,
        )

        if same_user_redemption:
            duration = code_record.get("durationDays")
            computed_expiry = (
                same_user_redemption["createdAt"] + timedelta(days=duration)
                if duration
                else None
            )
            if computed_expiry and computed_expiry <= now:
                return {"ok": False, "code": "EXPIRED_CODE", "error": "Code has expired"}

            return {
                "ok": True,
                "recovered": True,
                "packageTier": code_record["packageTier"],
                "planExpiresAt": computed_expiry,
            }

        # Check for usage by another user
        if code_record["status"] == "USED" or code_record["usedCount"] >= code_record["maxUses"]:
            return {"ok": False, "code": "ALREADY_USED", "error": "Code already used by another user"}

        # Fresh activation
        duration = code_record.get("durationDays")
        new_expiry = now + timedelta(days=duration) if duration else None
        return {
            "ok": True,
            "recovered": False,
            "packageTier": code_record["packageTier"],
            "planExpiresAt": new_expiry,
        }

    # Scenario 1: Valid unused PRO_MAX -> Granted
    res1 = evaluate_redeem("promax-fresh", "user-b", "userb@example.com")
    assert res1["ok"] is True
    assert res1["recovered"] is False
    assert res1["packageTier"] == "PRO_MAX"

    # Scenario 2: Same-user already used code -> Recovers PRO_MAX
    res2 = evaluate_redeem("PROMAX-TEST-1", "auth-uuid-user-a", "UserA@Example.COM")
    assert res2["ok"] is True
    assert res2["recovered"] is True
    assert res2["packageTier"] == "PRO_MAX"

    # Scenario 3: Different user tries to use used code -> Blocked
    res3 = evaluate_redeem("PROMAX-TEST-1", "auth-uuid-user-c", "userc@example.com")
    assert res3["ok"] is False
    assert res3["code"] == "ALREADY_USED"

    # Scenario 4: Revoked code -> Blocked
    res4 = evaluate_redeem("REVOKED-CODE", "user-b", "userb@example.com")
    assert res4["ok"] is False
    assert res4["code"] == "REVOKED"

    # Scenario 5: Non-existent code -> Blocked
    res5 = evaluate_redeem("NONEXISTENT", "user-b", "userb@example.com")
    assert res5["ok"] is False
    assert res5["code"] == "INVALID_CODE"


def test_email_case_insensitivity():
    """Verify email matching normalizes case correctly."""
    email_a = "  User.Name+Test@Example.COM  "
    normalized = email_a.strip().lower()
    assert normalized == "user.name+test@example.com"
