import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class PipelineJob(Base):
    __tablename__ = "pipeline_jobs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    query = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    progress = Column(Integer, default=0)
    papers_found = Column(Integer, default=0)
    papers_processed = Column(Integer, default=0)
    relationships_created = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime(timezone=True), nullable=True)
