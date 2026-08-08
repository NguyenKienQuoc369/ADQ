import re
import json
import urllib.parse
from typing import Any, Dict, List, Optional, Set
import requests


# Regex patterns for API & Route extraction
ENDPOINT_PATTERNS = [
    # Explicit API routes
    re.compile(r'["\'](/(?:api|v[0-9]|internal|admin|auth|user|v1|v2|graphql|rest|service|v3)[a-zA-Z0-9_\-/\?=&%.]*)["\']'),
    # Fetch / Axios / Ajax calls
    re.compile(r'(?:fetch|axios|get|post|put|delete|patch)\s*\(\s*["\']([^"\'\s]+\.[a-zA-Z0-9]{2,4}/[^"\'\s]+|/[^"\'\s]+)["\']'),
    # Object path/route definitions
    re.compile(r'(?:path|route|url|endpoint|uri)\s*[:=]\s*["\']([^"\'\s]+)["\']', re.IGNORECASE),
    # Next.js / React Router dynamic imports / API endpoints
    re.compile(r'["\'](/_[^"\'\s]+|/static/[^"\'\s]+)["\']'),
]

# Regex patterns for secrets & sensitive tokens
SECRET_PATTERNS = {
    "jwt_token": re.compile(r'eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*'),
    "aws_access_key": re.compile(r'AKIA[0-9A-Z]{16}'),
    "bearer_token": re.compile(r'bearer\s+[a-zA-Z0-9_\-\.=]+', re.IGNORECASE),
    "api_key_hardcoded": re.compile(r'(?:api_key|apikey|secret_key|client_secret|auth_token|access_token|private_key)\s*[:=]\s*["\']([a-zA-Z0-9_\-]{16,})["\']', re.IGNORECASE),
    "slack_webhook": re.compile(r'https://hooks\.slack\.com/services/T[a-zA-Z0-9_]+/B[a-zA-Z0-9_]+/[a-zA-Z0-9_]+'),
    "google_api_key": re.compile(r'AIzaSy[A-Za-z0-9-_]{35}'),
    "github_token": re.compile(r'ghp_[a-zA-Z0-9]{36}'),
}

# Regex for Query Parameters & Keys in JS Objects
PARAM_PATTERNS = [
    re.compile(r'[?&]([a-zA-Z0-9_\-]+)='),
    re.compile(r'params\s*:\s*\{([^}]+)\}'),
    re.compile(r'(?:query|body|data)\s*[:=]\s*\{([^}]+)\}'),
    re.compile(r'["\']([a-zA-Z0-9_]+)["\']\s*:\s*["\'][^"\'\s]+["\']'),
]


class DeepJSAnalyzer:
    """
    Deep JS Analysis Engine for ADQ Platform
    - Extracts hidden API endpoints & routes from JavaScript code
    - Checks & parses Sourcemaps (.map) for un-minified source code
    - Detects hardcoded secrets, API keys, and JWT tokens
    - Extracts hidden query/body parameters for Context-Aware Param Fuzzing
    """

    def __init__(self, timeout: int = 10):
        self.timeout = timeout

    def analyze_code(self, js_code: str, source_url: Optional[str] = None) -> Dict[str, Any]:
        endpoints: Set[str] = set()
        secrets: List[Dict[str, str]] = []
        parameters: Set[str] = set()
        sourcemap_url: Optional[str] = None

        if not js_code:
            return {
                "source_url": source_url,
                "endpoints": [],
                "secrets": [],
                "parameters": [],
                "sourcemap": None,
            }

        # 1. Extract Endpoints
        for pattern in ENDPOINT_PATTERNS:
            for match in pattern.finditer(js_code):
                val = match.group(1).strip()
                if val and len(val) > 1 and not val.endswith(".png") and not val.endswith(".jpg") and not val.endswith(".css"):
                    endpoints.add(val)

        # 2. Extract Secrets
        for secret_type, pattern in SECRET_PATTERNS.items():
            for match in pattern.finditer(js_code):
                matched_val = match.group(0)
                # Ignore generic false positives
                if len(matched_val) > 8 and "example" not in matched_val.lower():
                    secrets.append({
                        "type": secret_type,
                        "value": matched_val[:80],  # Truncate for safety
                    })

        # 3. Extract Parameters
        for pattern in PARAM_PATTERNS:
            for match in pattern.finditer(js_code):
                group_val = match.group(1)
                # Parse object-like parameters
                if ":" in group_val or "," in group_val:
                    keys = re.findall(r'([a-zA-Z0-9_]+)\s*:', group_val)
                    for k in keys:
                        if k not in {"type", "headers", "method", "url", "content", "true", "false", "null"}:
                            parameters.add(k)
                else:
                    k = group_val.strip()
                    if k and k not in {"type", "headers", "method", "url", "true", "false", "null"}:
                        parameters.add(k)

        # 4. Check for Sourcemap declaration
        sm_match = re.search(r'//#\s*sourceMappingURL=([^\s]+)', js_code)
        if sm_match:
            sourcemap_url = sm_match.group(1)
            if source_url and not sourcemap_url.startswith("http"):
                sourcemap_url = urllib.parse.urljoin(source_url, sourcemap_url)

        return {
            "source_url": source_url,
            "endpoints": sorted(list(endpoints)),
            "secrets": secrets,
            "parameters": sorted(list(parameters)),
            "sourcemap_found": sourcemap_url is not None,
            "sourcemap_url": sourcemap_url,
        }

    def fetch_and_analyze(self, js_url: str) -> Dict[str, Any]:
        """Fetch JS content from URL, check for .map sourcemap, and analyze."""
        try:
            resp = requests.get(js_url, timeout=self.timeout, headers={"User-Agent": "Mozilla/5.0 ADQ-Recon/1.0"})
            if resp.status_code != 200:
                return {"source_url": js_url, "error": f"HTTP {resp.status_code}"}
            
            result = self.analyze_code(resp.text, source_url=js_url)

            # Fallback: check if js_url + .map exists if no sourceMappingURL comment
            if not result["sourcemap_found"]:
                map_url = f"{js_url}.map"
                try:
                    map_resp = requests.head(map_url, timeout=5)
                    if map_resp.status_code == 200:
                        result["sourcemap_found"] = True
                        result["sourcemap_url"] = map_url
                except Exception:
                    pass

            return result
        except Exception as exc:
            return {"source_url": js_url, "error": str(exc)}

    def analyze_sourcemap_content(self, map_content_json: str) -> Dict[str, Any]:
        """Parse un-minified source code files inside a Sourcemap JSON."""
        try:
            data = json.loads(map_content_json)
            sources = data.get("sources", [])
            sources_content = data.get("sourcesContent", [])
            
            extracted_files = []
            all_endpoints = set()
            all_secrets = []

            for idx, source_path in enumerate(sources):
                content = sources_content[idx] if idx < len(sources_content) else ""
                if content:
                    file_analysis = self.analyze_code(content, source_url=source_path)
                    extracted_files.append({
                        "file": source_path,
                        "endpoints_count": len(file_analysis["endpoints"]),
                        "secrets_count": len(file_analysis["secrets"]),
                    })
                    all_endpoints.update(file_analysis["endpoints"])
                    all_secrets.extend(file_analysis["secrets"])

            return {
                "valid_sourcemap": True,
                "sources_count": len(sources),
                "recovered_endpoints": sorted(list(all_endpoints)),
                "recovered_secrets": all_secrets,
                "files_summary": extracted_files[:20],  # Top 20 files
            }
        except Exception as exc:
            return {"valid_sourcemap": False, "error": str(exc)}
