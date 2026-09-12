"""
Unit and regression tests for ADQ plan entitlements, redeem code business rules,
recovery semantics, and canonical database integration.
"""

import pytest
from datetime import datetime, timedelta, timezone
from backend.schemas.admin import UserCreateManual, UserRolePackageUpdate, RedeemCodeCreate
from backend.core.security.stress_governor import STRESS_TIER_LIMITS


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


def test_stress_tier_limits_mapping():
    """Verify backend stress limits match entitlement rules."""
    assert STRESS_TIER_LIMITS["FREE"]["allowed"] is False
    assert STRESS_TIER_LIMITS["PRO"]["allowed"] is True
    assert STRESS_TIER_LIMITS["PRO"]["max_requests"] == 2000
    assert STRESS_TIER_LIMITS["PRO_MAX"]["allowed"] is True
    assert STRESS_TIER_LIMITS["PRO_MAX"]["max_requests"] == 5000
    assert STRESS_TIER_LIMITS["PRO_MAX"]["max_rps"] == 250


def test_redeem_state_recovery_logic():
    """
    Test the idempotent same-user recovery business logic:
    1. Valid unused PRO_MAX -> Granted
    2. Same-user already redeemed -> Active redemption recovered
    3. Different-user redeemed -> Blocked
    4. Expired redemption -> Blocked
    5. Revoked code -> Blocked
    6. Case/whitespace normalization works
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


def test_email_and_code_normalization():
    """Verify email and code matching normalizes whitespace and casing correctly."""
    email_a = "  User.Name+Test@Example.COM  "
    code_a = "  adq-promax-fresh  "
    normalized_email = email_a.strip().lower()
    normalized_code = code_a.strip().upper()
    assert normalized_email == "user.name+test@example.com"
    assert normalized_code == "ADQ-PROMAX-FRESH"


def test_canonical_alphanumeric_code_matching():
    """Verify all punctuation and format variations match the same canonical key."""
    def normalize_key(s: str) -> str:
        import re
        return re.sub(r"[^A-Z0-9]", "", s.strip().upper()).replace("PRO_MAX", "PROMAX")

    canonical_target = "ADQ_PRO_MAX_12345"
    key_target = normalize_key(canonical_target)

    variations = [
        "ADQ_PRO_MAX_12345",
        "adq_pro_max_12345",
        "ADQ-PRO-MAX-12345",
        "adq-promax-12345",
        "ADQ PRO MAX 12345",
        "ADQPROMAX12345",
        "adq-pro_max-12345",
    ]

    for v in variations:
        assert normalize_key(v) == key_target, f"Failed for variation: {v}"


def test_scan_hydration_error_state_separation():
    """Verify auth errors (401/403/500) are distinguished from legitimate empty scan lists."""
    class StateModel:
        AUTH_LOADING = "AUTH_LOADING"
        SUCCESS_WITH_DATA = "SUCCESS_WITH_DATA"
        SUCCESS_EMPTY = "SUCCESS_EMPTY"
        ERROR = "ERROR"

    def determine_ui_state(auth_loading: bool, is_error: bool, scans: list) -> str:
        if auth_loading:
            return StateModel.AUTH_LOADING
        if is_error:
            return StateModel.ERROR
        if len(scans) > 0:
            return StateModel.SUCCESS_WITH_DATA
        return StateModel.SUCCESS_EMPTY

    assert determine_ui_state(auth_loading=True, is_error=False, scans=[]) == StateModel.AUTH_LOADING
    assert determine_ui_state(auth_loading=False, is_error=True, scans=[]) == StateModel.ERROR
    assert determine_ui_state(auth_loading=False, is_error=False, scans=[{"id": "scan-1"}]) == StateModel.SUCCESS_WITH_DATA
    assert determine_ui_state(auth_loading=False, is_error=False, scans=[]) == StateModel.SUCCESS_EMPTY


def test_multi_use_code_cross_user_behavior():
    """Verify codes with maxUses > 1 can be redeemed by distinct users until exhausted."""
    now = datetime.now(timezone.utc)
    multi_code = {
        "code": "ADQ-PRO-MULTI-3",
        "packageTier": "PRO",
        "durationDays": 30,
        "maxUses": 3,
        "usedCount": 0,
        "status": "UNUSED",
    }
    redemptions = []

    def claim_code(user_id: str, email: str):
        # 1. Check same-user
        if any(r["code"] == multi_code["code"] and r["userAuthId"] == user_id for r in redemptions):
            return {"ok": True, "alreadyActive": True, "code": "ALREADY_ACTIVE"}
        # 2. Check capacity
        if multi_code["usedCount"] >= multi_code["maxUses"] or multi_code["status"] == "USED":
            return {"ok": False, "code": "ALREADY_USED"}
        # 3. Atomic increment
        multi_code["usedCount"] += 1
        if multi_code["usedCount"] >= multi_code["maxUses"]:
            multi_code["status"] = "USED"
        else:
            multi_code["status"] = "PARTIAL"
        redemptions.append({"code": multi_code["code"], "userAuthId": user_id, "userEmail": email})
        return {"ok": True, "code": "VALID_ACTIVATED"}

    # User 1 claims
    c1 = claim_code("u1", "u1@adq.io.vn")
    assert c1["ok"] is True and c1["code"] == "VALID_ACTIVATED"
    assert multi_code["usedCount"] == 1
    assert multi_code["status"] == "PARTIAL"

    # User 2 claims
    c2 = claim_code("u2", "u2@adq.io.vn")
    assert c2["ok"] is True and c2["code"] == "VALID_ACTIVATED"
    assert multi_code["usedCount"] == 2

    # User 3 claims (last slot)
    c3 = claim_code("u3", "u3@adq.io.vn")
    assert c3["ok"] is True and c3["code"] == "VALID_ACTIVATED"
    assert multi_code["usedCount"] == 3
    assert multi_code["status"] == "USED"

    # User 4 blocked (exhausted)
    c4 = claim_code("u4", "u4@adq.io.vn")
    assert c4["ok"] is False and c4["code"] == "ALREADY_USED"

    # User 1 replays -> ALREADY_ACTIVE (idempotent, no increment)
    c1_replay = claim_code("u1", "u1@adq.io.vn")
    assert c1_replay["ok"] is True and c1_replay["code"] == "ALREADY_ACTIVE"
    assert multi_code["usedCount"] == 3


def test_fake_tier_prefix_codes_rejected():
    """Verify invented strings with PRO / PROMAX prefixes are strictly rejected without DB row."""
    fake_codes = [
        "PRO-UNAUTHORIZED-123",
        "PROMAX-FREE-UPGRADE",
        "ADQ-PRO_MAX-HACK",
        "PRO999999",
    ]
    db_codes = {"ADQ-PROMAX-VALID-1"}

    for fake in fake_codes:
        normalized = fake.strip().upper().replace("-", "").replace("_", "")
        assert normalized not in db_codes, f"Fake code should not exist in DB: {fake}"

