from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class ScanRequest(BaseModel):
    target: str = Field(..., example="https://example.com")
    extra_args: List[str] = Field(default_factory=list)
    logic_scan: bool = False
    logic_base_url: Optional[str] = None
    race_endpoint: Optional[str] = None
    race_concurrency: int = 50
    idor_endpoint_template: Optional[str] = None
    token_a: Optional[str] = None
    token_b: Optional[str] = None
    workflow_endpoint: Optional[str] = None
    headers: Dict[str, str] = Field(default_factory=dict)


class ScanResponse(BaseModel):
    ok: bool = True
    job_id: str
    target: str
    status: str
    message: str = "Scan job processed successfully"


class CopilotChatRequest(BaseModel):
    prompt: str
    target: Optional[str] = None
    job_id: Optional[str] = None


class CopilotAnalyzeRequest(BaseModel):
    job_id: str


class CopilotPatchRequest(BaseModel):
    vulnerability_type: str
    endpoint: str
    framework: str = "Next.js"


class StressRequest(BaseModel):
    target_url: str
    bearer_token: Optional[str] = ""
    vus: int = 50
    duration: str = "10s"
    method: str = "GET"


class ApkRequest(BaseModel):
    apk_path: str
