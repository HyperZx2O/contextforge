"""Gap Finder agent — runs 4 gap detection Cypher queries, generates LLM descriptions, writes Gap nodes to Neo4j."""

import json
import logging
import re
import uuid
from datetime import datetime, timezone

from agents import DatabaseError, PipelineAgentError
from db.neo4j_client import execute_query
from db.postgres_client import _get_session_maker
from llm.router import call_llm

logger = logging.getLogger(__name__)


def _settings():
    from config import settings
    return settings


_GAP_SYSTEM_PROMPT = (
    "You are a research gap analyst. You will be given structured data about a gap "
    "in a research knowledge graph. Your job is to write a clear, specific, one-paragraph "
    "explanation of the gap that a researcher would find useful.\n\n"
    "Respond with a single valid JSON object and nothing else:\n"
    "{\n"
    '  "description": string,   // 2-4 sentences explaining the gap in plain academic language\n'
    '  "severity": float        // 0.0 to 1.0; how significant this gap is. 1.0 = major unresolved question.\n'
    "}\n\n"
    'Do not use phrases like "it is worth noting" or "this represents an important opportunity". Be direct.'
)

_LOW_DENSITY_QUERY = """
MATCH (p:Paper)
WITH p, size([(p)-[r]-() | r]) AS degree
WITH avg(degree) AS avg_degree, collect({paper: p, degree: degree}) AS papers
UNWIND papers AS item
WITH item.paper AS p, item.degree AS degree, avg_degree
WHERE degree < (avg_degree * 0.3)
RETURN p.arxiv_id AS arxiv_id,
       p.title AS title,
       degree,
       avg_degree
ORDER BY degree ASC
LIMIT 20
"""

_UNRESOLVED_CONTRADICTIONS_QUERY = """
MATCH (a:Paper)-[r:CONTRADICTS]->(b:Paper)
WHERE NOT EXISTS {
  MATCH (c:Paper)
  WHERE (c)-[:CITES]->(a) AND (c)-[:CITES]->(b)
    AND c.publish_date > a.publish_date
    AND c.publish_date > b.publish_date
}
RETURN a.arxiv_id AS paper_a,
       a.title AS title_a,
       b.arxiv_id AS paper_b,
       b.title AS title_b,
       r.on_dimension AS dimension,
       r.evidence_quote AS evidence,
       r.confidence AS confidence
ORDER BY r.confidence DESC
LIMIT 10
"""

_STALE_CLAIMS_QUERY = """
MATCH (p:Paper)
WHERE p.publish_date < date() - duration({years: $gap_temporal_years})
AND NOT EXISTS {
  MATCH (newer:Paper)-[:CITES]->(p)
  WHERE newer.publish_date > date() - duration({years: $gap_temporal_years})
}
RETURN p.arxiv_id AS arxiv_id,
       p.title AS title,
       p.publish_date AS publish_date,
       duration.between(p.publish_date, date()).years AS years_since
ORDER BY years_since DESC
LIMIT 10
"""

_BRIDGE_OPPORTUNITIES_QUERY = """
MATCH (a:Paper), (b:Paper)
WHERE a.arxiv_id < b.arxiv_id
AND NOT (a)-[*1..3]-(b)
WITH a, b
MATCH path = shortestPath((a)-[*]-(b))
WHERE length(path) > 4
RETURN a.arxiv_id AS arxiv_id_a,
       a.title AS title_a,
       b.arxiv_id AS arxiv_id_b,
       b.title AS title_b,
       length(path) AS path_length
ORDER BY path_length DESC
LIMIT 10
"""

_WRITE_GAP_CYPHER = """
CREATE (g:Gap {
  gap_type: $gap_type,
  description: $description,
  affected_nodes: $affected_nodes,
  severity: $severity,
  detected_at: datetime()
})
WITH g
UNWIND $affected_arxiv_ids AS arxiv_id
MATCH (p:Paper {arxiv_id: arxiv_id})
MERGE (g)-[:INVOLVES]->(p)
RETURN g
"""

_FENCE_RE = re.compile(r"```(?:json)?\s*\n?(.*?)\n?\s*```", re.DOTALL)


def _strip_fences(text: str) -> str:
    m = _FENCE_RE.search(text)
    return m.group(1).strip() if m else text.strip()


async def find_low_density_gaps() -> list[dict]:
    return await execute_query(_LOW_DENSITY_QUERY)


async def find_unresolved_contradictions() -> list[dict]:
    return await execute_query(_UNRESOLVED_CONTRADICTIONS_QUERY)


async def find_stale_claims() -> list[dict]:
    s = _settings()
    return await execute_query(_STALE_CLAIMS_QUERY, {"gap_temporal_years": s.GAP_TEMPORAL_YEARS})


async def find_bridge_opportunities() -> list[dict]:
    return await execute_query(_BRIDGE_OPPORTUNITIES_QUERY)


def _build_user_prompt_low_density(results: list[dict]) -> str:
    paper_list = "\n".join(
        f"- {r['title']} (arXiv: {r['arxiv_id']}, degree: {r['degree']})"
        for r in results
    )
    avg_deg = results[0]["avg_degree"] if results else 0
    min_deg = results[0]["degree"] if results else 0
    return (
        "Gap type: Under-researched subgraph\n\n"
        "The following cluster of papers has significantly fewer connections than the rest "
        "of the graph, suggesting this area is under-explored:\n\n"
        f"Papers in cluster:\n{paper_list}\n\n"
        f"Cluster edge density: {min_deg} (graph average: {avg_deg})\n\n"
        "Explain what this subgraph covers and why its low density suggests a research gap."
    )


def _build_user_prompt_contradiction(result: dict) -> str:
    return (
        "Gap type: Unresolved contradiction\n\n"
        "Two papers contradict each other and no subsequent paper has reconciled their findings:\n\n"
        f"Paper A: {result.get('title_a', 'Unknown')} (arXiv: {result.get('paper_a', '')})\n"
        f"Paper B: {result.get('title_b', 'Unknown')} (arXiv: {result.get('paper_b', '')})\n"
        f"Contradiction dimension: {result.get('dimension', 'N/A')}\n"
        f"Evidence: {result.get('evidence', 'N/A')}\n\n"
        "Explain this gap and assess its severity."
    )


def _build_user_prompt_stale(result: dict) -> str:
    return (
        "Gap type: Stale unvalidated claim\n\n"
        "A claim made in an older paper has not been revisited or validated by newer research:\n\n"
        f"Source paper: {result.get('title', 'Unknown')} ({result.get('publish_date', 'Unknown')})\n"
        f"Years since publication: {result.get('years_since', 'Unknown')}\n\n"
        "Explain why this constitutes a gap and what follow-up research would be needed."
    )


def _build_user_prompt_bridge(result: dict) -> str:
    return (
        "Gap type: Missing bridge between subgraphs\n\n"
        "Two clusters of papers that should be connected are not:\n\n"
        f"Cluster A: {result.get('title_a', 'Unknown')} (arXiv: {result.get('arxiv_id_a', '')})\n"
        f"Cluster B: {result.get('title_b', 'Unknown')} (arXiv: {result.get('arxiv_id_b', '')})\n"
        f"Shortest path between them: {result.get('path_length', '?')} hops\n\n"
        "Explain what connection is missing and what research would bridge these two areas."
    )


_GAP_BUILDERS = {
    "low_density": lambda results: _build_user_prompt_low_density(results),
    "unresolved_contradiction": lambda results: _build_user_prompt_contradiction(results[0]) if results else "",
    "stale_claim": lambda results: _build_user_prompt_stale(results[0]) if results else "",
    "bridge_opportunity": lambda results: _build_user_prompt_bridge(results[0]) if results else "",
}


async def run_gap_finder(job_id: str) -> int:
    """Run 4 gap detection queries, generate LLM descriptions, write Gap nodes to Neo4j.

    Args:
        job_id: Pipeline job UUID.

    Returns:
        Count of Gap nodes written to Neo4j.

    Side effects:
        - Writes Gap nodes and INVOLVES edges to Neo4j.
        - Updates pipeline_jobs status to "analyzing_gaps" then "done".
        - Calls LLM for gap description generation.

    Raises:
        DatabaseError: If Neo4j write fails.
        PipelineAgentError: On unrecoverable failure.
    """
    logger.info("gap_finder started job_id=%s", job_id)
    try:
        return await _run_gap_finder_inner(job_id)
    except (DatabaseError, PipelineAgentError):
        raise
    except Exception as exc:
        logger.error("gap_finder failed job_id=%s: %s", job_id, exc, exc_info=True)
        await _set_job_failed(job_id, str(exc))
        raise PipelineAgentError(str(exc)) from exc


async def _set_job_failed(job_id: str, error_message: str):
    from sqlalchemy import update
    from db.models import PipelineJobs

    session_factory = _get_session_maker()
    async with session_factory() as session:
        await session.execute(
            update(PipelineJobs)
            .where(PipelineJobs.id == job_id)
            .values(status="failed", error_message=error_message)
        )
        await session.commit()


async def _run_gap_finder_inner(job_id: str) -> int:
    from sqlalchemy import update

    from db.models import PipelineJobs

    session_factory = _get_session_maker()
    gap_count = 0

    async with session_factory() as session:
        await session.execute(
            update(PipelineJobs)
            .where(PipelineJobs.id == job_id)
            .values(status="analyzing_gaps")
        )
        await session.commit()

    gap_queries = [
        ("low_density", find_low_density_gaps),
        ("unresolved_contradiction", find_unresolved_contradictions),
        ("stale_claim", find_stale_claims),
        ("bridge_opportunity", find_bridge_opportunities),
    ]

    for gap_type, query_fn in gap_queries:
        try:
            results = await query_fn()
        except Exception as exc:
            logger.warning("Gap query %s failed: %s", gap_type, exc)
            continue

        if not results:
            continue

        builder = _GAP_BUILDERS.get(gap_type)
        if not builder:
            continue

        user_prompt = builder(results)
        if not user_prompt:
            continue

        try:
            raw_text = await call_llm(_GAP_SYSTEM_PROMPT, user_prompt)
            cleaned = _strip_fences(raw_text)
            parsed = json.loads(cleaned)
            description = parsed.get("description", "")
            severity = float(parsed.get("severity", 0.0))
        except Exception as exc:
            logger.warning("LLM gap summary failed for %s: %s", gap_type, exc)
            continue

        if not description or not (0.0 <= severity <= 1.0):
            logger.warning("Invalid gap LLM response for %s: desc=%r, sev=%r", gap_type, description, severity)
            continue

        arxiv_ids = _extract_arxiv_ids(results, gap_type)
        affected_nodes = [r.get("arxiv_id") or r.get("paper_a") or r.get("arxiv_id_a") or "" for r in results]

        try:
            await execute_query(
                _WRITE_GAP_CYPHER,
                {
                    "gap_type": gap_type,
                    "description": description,
                    "severity": severity,
                    "affected_nodes": affected_nodes,
                    "affected_arxiv_ids": arxiv_ids,
                },
            )
            gap_count += 1
        except Exception as exc:
            logger.warning("Failed to write Gap node for %s: %s", gap_type, exc)
            continue

    async with session_factory() as session:
        await session.execute(
            update(PipelineJobs)
            .where(PipelineJobs.id == job_id)
            .values(status="done", completed_at=datetime.now(timezone.utc))
        )
        await session.commit()

    logger.info("gap_finder complete job_id=%s gaps=%d", job_id, gap_count)
    return gap_count


def _extract_arxiv_ids(results: list[dict], gap_type: str) -> list[str]:
    ids: list[str] = []
    for r in results:
        if gap_type == "bridge_opportunity":
            if r.get("arxiv_id_a"):
                ids.append(r["arxiv_id_a"])
            if r.get("arxiv_id_b"):
                ids.append(r["arxiv_id_b"])
        else:
            aid = r.get("arxiv_id") or r.get("paper_a") or ""
            if aid:
                ids.append(aid)
            aid2 = r.get("paper_b") or ""
            if aid2:
                ids.append(aid2)
    return list(dict.fromkeys(ids))
