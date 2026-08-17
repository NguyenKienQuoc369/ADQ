import uuid
from typing import Dict, Any, List, Optional
from fastapi import HTTPException, status
from backend.schemas.project import ProjectCreate, ProjectDetailSave

PROJECTS_STORAGE: Dict[str, Dict[str, Any]] = {}


class ProjectService:
    @staticmethod
    def get_projects() -> List[Dict[str, Any]]:
        return list(PROJECTS_STORAGE.values())

    @staticmethod
    def get_project_by_id(project_id: str) -> Dict[str, Any]:
        if project_id not in PROJECTS_STORAGE:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project with ID '{project_id}' not found",
            )
        return PROJECTS_STORAGE[project_id]

    @staticmethod
    def create_project(input_data: ProjectCreate) -> Dict[str, Any]:
        domain = input_data.domain or input_data.name
        if not domain or not domain.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Project domain or name is required",
            )

        project_id = f"prj_{uuid.uuid4().hex[:8]}"
        project = {
            "id": project_id,
            "name": input_data.name or domain,
            "domain": domain,
            "description": input_data.description or "",
            "module": input_data.module or "standard",
            "createdAt": "2026-08-17T00:00:00Z",
        }
        PROJECTS_STORAGE[project_id] = project
        return project

    @staticmethod
    def delete_project(project_id: str) -> bool:
        if project_id not in PROJECTS_STORAGE:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project with ID '{project_id}' not found",
            )
        del PROJECTS_STORAGE[project_id]
        return True

    @staticmethod
    def save_project_detail(project_id: str, payload: ProjectDetailSave) -> Dict[str, Any]:
        if project_id not in PROJECTS_STORAGE:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project with ID '{project_id}' not found",
            )

        project = PROJECTS_STORAGE[project_id]
        project["detail"] = payload.model_dump(exclude_unset=True)
        return project["detail"]
