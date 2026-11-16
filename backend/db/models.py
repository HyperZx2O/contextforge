"""SQLAlchemy ORM models — PostgreSQL+pgvector with SQLite fallback for tests."""

import os
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase

_db_url = os.environ.get("DATABASE_URL", "")
_USE_PG = _db_url.startswith("postgresql")

if _USE_PG:
    from pgvector.sqlalchemy import Vector
    from sqlalchemy.dialects.postgresql import JSONB, UUID

    _UUID_TYPE = UUID(as_uuid=True)
    _JSON_TYPE = JSONB
    _VECTOR_TYPE = Vector(384)
    _UUID_DEFAULT = uuid.uuid4
else:
    from sqlalchemy import JSON, String

    _UUID_TYPE = String(36)
    _JSON_TYPE = JSON
    _VECTOR_TYPE = Text
    _UUID_DEFAULT = lambda: str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


class PapersCache(Base):
    __tablename__ = "papers_cache"

    id = Column(_UUID_TYPE, primary_key=True, default=_UUID_DEFAULT)
    arxiv_id = Column(Text, unique=True, nullable=True)
    doi = Column(Text, nullable=True)
    title = Column(Text, nullable=False)
    abstract = Column(Text, nullable=True)
    authors = Column(_JSON_TYPE, nullable=True)
    publish_date = Column(Date, nullable=True)
    citation_count = Column(Integer, default=0)
    source = Column(Text, nullable=False)
    url = Column(Text, nullable=True)
    raw_response = Column(_JSON_TYPE, nullable=True)
    fetched_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (Index("idx_papers_cache_arxiv_id", "arxiv_id"),)


class EntitiesCache(Base):
    __tablename__ = "entities_cache"

    id = Column(_UUID_TYPE, primary_key=True, default=_UUID_DEFAULT)
    paper_id = Column(_UUID_TYPE, ForeignKey("papers_cache.id"), nullable=True)
    entity_type = Column(Text, nullable=False)
    name = Column(Text, nullable=False)
    properties = Column(_JSON_TYPE, nullable=True)
    embedding = Column(_VECTOR_TYPE, nullable=True)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class SynthesisCache(Base):
    __tablename__ = "synthesis_cache"

    id = Column(_UUID_TYPE, primary_key=True, default=_UUID_DEFAULT)
    paper_a_id = Column(_UUID_TYPE, ForeignKey("papers_cache.id"), nullable=True)
    paper_b_id = Column(_UUID_TYPE, ForeignKey("papers_cache.id"), nullable=True)
    cache_key = Column(Text, unique=True, nullable=False)
    llm_response = Column(_JSON_TYPE, nullable=True)
    confidence = Column(Float, nullable=True)
    relationship_type = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        UniqueConstraint("paper_a_id", "paper_b_id"),
        Index("idx_synthesis_cache_key", "cache_key"),
    )


class Users(Base):
    __tablename__ = "users"

    id = Column(_UUID_TYPE, primary_key=True, default=_UUID_DEFAULT)
    email = Column(Text, unique=True, nullable=False)
    password_hash = Column(Text, nullable=False)
    display_name = Column(Text, nullable=True)
    is_active = Column(Integer, default=1)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (Index("idx_users_email", "email"),)


class RefreshTokens(Base):
    __tablename__ = "refresh_tokens"

    id = Column(_UUID_TYPE, primary_key=True, default=_UUID_DEFAULT)
    user_id = Column(
        _UUID_TYPE, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    token_hash = Column(Text, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked = Column(Integer, default=0)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (Index("idx_refresh_tokens_user", "user_id"),)


class PipelineJobs(Base):
    __tablename__ = "pipeline_jobs"

    id = Column(_UUID_TYPE, primary_key=True, default=_UUID_DEFAULT)
    query = Column(Text, nullable=False)
    status = Column(Text, nullable=False, default="pending")
    progress = Column(Integer, default=0)
    papers_found = Column(Integer, default=0)
    papers_processed = Column(Integer, default=0)
    relationships_created = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    user_id = Column(
        _UUID_TYPE, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    started_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    completed_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (Index("idx_pipeline_jobs_status", "status"),)


class SavedRuns(Base):
    __tablename__ = "saved_runs"

    id = Column(_UUID_TYPE, primary_key=True, default=_UUID_DEFAULT)
    user_id = Column(
        _UUID_TYPE, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    job_id = Column(
        _UUID_TYPE, ForeignKey("pipeline_jobs.id", ondelete="SET NULL"), nullable=True
    )
    query = Column(Text, nullable=False)
    label = Column(Text, nullable=True)
    is_public = Column(Integer, default=0)
    node_count = Column(Integer, default=0)
    edge_count = Column(Integer, default=0)
    gap_count = Column(Integer, default=0)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (Index("idx_saved_runs_user", "user_id"),)


class SavedTemplates(Base):
    __tablename__ = "saved_templates"

    id = Column(_UUID_TYPE, primary_key=True, default=_UUID_DEFAULT)
    user_id = Column(_UUID_TYPE, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    query = Column(Text, nullable=False)
    label = Column(Text, nullable=False)
    year_from = Column(Integer, nullable=True)
    year_to = Column(Integer, nullable=True)
    max_papers = Column(Integer, default=30)
    sources = Column(_JSON_TYPE, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (Index("idx_saved_templates_user", "user_id"),)


class UserPreferences(Base):
    __tablename__ = "user_preferences"

    user_id = Column(_UUID_TYPE, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    view_mode = Column(Text, default="graph")
    active_filters = Column(_JSON_TYPE, nullable=True)
    theme = Column(Text, default="dark")
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Bookmarks(Base):
    __tablename__ = "bookmarks"

    id = Column(_UUID_TYPE, primary_key=True, default=_UUID_DEFAULT)
    user_id = Column(_UUID_TYPE, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    node_id = Column(Text, nullable=False)
    edge_source = Column(Text, nullable=True)
    edge_target = Column(Text, nullable=True)
    edge_type = Column(Text, nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (Index("idx_bookmarks_user", "user_id"),)


class Annotations(Base):
    __tablename__ = "annotations"

    id = Column(_UUID_TYPE, primary_key=True, default=_UUID_DEFAULT)
    user_id = Column(_UUID_TYPE, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    node_id = Column(Text, nullable=True)
    edge_source = Column(Text, nullable=True)
    edge_target = Column(Text, nullable=True)
    edge_type = Column(Text, nullable=True)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (Index("idx_annotations_user", "user_id"), Index("idx_annotations_node", "node_id"),)

class GraphVersions(Base):
    __tablename__ = "graph_versions"

    id = Column(_UUID_TYPE, primary_key=True, default=_UUID_DEFAULT)
    run_id = Column(_UUID_TYPE, ForeignKey("saved_runs.id", ondelete="CASCADE"), nullable=False)
    version_name = Column(Text, nullable=False)
    filter_settings = Column(_JSON_TYPE, nullable=True)
    layout_state = Column(_JSON_TYPE, nullable=True)
    node_count = Column(Integer, default=0)
    edge_count = Column(Integer, default=0)
    gap_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (Index("idx_graph_versions_run", "run_id"),)

class ExportLog(Base):
    __tablename__ = "export_log"

    id = Column(_UUID_TYPE, primary_key=True, default=_UUID_DEFAULT)
    user_id = Column(_UUID_TYPE, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    kind = Column(Text, nullable=False)
    target = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (Index("idx_export_log_user", "user_id"),)
