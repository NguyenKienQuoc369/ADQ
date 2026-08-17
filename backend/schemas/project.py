from pydantic import BaseModel, Field
from typing import Optional, Dict, Any


class ProjectCreate(BaseModel):
    name: Optional[str] = None
    domain: Optional[str] = None
    description: Optional[str] = None
    password: Optional[str] = None
    module: Optional[str] = None


class ProjectDetailSave(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    module: Optional[str] = None
    status: Optional[str] = None
    riskScore: Optional[int] = None
    summary: Optional[Dict[str, Any]] = None
