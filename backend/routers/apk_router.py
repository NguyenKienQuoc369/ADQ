import os
import uuid
import tempfile
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status

from backend.core.auth import get_current_user
from backend.routers.scan_router import get_effective_user_tier
from backend.services.apk_service import apk_service
from backend.services.project_service import ProjectService

router = APIRouter(prefix="/api/apk-audit", tags=["APK Audit"])

MAX_UPLOAD_SIZE = 100 * 1024 * 1024  # 100 MB Hard Limit
CHUNK_SIZE = 64 * 1024               # 64 KB Stream Chunk


@router.post("/jobs", status_code=status.HTTP_202_ACCEPTED)
async def create_apk_job(
    file: UploadFile = File(...),
    project_id: Optional[str] = Form(None),
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Submits an Android APK for asynchronous decompilation & security auditing.
    Requires an active PRO_MAX package tier.
    """
    # 1. Authoritative Server-Side Tier Gate
    effective_tier = get_effective_user_tier(user)
    if effective_tier != "PRO_MAX":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="TIER_LOCKED: APK Audit is exclusively available for active PRO_MAX accounts.",
        )

    user_id = str(user.get("id") or user.get("sub") or "anonymous_user")
    user_email = user.get("email")

    # 2. Project Existence & Ownership Verification
    if project_id:
        try:
            ProjectService.get_project_by_id(project_id)
        except HTTPException:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project with ID '{project_id}' not found.",
            )

    # 3. Filename & Extension Verification
    filename = file.filename or "unknown.apk"
    if not filename.lower().endswith(".apk"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="INVALID_FILE_TYPE: Only Android APK (.apk) files are accepted.",
        )

    # 4. Stream upload into isolated server temp file with strict size enforcement
    temp_dir = tempfile.gettempdir()
    unique_name = f"adq_upload_{uuid.uuid4().hex[:12]}.apk"
    temp_file_path = os.path.join(temp_dir, unique_name)

    bytes_written = 0
    try:
        with open(temp_file_path, "wb") as f_dst:
            while True:
                chunk = await file.read(CHUNK_SIZE)
                if not chunk:
                    break
                bytes_written += len(chunk)
                if bytes_written > MAX_UPLOAD_SIZE:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"FILE_TOO_LARGE: Uploaded APK exceeds the 100 MB limit ({bytes_written} bytes).",
                    )
                f_dst.write(chunk)

        if bytes_written == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="EMPTY_FILE: Uploaded APK file is empty (0 bytes).",
            )

        # 5. Quick Header Magic Bytes Verification
        with open(temp_file_path, "rb") as f_check:
            header = f_check.read(4)
            if header not in (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="MALFORMED_ARCHIVE: Uploaded file is not a valid ZIP/APK archive.",
                )

        # 6. Dispatch into Async Job Service
        job_status = apk_service.create_job(
            user_id=user_id,
            user_email=user_email,
            temp_apk_path=temp_file_path,
            original_filename=filename,
            project_id=project_id,
        )

        return {
            "ok": True,
            "job_id": job_status["job_id"],
            "status": job_status["status"],
            "stage": job_status["stage"],
            "progress": job_status["progress"],
            "created_at": job_status["created_at"],
            "message": "APK audit job queued successfully",
        }

    except HTTPException:
        if os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception:
                pass
        raise
    except ValueError as val_err:
        if os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception:
                pass
        err_str = str(val_err)
        if "USER_CONCURRENCY_LIMIT" in err_str:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=err_str,
            )
        elif "QUEUE_FULL" in err_str:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=err_str,
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err_str,
        )
    except (ConnectionError, RuntimeError) as conn_err:
        if os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception:
                pass
        err_str = str(conn_err)
        if "REDIS_UNAVAILABLE" in err_str:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="SERVICE_UNAVAILABLE: Redis backend is unreachable. APK auditing is temporarily unavailable.",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"INTERNAL_ERROR: Failed to process APK upload: {conn_err}",
        )
    except Exception as exc:
        if os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception:
                pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"INTERNAL_ERROR: Failed to process APK upload: {exc}",
        )


@router.get("/jobs/{job_id}")
def get_apk_job_status(
    job_id: str,
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Retrieves the execution status and progress of an APK audit job.
    Enforces strict user ownership.
    """
    user_id = str(user.get("id") or user.get("sub") or "anonymous_user")
    job = apk_service.get_job(job_id)

    if not job or job.get("user_id") != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"APK audit job '{job_id}' not found.",
        )

    return {
        "ok": True,
        "job_id": job["job_id"],
        "status": job["status"],
        "stage": job["stage"],
        "progress": job["progress"],
        "created_at": job["created_at"],
        "started_at": job.get("started_at"),
        "completed_at": job.get("completed_at"),
        "error": job.get("error"),
        "partial": job.get("partial", False),
    }


@router.get("/jobs/{job_id}/result")
def get_apk_job_result(
    job_id: str,
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Retrieves the complete findings and metadata of a finished APK audit.
    Enforces strict user ownership.
    """
    user_id = str(user.get("id") or user.get("sub") or "anonymous_user")
    job = apk_service.get_job(job_id)

    if not job or job.get("user_id") != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"APK audit job '{job_id}' not found.",
        )

    if job["status"] not in {"COMPLETED", "PARTIAL"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Job is not completed yet (current status: {job['status']}).",
        )

    return {
        "ok": True,
        "job_id": job["job_id"],
        "status": job["status"],
        "result": job.get("result"),
    }


@router.delete("/jobs/{job_id}")
def cancel_apk_job(
    job_id: str,
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Cancels an active or queued APK audit job and reclaims sandbox resources.
    Enforces strict user ownership.
    """
    user_id = str(user.get("id") or user.get("sub") or "anonymous_user")
    job = apk_service.get_job(job_id)

    if not job or job.get("user_id") != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"APK audit job '{job_id}' not found.",
        )

    apk_service.cancel_job(job_id)

    return {
        "ok": True,
        "job_id": job_id,
        "status": "CANCELLED",
        "message": "APK audit job cancelled successfully.",
    }

