import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.environ.get("DATABASE_URL", "")

# Fallback to a local sqlite DB if DATABASE_URL is not set (safe local dev)
if not DATABASE_URL:
    DATABASE_URL = f"sqlite:///./quoc_omni.db"
    _connect_args = {"check_same_thread": False}
else:
    _connect_args = {}

engine = create_engine(DATABASE_URL, connect_args=_connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db(Base):
    """Create all tables. Pass SQLAlchemy declarative Base from `models`."""
    Base.metadata.create_all(bind=engine)

def get_session():
    return SessionLocal()
