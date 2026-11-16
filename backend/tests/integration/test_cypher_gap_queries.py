import sys

import pytest
import pytest_asyncio


def _neo4j_available():
    """Check if Neo4j is actually usable — both port-open AND driver works."""
    # Windows + Python 3.14+ has known ProactorEventLoop incompatibility
    # with Neo4j's async driver ('NoneType' has no attribute 'send').
    # Skip these tests on that platform; they work on Linux / Python <3.14.
    if sys.platform == "win32" and sys.version_info >= (3, 14):
        return False
    # Quick port check first
    import socket
    try:
        s = socket.create_connection(("localhost", 7687), timeout=2)
        s.close()
    except (ConnectionRefusedError, OSError):
        return False
    # Try an actual driver connection to verify the driver works end-to-end
    try:
        import asyncio
        from neo4j import AsyncGraphDatabase
        from config import settings
        async def _probe():
            d = AsyncGraphDatabase.driver(
                settings.NEO4J_URI,
                auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
            )
            try:
                async with d.session() as s:
                    await s.run("RETURN 1")
            finally:
                await d.close()
            return True
        return asyncio.run(_probe())
    except Exception:
        return False


pytestmark = pytest.mark.skipif(
    not _neo4j_available(),
    reason="Neo4j unreachable or driver incompatible (known issue on Windows Python 3.14+)",
)


@pytest_asyncio.fixture(autouse=True)
async def _setup_teardown():
    import logging as _log
    from db.neo4j_client import initialize_schema, execute_query
    # Don't close the driver at the start — reuse the existing one for DETACH DELETE
    try:
        await initialize_schema()
        await execute_query("MATCH (n) DETACH DELETE n")
    except Exception as _exc:
        _log.getLogger(__name__).warning("Neo4j pre-test cleanup failed: %s", _exc)
    yield
    try:
        await execute_query("MATCH (n) DETACH DELETE n")
    except Exception as _exc:
        _log.getLogger(__name__).warning("Neo4j post-test cleanup failed: %s", _exc)
    try:
        from db.neo4j_client import close_neo4j_driver
        await close_neo4j_driver()
    except Exception as _exc:
        _log.getLogger(__name__).warning("Neo4j driver close failed: %s", _exc)


@pytest.mark.asyncio
async def test_find_unresolved_contradictions():
    from db.neo4j_client import execute_query
    from agents.gap_finder import find_unresolved_contradictions

    # Use MERGE to avoid ConstraintError if prior data wasn't fully cleaned up
    await execute_query(
        "MERGE (a:Paper {arxiv_id: '2401.00001'}) SET a.title = 'Paper A', a.publish_date = date('2024-01-01')"
    )
    await execute_query(
        "MERGE (b:Paper {arxiv_id: '2401.00002'}) SET b.title = 'Paper B', b.publish_date = date('2024-01-02')"
    )
    await execute_query(
        "MATCH (a:Paper {arxiv_id: '2401.00001'}), (b:Paper {arxiv_id: '2401.00002'}) "
        "MERGE (a)-[:CONTRADICTS {on_dimension: 'accuracy', evidence_quote: 'contradicts', confidence: 0.9}]->(b)"
    )

    results = await find_unresolved_contradictions()
    assert len(results) >= 1
    arxiv_ids: set[str] = set()
    for r in results:
        if r.get("paper_a"):
            arxiv_ids.add(r["paper_a"])
        if r.get("paper_b"):
            arxiv_ids.add(r["paper_b"])
    assert "2401.00001" in arxiv_ids
    assert "2401.00002" in arxiv_ids


@pytest.mark.asyncio
async def test_find_low_density_gaps():
    from db.neo4j_client import execute_query
    from agents.gap_finder import find_low_density_gaps

    # Use MERGE to avoid ConstraintError if prior data wasn't fully cleaned up
    await execute_query(
        "MERGE (a:Paper {arxiv_id: '2401.00010'}) SET a.title = 'Isolated Paper', a.publish_date = date('2024-01-01')"
    )
    for i in range(5):
        await execute_query(
            f"MERGE (p:Paper {{arxiv_id: '2401.000{i+1}'}}) SET p.title = 'Connected Paper {i}', p.publish_date = date('2024-01-01')"
        )
    for i in range(5):
        await execute_query(
            f"MATCH (a:Paper {{arxiv_id: '2401.0001'}}), (b:Paper {{arxiv_id: '2401.000{i+2}'}}) MERGE (a)-[:CITES]->(b)"
        )

    results = await find_low_density_gaps()
    assert any(r.get("arxiv_id") == "2401.00010" for r in results)


@pytest.mark.asyncio
async def test_find_stale_claims():
    from db.neo4j_client import execute_query
    from agents.gap_finder import find_stale_claims

    await execute_query(
        "MERGE (p:Paper {arxiv_id: '2010.00001'}) SET p.title = 'Old Paper', p.publish_date = date('2010-01-01')"
    )

    results = await find_stale_claims()
    assert any(r.get("arxiv_id") == "2010.00001" for r in results)
