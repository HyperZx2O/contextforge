"""Lazy-initialized async Neo4j driver with Cypher execution and schema initialization."""

from neo4j import AsyncGraphDatabase

_driver = None

_CONSTRAINTS_AND_INDEXES = [
    "CREATE CONSTRAINT paper_arxiv_id_unique IF NOT EXISTS FOR (p:Paper) REQUIRE p.arxiv_id IS UNIQUE",
    "CREATE CONSTRAINT author_name_institution_unique IF NOT EXISTS FOR (a:Author) REQUIRE (a.name, a.institution) IS UNIQUE",
    "CREATE CONSTRAINT method_name_unique IF NOT EXISTS FOR (m:Method) REQUIRE m.name IS UNIQUE",
    "CREATE CONSTRAINT dataset_name_unique IF NOT EXISTS FOR (d:Dataset) REQUIRE d.name IS UNIQUE",
    "CREATE INDEX paper_title_index IF NOT EXISTS FOR (p:Paper) ON (p.title)",
    "CREATE INDEX paper_publish_date_index IF NOT EXISTS FOR (p:Paper) ON (p.publish_date)",
    "CREATE INDEX gap_node_index IF NOT EXISTS FOR (g:Gap) ON (g.gap_type)",
]


async def get_neo4j_driver():
    """Return the lazily-initialized Neo4j async driver.

    Returns:
        AsyncGraphDatabase driver instance.

    Side effects:
        Creates driver on first call using NEO4J_URI/USER/PASSWORD from config.
    """
    global _driver
    if _driver is None:
        from config import settings
        _driver = AsyncGraphDatabase.driver(
            settings.NEO4J_URI, auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD)
        )
    return _driver


async def execute_query(cypher: str, params: dict | None = None) -> list[dict]:
    """Execute a Cypher query against Neo4j and return results as a list of dicts.

    Args:
        cypher: Cypher query string.
        params: Optional query parameters.

    Returns:
        List of dicts, one per row returned by the query.

    Side effects:
        Executes query against Neo4j.

    Raises:
        DatabaseError: On Neo4j connection or query failure (wrapped by callers).
    """
    driver = await get_neo4j_driver()
    async with driver.session() as session:
        result = await session.run(cypher, params or {})
        return [dict(record) async for record in result]


async def initialize_schema():
    """Create constraints and indexes on Neo4j (Paper, Author, Method, Dataset, Gap)."""
    for stmt in _CONSTRAINTS_AND_INDEXES:
        await execute_query(stmt)


async def close_neo4j_driver():
    """Close the Neo4j driver and reset the global reference."""
    global _driver
    if _driver is not None:
        await _driver.close()
        _driver = None
