import json
import os
import time
from typing import Any, Dict, Optional

import redis
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

try:
    from backend.core.auth import get_current_user
    from backend.core.config import settings
except ImportError:
    from core.auth import get_current_user
    from core.config import settings

router = APIRouter(prefix="/api", tags=["Projects & Sessions"])

REDIS_URL = getattr(settings, "REDIS_URL", None) or os.getenv(
    "REDIS_URL", "redis://adq_redis:6379/0"
)

try:
    redis_client = redis.Redis.from_url(
        REDIS_URL,
        decode_responses=True,
        socket_connect_timeout=2,
        socket_timeout=2,
    )
    redis_client.ping()
except Exception as exc:
    print(f"[Projects] Redis unavailable, using in-memory fallback: {exc}")
    redis_client = None

PROJECTS_STORAGE: Dict[str, Dict[str, Any]] = {}


class CreateProjectRequest(BaseModel):
    name: str
    domain: Optional[str] = None
    description: Optional[str] = ""
    password: Optional[str] = ""
    module: Optional[str] = "scan"


class SaveProjectDetailRequest(BaseModel):
    title: Optional[str] = ""
    description: Optional[str] = ""
    module: Optional[str] = "scan"
    status: Optional[str] = "ACTIVE"
    riskScore: Optional[int] = 0
    summary: Dict[str, Any] = Field(default_factory=dict)
    findings: Dict[str, Any] = Field(default_factory=dict)
    lastScanAt: Optional[str] = None


def _user_id(user: Dict[str, Any]) -> str:
    value = user.get("id") or user.get("user_id") or user.get("sub") or user.get("email")
    if value is None:
        raise HTTPException(status_code=401, detail="Invalid authenticated user")
    return str(value)


def _project_key(project_id: str) -> str:
    return f"project:{project_id}"


def _user_project_key(user_id: str, project_id: str) -> str:
    return f"user_project:{user_id}:{project_id}"


def _load_project(project_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    proj = None

    if redis_client:
        try:
            raw = redis_client.get(_project_key(project_id))
            if raw:
                candidate = json.loads(raw)
                if str(candidate.get("userId")) == user_id:
                    proj = candidate
        except Exception as exc:
            print(f"[Projects] Redis get error: {exc}")

    if proj is None:
        candidate = PROJECTS_STORAGE.get(_user_project_key(user_id, project_id))
        if candidate and str(candidate.get("userId")) == user_id:
            proj = candidate

    return proj


def _save_project(project: Dict[str, Any]) -> None:
    project_id = str(project["id"])
    user_id = str(project["userId"])

    PROJECTS_STORAGE[_user_project_key(user_id, project_id)] = project

    if redis_client:
        try:
            redis_client.set(
                _project_key(project_id),
                json.dumps(project, ensure_ascii=False),
            )
        except Exception as exc:
            print(f"[Projects] Redis save error: {exc}")


@router.get("/projects")
def list_projects(user: Dict[str, Any] = Depends(get_current_user)):
    user_id = _user_id(user)
    projects = []

    if redis_client:
        try:
            keys = redis_client.scan_iter("project:*")
            for key in keys:
                raw = redis_client.get(key)
                if not raw:
                    continue
                try:
                    project = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                if str(project.get("userId")) == user_id:
                    projects.append(project)
        except Exception as exc:
            print(f"[Projects] Redis list error: {exc}")

    if not projects:
        projects = [
            project
            for project in PROJECTS_STORAGE.values()
            if str(project.get("userId")) == user_id
        ]

    return {"ok": True, "projects": projects}


@router.post("/projects", status_code=status.HTTP_201_CREATED)
def create_project(
    req: CreateProjectRequest,
    user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = _user_id(user)
    name = req.name.strip()

    if not name:
        raise HTTPException(status_code=422, detail="Project name is required")

    proj_id = f"prj_{int(time.time())}_{os.urandom(3).hex()}"
    module = (req.module or "scan").strip()
    domain = (req.domain or "").strip()
    description = (req.description or "").strip()

    new_proj = {
        "id": proj_id,
        "userId": user_id,
        "name": name,
        "domain": domain,
        "description": description,
        "module": module,
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "projectDetail": {
            "title": domain or name,
            "description": description,
            "module": module,
            "status": "PENDING",
            "riskScore": 0,
            "summary": {
                "subdomains": 0,
                "liveHosts": 0,
                "crawledUrls": 0,
                "openPorts": 0,
                "critical": 0,
                "high": 0,
                "medium": 0,
                "totalVulns": 0,
            },
            "findings": {
                "vulnerabilities": [],
                "actionAdvice": [],
                "rawActionAdvice": "",
                "chatHistory": [],
            },
            "lastScanAt": None,
        },
    }

    _save_project(new_proj)
    return {"ok": True, "project": new_proj}


@router.get("/projects/{project_id}")
def get_project(
    project_id: str,
    user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = _user_id(user)
    proj = _load_project(project_id, user_id)

    if not proj:
        raise HTTPException(
            status_code=404,
            detail=f"Project with ID '{project_id}' not found",
        )

    return {"ok": True, "project": proj}


@router.post("/projects/{project_id}/details")
def save_project_details(
    project_id: str,
    req: SaveProjectDetailRequest,
    user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = _user_id(user)
    proj = _load_project(project_id, user_id)

    if not proj:
        raise HTTPException(
            status_code=404,
            detail=f"Project with ID '{project_id}' not found",
        )

    current_detail = proj.get("projectDetail") or {}

    proj["projectDetail"] = {
        "title": req.title or current_detail.get("title") or proj.get("domain") or proj.get("name", "Scan Session"),
        "description": req.description or current_detail.get("description") or proj.get("description", ""),
        "module": req.module or current_detail.get("module") or proj.get("module", "scan"),
        "status": req.status or current_detail.get("status") or "ACTIVE",
        "riskScore": int(req.riskScore or 0),
        "summary": req.summary,
        "findings": req.findings,
        "lastScanAt": req.lastScanAt or current_detail.get("lastScanAt") or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    proj["module"] = proj["projectDetail"]["module"]

    if req.title and not proj.get("domain"):
        proj["domain"] = req.title

    _save_project(proj)
    return {"ok": True, "detail": proj["projectDetail"]}


@router.delete("/projects/{project_id}")
def delete_project(
    project_id: str,
    user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = _user_id(user)
    proj = _load_project(project_id, user_id)

    if not proj:
        raise HTTPException(
            status_code=404,
            detail=f"Project with ID '{project_id}' not found",
        )

    PROJECTS_STORAGE.pop(_user_project_key(user_id, project_id), None)

    if redis_client:
        try:
            redis_client.delete(_project_key(project_id))
        except Exception as exc:
            print(f"[Projects] Redis delete error: {exc}")

    return {"ok": True, "deleted": True}
