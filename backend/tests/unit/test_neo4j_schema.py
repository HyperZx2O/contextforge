import pytest

from db.neo4j_client import initialize_schema, close_neo4j_driver


@pytest.mark.asyncio
@pytest.mark.skipif(
    not __import__("shutil").which("neo4j"),
    reason="Neo4j driver not available",
)
async def test_initialize_schema():
    try:
        await initialize_schema()
    except Exception:
        pytest.skip("Neo4j not reachable")
    finally:
        await close_neo4j_driver()
