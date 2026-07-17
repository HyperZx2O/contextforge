"""Shared FastAPI dependencies — delegates to db/ modules for single-source-of-truth."""

from collections.abc import AsyncGenerator

from neo4j import AsyncDriver, AsyncGraphDatabase, AsyncSession as Neo4jSession
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from config import settings
from db.models import Base

_db_url = settings.DATABASE_URL
if _db_url.startswith("postgresql://") and "+" not in _db_url.split("://")[0]:
    _db_url = _db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
_engine = create_async_engine(_db_url)
_session_factory = async_sessionmaker(_engine, expire_on_commit=False)

limiter = Limiter(key_func=get_remote_address)


async def create_tables():
    async with _engine.begin() as conn:
        if _db_url.startswith("postgresql"):
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with _session_factory() as session:
        yield session


# ── Neo4j (single driver shared across app + agents) ────────────────────────

_neo4j_driver: AsyncDriver | None = None


def get_neo4j_driver() -> AsyncDriver:
    global _neo4j_driver
    if _neo4j_driver is None:
        _neo4j_driver = AsyncGraphDatabase.driver(
            settings.NEO4J_URI, auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD)
        )
    return _neo4j_driver


async def get_neo4j() -> AsyncGenerator[Neo4jSession, None]:
    driver = get_neo4j_driver()
    session = driver.session()
    try:
        yield session
    finally:
        await session.close()
