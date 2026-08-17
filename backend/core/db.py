import os
import importlib
from typing import Any, Optional
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from backend.core.config import settings

DATABASE_URL = settings.DATABASE_URL

if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    connect_args = {}

engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


_SUPABASE_CLIENT: Optional[Any] = None


def get_supabase_client() -> Any:
    global _SUPABASE_CLIENT
    if _SUPABASE_CLIENT is not None:
        return _SUPABASE_CLIENT

    sb_url = settings.SUPABASE_URL
    sb_key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY

    if not sb_url or not sb_key:
        return None

    try:
        supabase_module = importlib.import_module("supabase")
        create_client = getattr(supabase_module, "create_client", None)
        if create_client:
            _SUPABASE_CLIENT = create_client(sb_url, sb_key)
            return _SUPABASE_CLIENT
    except Exception:
        pass
    return None
