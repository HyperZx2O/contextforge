"""Lazy-initialized async SQLAlchemy engine and session factory for PostgreSQL."""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

_engine = None
_session_maker = None


def _get_engine():
    global _engine
    if _engine is None:
        from config import settings
        _engine = create_async_engine(settings.DATABASE_URL, echo=False)
    return _engine


def _get_session_maker():
    global _session_maker
    if _session_maker is None:
        _session_maker = async_sessionmaker(_get_engine(), class_=AsyncSession, expire_on_commit=False)
    return _session_maker


async def get_db():
    """FastAPI dependency — yields an async SQLAlchemy session.

    Yields:
        AsyncSession: Open database session. Auto-closed on exit.
    """
    async with _get_session_maker()() as session:
        yield session
