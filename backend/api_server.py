import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.core.config import settings
from backend.routers.scan_router import router as scan_router
from backend.routers.project_router import router as project_router
from backend.routers.admin_router import router as admin_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://adq.io.vn",
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
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scan_router)
app.include_router(project_router)
app.include_router(admin_router)


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": "1.0.0",
    }


if __name__ == "__main__":
    uvicorn.run("backend.api_server:app", host="0.0.0.0", port=settings.PORT, reload=True)


# Clean Architecture API Server Architecture Complete

