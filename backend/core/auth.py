import os
from typing import Dict, Any, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from backend.core.config import settings

try:
    import jwt
except ImportError:
    jwt = None


security = HTTPBearer(auto_error=False)


def _dev_auth_enabled() -> bool:
    return os.getenv("DEV_AUTH_BYPASS", "false").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def _dev_user() -> Dict[str, Any]:
    return {
        "sub": "dev_user_id",
        "id": "dev_user_id",
        "email": "admin@localhost",
        "role": "ADMIN",
        "packageTier": "PRO_MAX",
        "user_metadata": {
            "role": "ADMIN",
            "name": "Local Dev Admin",
            "packageTier": "PRO_MAX",
        },
    }


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Dict[str, Any]:
    # Local development only.
    # Khi DEV_AUTH_BYPASS=true, bỏ qua cả token Supabase mà browser gửi.
    # Production MUST NOT set DEV_AUTH_BYPASS=true.
    if _dev_auth_enabled():
        return _dev_user()

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization token required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    if jwt is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="JWT verification unavailable: PyJWT is not installed",
        )

    try:
        header = jwt.get_unverified_header(token)
        algorithm = str(header.get("alg") or "").upper()

        # Modern Supabase projects use asymmetric signing keys.
        # Resolve the public key from the project's JWKS endpoint.
        if algorithm in {"ES256", "RS256"}:
            supabase_url = str(getattr(settings, "SUPABASE_URL", "") or "").rstrip("/")

            if not supabase_url:
                raise RuntimeError("SUPABASE_URL is not configured")

            if not hasattr(jwt, "PyJWKClient"):
                raise RuntimeError(
                    "Installed PyJWT version does not support PyJWKClient"
                )

            jwks_url = f"{supabase_url}/auth/v1/.well-known/jwks.json"
            jwks_client = jwt.PyJWKClient(jwks_url)
            signing_key = jwks_client.get_signing_key_from_jwt(token)

            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=[algorithm],
                options={"verify_aud": False},
            )

        # Legacy Supabase projects may still use HS256.
        elif algorithm == "HS256":
            jwt_secret = str(
                getattr(settings, "SUPABASE_JWT_SECRET", "") or ""
            ).strip()

            if not jwt_secret:
                raise RuntimeError(
                    "Legacy HS256 token detected but SUPABASE_JWT_SECRET is not configured"
                )

            payload = jwt.decode(
                token,
                jwt_secret,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )

        else:
            raise ValueError(f"Unsupported JWT algorithm: {algorithm or 'unknown'}")

        if not isinstance(payload, dict) or not (
            payload.get("sub") or payload.get("id")
        ):
            raise ValueError("JWT payload does not contain a user identifier")

        return payload

    except HTTPException:
        raise
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"JWT verification configuration error: {exc}",
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authorization token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def require_admin_role(
    user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    role = (
        user.get("user_metadata", {}).get("role")
        or user.get("role")
        or user.get("app_metadata", {}).get("role")
    )

    if str(role or "").upper() != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Admin role required",
        )

    return user
