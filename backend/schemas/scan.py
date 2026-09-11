from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class ScanRequest(BaseModel):
    target: str
    extra_args: Optional[List[str]] = Field(default_factory=list)

class ScanResponse(BaseModel):
    ok: bool
    job_id: str
    target: str
    status: str
    message: str

class CopilotChatRequest(BaseModel):
    prompt: str
    conv_id: Optional[str] = None
    scan_job_id: Optional[str] = None
    stress_job_id: Optional[str] = None

class CopilotAnalyzeRequest(BaseModel):
    job_id: str

class CopilotPatchRequest(BaseModel):
    vulnerability_type: str
    endpoint: str
    framework: Optional[str] = "Next.js / FastAPI"

class WafDetectRequest(BaseModel):
    target_url: str

class StressRequest(BaseModel):
    target_url: str
    target_requests: Optional[int] = 1000
    duration: str = "5s"
    bypass_code: Optional[str] = ""
    waf_type: Optional[str] = "standard"
    custom_headers: Optional[Dict[str, str]] = None
    custom_cookies: Optional[Dict[str, str]] = None
    project_id: Optional[str] = None

class StressVerificationRequest(BaseModel):
    target_url: str

class ApkRequest(BaseModel):
    apk_path: str

SENSITIVE_ARG_NAMES = {
    "--token-a", "--token-b", "--token", "--auth-token",
    "--authorization", "--auth", "--api-key", "--apikey",
    "--secret", "--password", "--passwd", "--pwd", "--pass",
    "--access-token", "--refresh-token"
}

SENSITIVE_KEY_NAMES = {
    "token_a", "token_b", "token-a", "token-b", "auth_token", "auth-token",
    "token", "authorization", "auth", "api_key", "api-key", "apikey",
    "secret", "secret_key", "secret-key", "key",
    "password", "passwd", "pwd", "pass",
    "access_token", "access-token", "refresh_token", "refresh-token"
}

def sanitize_extra_args(args_list: Optional[List[str]]) -> List[str]:
    if not isinstance(args_list, list):
        return args_list or []
    sanitized = []
    i = 0
    while i < len(args_list):
        arg = str(args_list[i])
        if "=" in arg and arg.startswith("--"):
            flag, val = arg.split("=", 1)
            if flag.lower() in SENSITIVE_ARG_NAMES:
                sanitized.append(f"{flag}=****")
            else:
                sanitized.append(arg)
            i += 1
        elif arg.lower() in SENSITIVE_ARG_NAMES:
            sanitized.append(arg)
            if i + 1 < len(args_list):
                next_val = str(args_list[i + 1])
                if not next_val.startswith("-"):
                    sanitized.append("****")
                    i += 1
            i += 1
        else:
            sanitized.append(arg)
            i += 1
    return sanitized

def sanitize_request_data(req_data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not isinstance(req_data, dict):
        return req_data or {}
    sanitized = dict(req_data)
    for k, v in req_data.items():
        k_lower = str(k).lower().replace("-", "_")
        if k_lower in SENSITIVE_KEY_NAMES and isinstance(v, str) and v:
            sanitized[k] = "****"
        elif k == "extra_args" and isinstance(v, list):
            sanitized[k] = sanitize_extra_args(v)
        elif isinstance(v, dict):
            sanitized[k] = sanitize_request_data(v)
    return sanitized
