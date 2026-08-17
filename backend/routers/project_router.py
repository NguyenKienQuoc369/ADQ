from fastapi import APIRouter, Depends, status
from typing import Dict, Any, List
from backend.schemas.project import ProjectCreate, ProjectDetailSave
from backend.services.project_service import ProjectService
from backend.core.auth import get_current_user

router = APIRouter(prefix="/api/projects", tags=["Projects"])


@router.get("")
def list_projects(user: Dict[str, Any] = Depends(get_current_user)):
    projects = ProjectService.get_projects()
    return {"ok": True, "projects": projects}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_project(input_data: ProjectCreate, user: Dict[str, Any] = Depends(get_current_user)):
    project = ProjectService.create_project(input_data)
    return {"ok": True, "project": project}


@router.get("/{project_id}")
def get_project(project_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    project = ProjectService.get_project_by_id(project_id)
    return {"ok": True, "project": project}


@router.delete("/{project_id}")
def delete_project(project_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    deleted = ProjectService.delete_project(project_id)
    return {"ok": True, "deleted": deleted}


@router.post("/{project_id}/details")
def save_project_detail(project_id: str, payload: ProjectDetailSave, user: Dict[str, Any] = Depends(get_current_user)):
    detail = ProjectService.save_project_detail(project_id, payload)
    return {"ok": True, "detail": detail}
