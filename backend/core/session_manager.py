import time
import requests
from typing import Any, Dict, Optional, Callable


class AuthenticatedSessionManager:
    """
    Authenticated Session Manager for ADQ
    - Manages Bearer Tokens, Custom Headers, and OAuth2/JWT Tokens
    - Automatically checks session validity before scanning
    - Auto-refreshes expired tokens via Refresh Endpoint or Auto-Login Callback
    - Injects valid Authorization headers dynamically into request pipelines
    """

    def __init__(
        self,
        token_a: Optional[str] = None,
        token_b: Optional[str] = None,
        refresh_url: Optional[str] = None,
        refresh_payload: Optional[Dict[str, Any]] = None,
        auth_type: str = "Bearer",
    ):
        self.tokens: Dict[str, Optional[str]] = {
            "A": token_a,
            "B": token_b,
        }
        self.refresh_url = refresh_url
        self.refresh_payload = refresh_payload or {}
        self.auth_type = auth_type
        self.token_expiry: Dict[str, float] = {"A": 0, "B": 0}

    def set_token(self, user_key: str, token: str, expires_in_seconds: int = 3600):
        self.tokens[user_key.upper()] = token
        self.token_expiry[user_key.upper()] = time.time() + expires_in_seconds

    def get_auth_header(self, user_key: str = "A") -> Dict[str, str]:
        user_key = user_key.upper()
        token = self.tokens.get(user_key)
        if not token:
            return {}
        if self.auth_type.lower() == "bearer":
            return {"Authorization": f"Bearer {token}"}
        if self.auth_type.lower() == "cookie":
            return {"Cookie": token}
        return {"Authorization": f"{self.auth_type} {token}"}

    def is_token_valid(self, user_key: str = "A") -> bool:
        user_key = user_key.upper()
        token = self.tokens.get(user_key)
        if not token:
            return False
        expiry = self.token_expiry.get(user_key, 0)
        if expiry > 0 and time.time() >= expiry:
            return False
        return True

    def refresh_session_if_needed(self, user_key: str = "A") -> bool:
        user_key = user_key.upper()
        if self.is_token_valid(user_key):
            return True

        if not self.refresh_url:
            return False

        try:
            resp = requests.post(self.refresh_url, json=self.refresh_payload, timeout=8)
            if resp.status_code == 200:
                data = resp.json()
                new_token = data.get("access_token") or data.get("token") or data.get("jwt")
                if new_token:
                    expires_in = data.get("expires_in", 3600)
                    self.set_token(user_key, new_token, expires_in_seconds=expires_in)
                    return True
        except Exception:
            pass
        return False

    def validate_endpoint_auth(self, test_url: str, user_key: str = "A") -> Dict[str, Any]:
        """Test if the current session token can successfully access an authenticated endpoint."""
        headers = self.get_auth_header(user_key)
        try:
            resp = requests.get(test_url, headers=headers, timeout=8)
            is_authed = resp.status_code not in (401, 403)
            return {
                "user_key": user_key,
                "status_code": resp.status_code,
                "authenticated": is_authed,
                "token_sample": headers.get("Authorization", "")[:30] + "...",
            }
        except Exception as exc:
            return {"user_key": user_key, "authenticated": False, "error": str(exc)}
