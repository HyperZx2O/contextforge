import json
import logging
import os
import re
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from neo4j import AsyncSession
from neo4j.exceptions import Neo4jError

from api.deps import get_current_user
from api.schemas import (
    RELATIONSHIP_TYPES,
    DemoLoadResponse,
    DemoTopic,
    DemoTopicsResponse,
)
from dependencies import get_neo4j

router = APIRouter(prefix="/demo", tags=["demo"])
log = logging.getLogger(__name__)

_DEMO_DIR = Path(os.environ.get("DEMO_DATA_DIR", Path(__file__).resolve().parents[3] / "data" / "demo"))

_SAFE_KEY_RE = re.compile(r"[^a-zA-Z0-9_]")


def _safe_cypher_key(key: str) -> str:
    """Strip non-alphanumeric chars to prevent Cypher injection via property keys."""
    return _SAFE_KEY_RE.sub("", key)


def _list_topics() -> list[DemoTopic]:
    topics = []
    if not _DEMO_DIR.is_dir():
        return topics
    for f in sorted(_DEMO_DIR.glob("*.json")):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            topics.append(
                DemoTopic(
                    id=data.get("id", f.stem),
                    label=data.get("label", f.stem),
                    paper_count=data.get("paper_count", 0),
                    edge_count=data.get("edge_count", 0),
                )
            )
        except Exception:
            log.warning("Skipping invalid demo file: %s", f.name)
    return topics


@router.get("/topics", response_model=DemoTopicsResponse)
async def list_demo_topics():
    return DemoTopicsResponse(topics=_list_topics())


@router.post("/load/{topic_id}", response_model=DemoLoadResponse)
async def load_demo(
    topic_id: str,
    _current_user=Depends(get_current_user),
    session: AsyncSession = Depends(get_neo4j),
):
    file_path = _DEMO_DIR / f"{topic_id}.json"
    if not file_path.is_file():
        raise HTTPException(
            status_code=404,
            detail=f"Demo topic '{topic_id}' not found",
        )

    try:
        data = json.loads(file_path.read_text(encoding="utf-8"))
    except Exception as e:
        log.error("Failed to read demo file %s: %s", file_path, e)
        raise HTTPException(
            status_code=500,
            detail={"code": "DEMO_LOAD_ERROR", "message": str(e)},
        )

    papers = data.get("papers", [])
    edges = data.get("edges", [])
    gaps = data.get("gaps", [])

    try:
        # Clear all existing graph data so each demo loads into a clean slate.
        # The demo endpoint is a "reset + load" operation — stale pipeline data
        # would otherwise drown the handful of demo papers and make every demo
        # topic appear identical.
        await session.run("MATCH (n) DETACH DELETE n")

        if papers:
            await session.run(
                "UNWIND $papers AS p "
                "MERGE (n:Paper:Demo {arxiv_id: p.arxiv_id}) "
                "SET n.title = p.title, "
                "    n.authors = p.authors, "
                "    n.publish_date = date(p.publish_date), "
                "    n.abstract = p.abstract, "
                "    n.url = p.url, "
                "    n.citation_count = p.citation_count, "
                "    n.source = p.source",
                papers=[
                    {
                        "arxiv_id": p.get("arxiv_id", ""),
                        "title": p.get("title", ""),
                        "authors": p.get("authors", []),
                        "publish_date": p.get("publish_date", "2024-01-01"),
                        "abstract": p.get("abstract", ""),
                        "url": p.get("url", ""),
                        "citation_count": p.get("citation_count", 0),
                        "source": "demo",
                    }
                    for p in papers
                ],
            )

        for edge in edges:
            rel_type = edge.get("type", "CITES")
            if rel_type not in RELATIONSHIP_TYPES:
                log.warning("Skipping edge with invalid rel_type: %s", rel_type)
                continue
            props = edge.get("properties", {})
            safe_props = {_safe_cypher_key(k): v for k, v in props.items() if _safe_cypher_key(k)}
            props_list = [
                f"r.{k} = ${k}" for k in safe_props.keys()
            ]
            set_clause = ", ".join(props_list)
            set_clause = f" SET {set_clause}" if set_clause else ""
            cypher = (
                f"MATCH (a:Paper {{arxiv_id: $source}}) "
                f"MATCH (b:Paper {{arxiv_id: $target}}) "
                f"CREATE (a)-[r:{rel_type}]->(b)"
                f"{set_clause} "
                f"RETURN r"
            )
            params = {
                "source": edge.get("source", ""),
                "target": edge.get("target", ""),
                **safe_props,
            }
            await session.run(cypher, **params)

        if gaps:
            await session.run(
                "UNWIND $gaps AS g "
                "CREATE (n:Gap:Demo {gap_type: g.gap_type, description: g.description, "
                "affected_nodes: g.affected_nodes, severity: g.severity, "
                "detected_at: datetime()})",
                gaps=[
                    {
                        "gap_type": g.get("gap_type", ""),
                        "description": g.get("description", ""),
                        "affected_nodes": g.get("affected_nodes", []),
                        "severity": g.get("severity", 0.0),
                    }
                    for g in gaps
                ],
            )

            for gap in gaps:
                await session.run(
                    "MATCH (g:Gap {gap_type: $gap_type, description: $description}) "
                    "UNWIND $affected AS arxiv_id "
                    "MATCH (p:Paper {arxiv_id: arxiv_id}) "
                    "MERGE (g)-[:INVOLVES]->(p)",
                    gap_type=gap.get("gap_type", ""),
                    description=gap.get("description", ""),
                    affected=gap.get("affected_nodes", []),
                )

    except Neo4jError as e:
        log.error("Neo4j error loading demo: %s", e)
        raise HTTPException(
            status_code=503,
            detail={"code": "GRAPH_UNAVAILABLE", "message": str(e)},
        )

    return DemoLoadResponse(
        topic_id=topic_id,
        loaded=True,
        papers_loaded=len(papers),
        edges_loaded=len(edges),
        gaps_loaded=len(gaps),
    )
