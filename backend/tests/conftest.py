# Always use a temp SQLite file for test isolation, even if DATABASE_URL is set
import os
import sys
import tempfile
import atexit

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# ── Force SQLite model types ──────────────────────────────────────────────
# Create temp file and set DATABASE_URL to SQLite BEFORE importing models,
# so _USE_PG=False and models use SQLite-compatible column types (JSON, Text, String).
_fd, _TEST_DB_PATH = tempfile.mkstemp(suffix=".db")
os.close(_fd)
atexit.register(lambda p=_TEST_DB_PATH: os.unlink(p) if os.path.exists(p) else None)
TEST_DB_URL = f"sqlite+aiosqlite:///{_TEST_DB_PATH}"

_saved_db_url = os.environ.get("DATABASE_URL")
os.environ["DATABASE_URL"] = TEST_DB_URL

import dependencies
from db.models import Base
from dependencies import get_db, get_neo4j
from main import app

# Restore original so app code can check it if needed
if _saved_db_url:
    os.environ["DATABASE_URL"] = _saved_db_url

# ── Test engine ───────────────────────────────────────────────────────────
_engine = create_async_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
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
    # Create tables once (checkfirst avoids 'table exists' errors if fixture
    # cleanup was interrupted by a prior test failure)
    async with _engine.begin() as conn:
        await conn.run_sync(lambda sc: Base.metadata.create_all(sc, checkfirst=True))
    yield
    # Clean rows between tests — avoids DDL issues with file-based SQLite
    async with _engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            await conn.execute(table.delete())
    dependencies._session_factory = orig


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
