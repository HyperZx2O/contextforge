import json
import logging
import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from neo4j import AsyncSession
from neo4j.exceptions import Neo4jError

from api.deps import require_api_key
from api.schemas import (
    DemoLoadResponse,
    DemoTopic,
    DemoTopicsResponse,
)
from dependencies import get_neo4j

router = APIRouter(prefix="/demo", tags=["demo"])
log = logging.getLogger(__name__)

_DEMO_DIR = Path(os.environ.get("DEMO_DATA_DIR", Path(__file__).resolve().parents[3] / "data" / "demo"))


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
    _auth: None = Depends(require_api_key),
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
        await session.run("MATCH (n) DETACH DELETE n")

        if papers:
            await session.run(
                "UNWIND $papers AS p "
                "CREATE (n:Paper {arxiv_id: p.arxiv_id, title: p.title, "
                "authors: p.authors, publish_date: date(p.publish_date), "
                "abstract: p.abstract, url: p.url, citation_count: p.citation_count, "
                "source: p.source})",
                papers=[
                    {
                        "arxiv_id": p.get("arxiv_id", ""),
                        "title": p.get("title", ""),
                        "authors": p.get("authors", []),
                        "publish_date": p.get("publish_date", "2024-01-01"),
                        "abstract": p.get("abstract", ""),
                        "url": p.get("url", ""),
                        "citation_count": p.get("citation_count", 0),
                        "source": p.get("source", ""),
                    }
                    for p in papers
                ],
            )

        for edge in edges:
            rel_type = edge.get("type", "CITES")
            props = edge.get("properties", {})
            props_list = [
                f"r.{k} = ${k}" for k in props.keys()
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
                **props,
            }
            await session.run(cypher, **params)

        if gaps:
            await session.run(
                "UNWIND $gaps AS g "
                "CREATE (n:Gap {gap_type: g.gap_type, description: g.description, "
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
