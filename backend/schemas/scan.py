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

class ApkRequest(BaseModel):
    apk_path: str
