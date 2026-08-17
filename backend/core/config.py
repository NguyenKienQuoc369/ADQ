import os
from dataclasses import dataclass

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


@dataclass
class Settings:
    PROJECT_NAME: str = os.getenv("PROJECT_NAME", "ADQ Security Platform API")
    PORT: int = int(os.getenv("PORT", "8000"))
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./quoc_omni.db")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    SUPABASE_JWT_SECRET: str = os.getenv("SUPABASE_JWT_SECRET", "")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "https://adq.io.vn")
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "https://adq.io.vn,http://localhost:3000")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")


settings = Settings()
