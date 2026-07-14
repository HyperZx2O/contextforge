import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import dependencies
from db.models import Base
from dependencies import get_db, get_neo4j
from main import app

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"
_engine = create_async_engine(TEST_DB_URL)
_TestSession = async_sessionmaker(_engine, expire_on_commit=False)


async def _override_get_db():
    async with _TestSession() as session:
        try:
            yield session
        finally:
            await session.close()


app.dependency_overrides[get_db] = _override_get_db


@pytest_asyncio.fixture(autouse=True)
async def _setup_db():
    from dependencies import limiter
    limiter._storage.storage.clear()
    orig = dependencies._session_factory
    dependencies._session_factory = _TestSession
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    dependencies._session_factory = orig


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
