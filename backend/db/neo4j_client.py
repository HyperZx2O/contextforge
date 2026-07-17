"""Neo4j Cypher execution and schema initialization — uses the shared driver from dependencies."""

import asyncio
import logging

from neo4j.exceptions import ServiceUnavailable, SessionExpired

logger = logging.getLogger(__name__)

_CONSTRAINTS_AND_INDEXES = [
    "CREATE CONSTRAINT paper_arxiv_id_unique IF NOT EXISTS FOR (p:Paper) REQUIRE p.arxiv_id IS UNIQUE",
    "CREATE CONSTRAINT author_name_institution_unique IF NOT EXISTS FOR (a:Author) REQUIRE (a.name, a.institution) IS UNIQUE",
    "CREATE CONSTRAINT method_name_unique IF NOT EXISTS FOR (m:Method) REQUIRE m.name IS UNIQUE",
    "CREATE CONSTRAINT dataset_name_unique IF NOT EXISTS FOR (d:Dataset) REQUIRE d.name IS UNIQUE",
    "CREATE INDEX paper_title_index IF NOT EXISTS FOR (p:Paper) ON (p.title)",
    "CREATE INDEX paper_publish_date_index IF NOT EXISTS FOR (p:Paper) ON (p.publish_date)",
    "CREATE INDEX gap_node_index IF NOT EXISTS FOR (g:Gap) ON (g.gap_type)",
]


_RETRYABLE = (ServiceUnavailable, SessionExpired, OSError)


async def execute_query(cypher: str, params: dict | None = None,
                        max_attempts: int = 2) -> list[dict]:
    """Execute a Cypher query against Neo4j with retry on transient errors."""
    from dependencies import get_neo4j_driver
    last_exc = None
    for attempt in range(max_attempts):
        try:
            driver = get_neo4j_driver()
            async with driver.session() as session:
                result = await session.run(cypher, params or {})
                return [dict(record) async for record in result]
        except _RETRYABLE as exc:
            last_exc = exc
            logger.warning("Neo4j retryable error (attempt %d/%d): %s",
                           attempt + 1, max_attempts, exc)
            if attempt < max_attempts - 1:
                await asyncio.sleep(1.0)
    raise last_exc  # type: ignore[misc]


async def initialize_schema():
    """Create constraints and indexes on Neo4j."""
    for stmt in _CONSTRAINTS_AND_INDEXES:
        await execute_query(stmt)


async def close_neo4j_driver():
    """Close the shared Neo4j driver."""
    import dependencies
    if dependencies._neo4j_driver is not None:
        await dependencies._neo4j_driver.close()
        dependencies._neo4j_driver = None
