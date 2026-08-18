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
    bearer_token: Optional[str] = ""
    vus: int = 50
    duration: str = "10s"
    method: str = "GET"
    body: Optional[str] = None
    headers: Optional[Dict[str, str]] = None
    bypass_config: Optional[Dict[str, Any]] = None
    project_id: Optional[str] = None

class ApkRequest(BaseModel):
    apk_path: str
