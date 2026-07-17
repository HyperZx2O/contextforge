"""SQLAlchemy ORM models — works with both PostgreSQL+pgvector and SQLite fallback."""

import os
import uuid
from datetime import datetime

from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase

_db_url = os.environ.get("DATABASE_URL", "")
_USE_PG = _db_url.startswith("postgresql")

if _USE_PG:
    from pgvector.sqlalchemy import Vector
    from sqlalchemy.dialects.postgresql import JSONB, UUID
else:
    Vector = None
    JSONB = None
    UUID = None


def _jsonb():
    return JSONB if _USE_PG else Text

def _uuid_type():
    return UUID(as_uuid=True) if _USE_PG else String(36)

def _uuid_default():
    return uuid.uuid4() if _USE_PG else str(uuid.uuid4())

def _vector(dim):
    return Vector(dim) if _USE_PG else Text


class Base(DeclarativeBase):
    pass


class PapersCache(Base):
    __tablename__ = "papers_cache"

    id = Column(_uuid_type(), primary_key=True, default=_uuid_default)
    arxiv_id = Column(Text, unique=True, nullable=True)
    doi = Column(Text, nullable=True)
    title = Column(Text, nullable=False)
    abstract = Column(Text, nullable=True)
    authors = Column(_jsonb(), nullable=True)
    publish_date = Column(Date, nullable=True)
    citation_count = Column(Integer, default=0)
    source = Column(Text, nullable=False)
    url = Column(Text, nullable=True)
    raw_response = Column(_jsonb(), nullable=True)
    fetched_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (Index("idx_papers_cache_arxiv_id", "arxiv_id"),)


class EntitiesCache(Base):
    __tablename__ = "entities_cache"

    id = Column(_uuid_type(), primary_key=True, default=_uuid_default)
    paper_id = Column(_uuid_type(), ForeignKey("papers_cache.id"), nullable=True)
    entity_type = Column(Text, nullable=False)
    name = Column(Text, nullable=False)
    properties = Column(_jsonb(), nullable=True)
    embedding = Column(_vector(768), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class SynthesisCache(Base):
    __tablename__ = "synthesis_cache"

    id = Column(_uuid_type(), primary_key=True, default=_uuid_default)
    paper_a_id = Column(_uuid_type(), ForeignKey("papers_cache.id"), nullable=True)
    paper_b_id = Column(_uuid_type(), ForeignKey("papers_cache.id"), nullable=True)
    cache_key = Column(Text, unique=True, nullable=False)
    llm_response = Column(_jsonb(), nullable=True)
    confidence = Column(Float, nullable=True)
    relationship_type = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("paper_a_id", "paper_b_id"),
        Index("idx_synthesis_cache_key", "cache_key"),
    )


class PipelineJobs(Base):
    __tablename__ = "pipeline_jobs"

    id = Column(_uuid_type(), primary_key=True, default=_uuid_default)
    query = Column(Text, nullable=False)
    status = Column(Text, nullable=False, default="pending")
    progress = Column(Integer, default=0)
    papers_found = Column(Integer, default=0)
    papers_processed = Column(Integer, default=0)
    relationships_created = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    __table_args__ = (Index("idx_pipeline_jobs_status", "status"),)


# Backward-compat alias
PipelineJob = PipelineJobs
