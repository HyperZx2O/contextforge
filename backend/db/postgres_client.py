"""PostgreSQL session factory — delegates to the shared engine in dependencies."""

from sqlalchemy.ext.asyncio import AsyncSession


async def get_db():
    """FastAPI dependency — yields an async SQLAlchemy session from the shared engine."""
    from dependencies import _session_factory
    async with _session_factory() as session:
        yield session


def _get_session_maker():
    """Return the shared session factory (used by agents for bulk operations)."""
    from dependencies import _session_factory
    return _session_factory
