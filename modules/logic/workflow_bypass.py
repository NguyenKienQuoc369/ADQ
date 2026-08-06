from typing import Any, Dict, List, Optional

import requests


class WorkflowBypassScanner:
    def __init__(self, base_url: str, timeout: int = 10):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def _url(self, endpoint: str) -> str:
        return f"{self.base_url}{endpoint}"

    def scan(
        self,
        prerequisite_endpoints: List[str],
        final_endpoint: str,
        final_method: str = "POST",
        final_body: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        headers = headers or {}
        final_body = final_body or {}

        # Intentionally skip prerequisite endpoints and directly call final step.
        resp = requests.request(
            final_method.upper(),
            self._url(final_endpoint),
            headers=headers,
            json=final_body,
            timeout=self.timeout,
        )

        flagged = resp.status_code in (200, 201)
        severity = "critical" if flagged else "none"

        return {
            "scanner": "workflow_bypass",
            "flagged": flagged,
            "severity": severity,
            "reason": (
                "Final workflow endpoint succeeded without session context from required previous steps"
                if flagged
                else "No workflow bypass signal"
            ),
            "prerequisite_endpoints": prerequisite_endpoints,
            "final_call": {
                "endpoint": final_endpoint,
                "method": final_method.upper(),
                "status": resp.status_code,
                "content_length": len(resp.content or b""),
                "sample": (resp.text[:250] if resp.text else ""),
            },
        }
