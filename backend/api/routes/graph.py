import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from neo4j import AsyncSession
from neo4j.exceptions import Neo4jError

from api.schemas import (
    NODE_TYPES,
    RELATIONSHIP_TYPES,
    EdgeProperties,
    GapItem,
    GraphEdge,
    GraphEdgesResponse,
    GraphGapsResponse,
    GraphNode,
    GraphNodesResponse,
    NeighborItem,
    NodeDetailResponse,
    NodeProperties,
)
from dependencies import get_neo4j

router = APIRouter(prefix="/graph", tags=["graph"])
log = logging.getLogger(__name__)


def _node_id(n) -> str:
    return n.element_id if hasattr(n, "element_id") else n.id


def _record_to_node(rec) -> GraphNode:
    n = rec["n"]
    return GraphNode(
        id=_node_id(n),
        label=list(n.labels)[0] if n.labels else "Unknown",
        properties=NodeProperties(**dict(n)),
    )


def _record_to_neo4j_node(rec, key) -> GraphNode:
    n = rec[key]
    return GraphNode(
        id=_node_id(n),
        label=list(n.labels)[0] if n.labels else "Unknown",
        properties=NodeProperties(**dict(n)),
    )


@router.get("/nodes", response_model=GraphNodesResponse)
async def get_nodes(
    node_type: str | None = None,
    limit: int = Query(default=500, le=2000),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_neo4j),
):
    if node_type and node_type not in NODE_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid node_type: {node_type}")

    try:
        if node_type:
            query = f"MATCH (n:{node_type}) RETURN n LIMIT $limit SKIP $offset"
        else:
            query = "MATCH (n) WHERE n:Paper OR n:Author OR n:Method OR n:Dataset OR n:Claim OR n:Gap RETURN n LIMIT $limit SKIP $offset"
        result = await session.run(query, limit=limit, offset=offset)
        records = [rec async for rec in result]

        count_query = "MATCH (n) WHERE n:Paper OR n:Author OR n:Method OR n:Dataset OR n:Claim OR n:Gap RETURN count(n) AS cnt"
        if node_type:
            count_query = f"MATCH (n:{node_type}) RETURN count(n) AS cnt"
        count_result = await session.run(count_query)
        count_records = [rec async for rec in count_result]
        total = count_records[0]["cnt"] if count_records else 0

        return GraphNodesResponse(
            nodes=[_record_to_node(r) for r in records],
            total=total,
            limit=limit,
            offset=offset,
        )
    except Neo4jError as e:
        log.error("Neo4j error in get_nodes: %s", e)
        raise HTTPException(status_code=503, detail={"code": "GRAPH_UNAVAILABLE", "message": str(e)})


@router.get("/edges", response_model=GraphEdgesResponse)
async def get_edges(
    relationship_type: str | None = None,
    min_confidence: float = Query(default=0.0, ge=0.0, le=1.0),
    limit: int = Query(default=1000, le=5000),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_neo4j),
):
    if relationship_type and relationship_type not in RELATIONSHIP_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid relationship_type: {relationship_type}")

    try:
        type_filter = "WHERE type(r) IN ['CONTRADICTS','EXTENDS','REPLICATES','REPLICATES_FAILED','CHALLENGES','CITES','IMPLEMENTS','DISAGREES_ON_SCOPE']"
        if relationship_type:
            type_filter = f"WHERE type(r) = $rel_type AND r.confidence >= $min_confidence"
        elif min_confidence > 0:
            type_filter += f" AND r.confidence >= $min_confidence"

        query = f"""
            MATCH (a)-[r]->(b)
            {type_filter}
            RETURN a.arxiv_id AS source, b.arxiv_id AS target, type(r) AS rel_type, properties(r) AS rel_props
            LIMIT $limit SKIP $offset
        """
        params = {"limit": limit, "offset": offset, "min_confidence": min_confidence}
        if relationship_type:
            params["rel_type"] = relationship_type

        result = await session.run(query, **params)
        records = [rec async for rec in result]

        count_params = {k: v for k, v in params.items() if k not in ("limit", "offset")}
        count_result = await session.run(
            f"MATCH (a)-[r]->(b) {type_filter} RETURN count(r) AS cnt",
            **count_params,
        )
        count_records = [rec async for rec in count_result]
        total = count_records[0]["cnt"] if count_records else 0

        return GraphEdgesResponse(
            edges=[
                GraphEdge(
                    source=r["source"] or "",
                    target=r["target"] or "",
                    type=r["rel_type"],
                    properties=EdgeProperties(**(r["rel_props"] or {})),
                )
                for r in records
            ],
            total=total,
            limit=limit,
            offset=offset,
        )
    except Neo4jError as e:
        log.error("Neo4j error in get_edges: %s", e)
        raise HTTPException(status_code=503, detail={"code": "GRAPH_UNAVAILABLE", "message": str(e)})


@router.get("/gaps", response_model=GraphGapsResponse)
async def get_gaps(session: AsyncSession = Depends(get_neo4j)):
    try:
        result = await session.run("MATCH (g:Gap) RETURN g LIMIT 500")
        records = [rec async for rec in result]

        return GraphGapsResponse(gaps=[
            GapItem(
                id=g.element_id if hasattr(g, "element_id") else g.get("id", ""),
                gap_type=g.get("gap_type", ""),
                description=g.get("description", ""),
                affected_nodes=g.get("affected_nodes", []),
                severity=g.get("severity", 0.0),
                detected_at=str(g.get("detected_at", "")),
            )
            for rec in records
            for g in [rec["g"]]
        ])
    except Neo4jError as e:
        log.error("Neo4j error in get_gaps: %s", e)
        raise HTTPException(status_code=503, detail={"code": "GRAPH_UNAVAILABLE", "message": str(e)})


@router.get("/node/{node_id}", response_model=NodeDetailResponse)
async def get_node_detail(node_id: str, session: AsyncSession = Depends(get_neo4j)):
    try:
        result = await session.run(
            "MATCH (center {arxiv_id: $node_id})-[r]-(neighbor) RETURN center, r, neighbor LIMIT 50",
            node_id=node_id,
        )
        records = [rec async for rec in result]

        if not records:
            raise HTTPException(status_code=404, detail=f"Node {node_id} not found")

        center = _record_to_neo4j_node(records[0], "center")
        neighbors = [
            NeighborItem(
                node=_record_to_neo4j_node(rec, "neighbor"),
                relationship={
                    "type": rec["r"].type,
                    "direction": "outbound",
                    "properties": dict(rec["r"]) if rec["r"] else {},
                },
            )
            for rec in records
        ]

        return NodeDetailResponse(node=center, neighbors=neighbors)
    except HTTPException:
        raise
    except Neo4jError as e:
        log.error("Neo4j error in get_node_detail: %s", e)
        raise HTTPException(status_code=503, detail={"code": "GRAPH_UNAVAILABLE", "message": str(e)})
