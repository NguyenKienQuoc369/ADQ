from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime

Base = declarative_base()

class Target(Base):
    __tablename__ = "targets"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    runs = relationship("ToolRun", back_populates="target")

class ToolRun(Base):
    __tablename__ = "tool_runs"
    id = Column(Integer, primary_key=True, index=True)
    tool = Column(String(100), nullable=False, index=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime)
    target_id = Column(Integer, ForeignKey("targets.id"), nullable=False, index=True)
    meta = Column(Text, nullable=True)
    findings = relationship("Finding", back_populates="run")
    target = relationship("Target", back_populates="runs")

class Finding(Base):
    __tablename__ = "findings"
    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("tool_runs.id"), nullable=False, index=True)
    item = Column(String(200), nullable=False, index=True)
    item_type = Column(String(50), nullable=True)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    run = relationship("ToolRun", back_populates="findings")

    __table_args__ = (
        UniqueConstraint('run_id', 'item', name='uix_run_item'),
    )

class Subdomain(Base):
    __tablename__ = "subdomains"
    id = Column(Integer, primary_key=True, index=True)
    target_id = Column(Integer, ForeignKey("targets.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    source = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('target_id', 'name', name='uix_target_subdomain'),
    )
