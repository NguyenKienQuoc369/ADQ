import json
import re
from typing import Any, Dict, Optional

import requests


class IDORScanner:
    def __init__(self, base_url: str, timeout: int = 10):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def extract_identifiers(self, text: str):
        pattern = r"(user_id|account_id|owner_id|id)\s*[:=]\s*['\"]?(\d+)"
        return re.findall(pattern, text)

    def swap_identifiers_in_body(self, body: Any, source_id: str, target_id: str) -> Any:
        if isinstance(body, dict):
            out = {}
            for key, value in body.items():
                if key in {"user_id", "account_id", "owner_id", "id"} and str(value) == str(source_id):
                    out[key] = str(target_id)
                else:
                    out[key] = self.swap_identifiers_in_body(value, source_id, target_id)
            return out
        if isinstance(body, list):
            return [self.swap_identifiers_in_body(i, source_id, target_id) for i in body]
        return body

    def _auth_header(self, token: str) -> Dict[str, str]:
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    def _request(
        self,
        endpoint: str,
        token: str,
        method: str = "GET",
        body: Optional[Dict[str, Any]] = None,
    ) -> requests.Response:
        url = f"{self.base_url}{endpoint}"
        method = method.upper()
        if method == "GET":
            return requests.get(url, headers=self._auth_header(token), timeout=self.timeout)
        return requests.request(method, url, headers=self._auth_header(token), json=body or {}, timeout=self.timeout)

    def scan(
        self,
        endpoint_template: str,
        token_a: str,
        token_b: str,
        user_id_a: str,
        user_id_b: str,
        method: str = "GET",
        body: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        endpoint_a = endpoint_template.replace("{user_id}", str(user_id_a)).replace("{account_id}", str(user_id_a))
        baseline_body = body or {}
        swapped_body = self.swap_identifiers_in_body(baseline_body, source_id=str(user_id_b), target_id=str(user_id_a))

        baseline = self._request(endpoint_a, token=token_a, method=method, body=baseline_body)
        swapped = self._request(endpoint_a, token=token_b, method=method, body=swapped_body)

        base_len = len(baseline.content or b"")
        swap_len = len(swapped.content or b"")
        same_size_ratio = (min(base_len, swap_len) / max(base_len, swap_len)) if max(base_len, swap_len) > 0 else 0

        flagged = swapped.status_code == 200 and same_size_ratio >= 0.9
        severity = "critical" if flagged and same_size_ratio >= 0.98 else ("high" if flagged else "none")

        return {
            "scanner": "idor_bola",
            "flagged": flagged,
            "severity": severity,
            "reason": (
                "Potential cross-tenant data exposure: swapped token still accesses A resource"
                if flagged
                else "No strong IDOR signal"
            ),
            "request": {
                "endpoint": endpoint_a,
                "method": method.upper(),
                "swapped_body": swapped_body,
            },
            "baseline": {
                "status": baseline.status_code,
                "content_length": base_len,
            },
            "swapped": {
                "status": swapped.status_code,
                "content_length": swap_len,
                "size_similarity_ratio": round(same_size_ratio, 4),
                "sample": (swapped.text[:250] if swapped.text else ""),
            },
        }
