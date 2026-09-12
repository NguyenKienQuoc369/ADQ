import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.core.config import settings
from backend.routers.scan_router import router as scan_router
from backend.routers.project_router import router as project_router
from backend.routers.admin_router import router as admin_router
from backend.routers.maintenance_router import router as maintenance_router
from backend.routers.apk_router import router as apk_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url="/api/redoc",
)

app.include_router(maintenance_router)

allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://adq.io.vn",
    "https://www.adq.io.vn",
]
if settings.FRONTEND_URL:
    allowed_origins.append(settings.FRONTEND_URL)
if hasattr(settings, "CORS_ORIGINS") and settings.CORS_ORIGINS:
    for origin in settings.CORS_ORIGINS.split(","):
        cleaned = origin.strip()
        if cleaned and cleaned not in allowed_origins:
            allowed_origins.append(cleaned)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*(adq\.io\.vn|vercel\.app)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scan_router)
app.include_router(project_router)
app.include_router(admin_router)
app.include_router(apk_router)


@app.get("/health", tags=["Health"])
@app.get("/api/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": "1.0.0",
    }


import threading
import logging

logger = logging.getLogger(__name__)
_apk_worker_instance = None

@app.on_event("startup")
def startup_event():
    global _apk_worker_instance
    try:
        from backend.workers.apk_worker import APKWorker
        _apk_worker_instance = APKWorker(worker_id="embedded_apk_worker_1")
        t = threading.Thread(target=_apk_worker_instance.start, daemon=True, name="APKWorkerDaemon")
        t.start()
        logger.info("Embedded APKWorker daemon started successfully.")
    except Exception as e:
        logger.error(f"Failed to start embedded APKWorker daemon: {e}")

@app.on_event("shutdown")
def shutdown_event():
    global _apk_worker_instance
    if _apk_worker_instance:
        try:
            _apk_worker_instance.stop()
            logger.info("Embedded APKWorker daemon stopped.")
        except Exception:
            pass

if __name__ == "__main__":
    uvicorn.run("backend.api_server:app", host="0.0.0.0", port=settings.PORT, reload=True)


# Clean Architecture API Server Architecture Complete

