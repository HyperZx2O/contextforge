"""SQLAlchemy ORM models for PostgreSQL: PapersCache, EntitiesCache, SynthesisCache, PipelineJobs."""

import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class PapersCache(Base):
    __tablename__ = "papers_cache"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    arxiv_id = Column(Text, unique=True, nullable=True)
    doi = Column(Text, nullable=True)
    title = Column(Text, nullable=False)
    abstract = Column(Text, nullable=True)
    authors = Column(JSONB, nullable=True)
    publish_date = Column(Date, nullable=True)
    citation_count = Column(Integer, default=0)
    source = Column(Text, nullable=False)
    url = Column(Text, nullable=True)
    raw_response = Column(JSONB, nullable=True)
    fetched_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (Index("idx_papers_cache_arxiv_id", "arxiv_id"),)


class EntitiesCache(Base):
    __tablename__ = "entities_cache"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    paper_id = Column(UUID(as_uuid=True), ForeignKey("papers_cache.id"), nullable=True)
    entity_type = Column(Text, nullable=False)
    name = Column(Text, nullable=False)
    properties = Column(JSONB, nullable=True)
    embedding = Column(Vector(768), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class SynthesisCache(Base):
    __tablename__ = "synthesis_cache"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    paper_a_id = Column(UUID(as_uuid=True), ForeignKey("papers_cache.id"), nullable=True)
    paper_b_id = Column(UUID(as_uuid=True), ForeignKey("papers_cache.id"), nullable=True)
    cache_key = Column(Text, unique=True, nullable=False)
    llm_response = Column(JSONB, nullable=True)
    confidence = Column(Float, nullable=True)
    relationship_type = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("paper_a_id", "paper_b_id"),
        Index("idx_synthesis_cache_key", "cache_key"),
    )


class PipelineJobs(Base):
    __tablename__ = "pipeline_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
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
