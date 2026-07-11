from collections.abc import AsyncGenerator

from neo4j import AsyncDriver, AsyncGraphDatabase
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from api.models import Base
from config import settings

_engine = create_async_engine(settings.DATABASE_URL)
_session_factory = async_sessionmaker(_engine, expire_on_commit=False)

limiter = Limiter(key_func=get_remote_address)


async def create_tables():
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


_neo4j_driver: AsyncDriver | None = None


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with _session_factory() as session:
        yield session


def get_neo4j_driver() -> AsyncDriver:
    global _neo4j_driver
    if _neo4j_driver is None:
        _neo4j_driver = AsyncGraphDatabase.driver(
            settings.NEO4J_URI, auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD)
        )
    return _neo4j_driver


async def get_neo4j() -> AsyncGenerator:
    driver = get_neo4j_driver()
    session = driver.session()
    try:
        yield session
    finally:
        await session.close()
