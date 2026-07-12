import pytest
import socket


def _neo4j_available():
    try:
        s = socket.create_connection(("localhost", 7687), timeout=2)
        s.close()
        return True
    except (ConnectionRefusedError, OSError):
        return False


pytestmark = pytest.mark.skipif(
    not _neo4j_available(),
    reason="Neo4j not available (Docker stack not running)",
)


@pytest.fixture(autouse=True)
async def _setup_teardown():
    from db.neo4j_client import initialize_schema, close_neo4j_driver, execute_query
    await initialize_schema()
    await execute_query("MATCH (n) DETACH DELETE n")
    yield
    await execute_query("MATCH (n) DETACH DELETE n")
    await close_neo4j_driver()


@pytest.mark.asyncio
async def test_find_unresolved_contradictions():
    from db.neo4j_client import execute_query
    from agents.gap_finder import find_unresolved_contradictions

    await execute_query(
        "CREATE (a:Paper {arxiv_id: '2401.00001', title: 'Paper A', publish_date: date('2024-01-01')})"
    )
    await execute_query(
        "CREATE (b:Paper {arxiv_id: '2401.00002', title: 'Paper B', publish_date: date('2024-01-02')})"
    )
    await execute_query(
        "MATCH (a:Paper {arxiv_id: '2401.00001'}), (b:Paper {arxiv_id: '2401.00002'}) "
        "CREATE (a)-[:CONTRADICTS {on_dimension: 'accuracy', evidence_quote: 'contradicts', confidence: 0.9}]->(b)"
    )

    results = await find_unresolved_contradictions()
    assert len(results) >= 1
    arxiv_ids = {r.get("paper_a"), r.get("paper_b")}
    assert "2401.00001" in arxiv_ids
    assert "2401.00002" in arxiv_ids


@pytest.mark.asyncio
async def test_find_low_density_gaps():
    from db.neo4j_client import execute_query
    from agents.gap_finder import find_low_density_gaps

    await execute_query(
        "CREATE (a:Paper {arxiv_id: '2401.00010', title: 'Isolated Paper', publish_date: date('2024-01-01')})"
    )
    for i in range(5):
        await execute_query(
            f"CREATE (p:Paper {{arxiv_id: '2401.000{i+1}', title: 'Connected Paper {i}', publish_date: date('2024-01-01')}})"
        )
    for i in range(5):
        await execute_query(
            f"MATCH (a:Paper {{arxiv_id: '2401.0001'}}), (b:Paper {{arxiv_id: '2401.000{i+2}'}}) CREATE (a)-[:CITES]->(b)"
        )

    results = await find_low_density_gaps()
    assert any(r.get("arxiv_id") == "2401.00010" for r in results)


@pytest.mark.asyncio
async def test_find_stale_claims():
    from db.neo4j_client import execute_query
    from agents.gap_finder import find_stale_claims

    await execute_query(
        "CREATE (p:Paper {arxiv_id: '2010.00001', title: 'Old Paper', publish_date: date('2010-01-01')})"
    )

    results = await find_stale_claims()
    assert any(r.get("arxiv_id") == "2010.00001" for r in results)
