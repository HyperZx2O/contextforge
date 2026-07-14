import json
import logging
import re
import time

from fastapi import APIRouter, Depends, HTTPException
from neo4j import AsyncSession
from neo4j.exceptions import Neo4jError

from agents import call_llm, call_llm_answer
from api.deps import require_api_key
from api.schemas import (
    EdgeProperties,
    GraphEdge,
    NLQueryRequest,
    NLQueryResponse,
)
from dependencies import get_neo4j

router = APIRouter(prefix="/query", tags=["query"])
log = logging.getLogger(__name__)

_WRITE_KEYWORDS = re.compile(
    r"\b(CREATE|MERGE|DELETE|SET|REMOVE|DROP)\b", re.IGNORECASE
)

_SYSTEM_PROMPT = """You are a Neo4j Cypher query generator. Convert the user's natural language question about a research knowledge graph into a safe, read-only Cypher query.

The graph contains these node labels: Paper, Author, Method, Dataset, Claim, Gap
The graph contains these relationship types: CONTRADICTS, EXTENDS, REPLICATES, REPLICATES_FAILED, CHALLENGES, CITES, IMPLEMENTS, DISAGREES_ON_SCOPE, USES, PROPOSES, WROTE, COLLABORATES_WITH, OUTPERFORMS, INVOLVES

Paper nodes have these properties: arxiv_id, title, publish_date, citation_count, source, abstract

Rules:
1. Only generate read-only queries (MATCH, RETURN, WHERE, WITH, ORDER BY, LIMIT). Never generate CREATE, MERGE, DELETE, SET, or REMOVE.
2. Always include LIMIT to prevent runaway queries. Max LIMIT is 100.
3. If the question cannot be answered from this graph schema, return {"error": "cannot_translate", "reason": "..."}.
4. Respond with a single valid JSON object:
   {
     "cypher": string,
     "explanation": string
   }"""


@router.post("/natural-language", response_model=NLQueryResponse)
async def natural_language_query(
    req: NLQueryRequest,
    _auth: None = Depends(require_api_key),
    session: AsyncSession = Depends(get_neo4j),
):
    start = time.monotonic()

    if req.context_node_id:
        try:
            # Try element_id first, then fallback to arxiv_id
            check = await session.run(
                "MATCH (n) WHERE element_id(n) = $id RETURN n LIMIT 1",
                id=req.context_node_id,
            )
            records = [rec async for rec in check]
            if not records:
                check = await session.run(
                    "MATCH (n {arxiv_id: $id}) RETURN n LIMIT 1",
                    id=req.context_node_id,
                )
                records = [rec async for rec in check]
            if not records:
                raise HTTPException(
                    status_code=404,
                    detail=f"Node {req.context_node_id} not found",
                )
        except HTTPException:
            raise
        except Neo4jError as e:
            log.error("Neo4j error checking context node: %s", e)
            raise HTTPException(
                status_code=503,
                detail={"code": "GRAPH_UNAVAILABLE", "message": str(e)},
            )

    user_prompt = f"Question: {req.question}\nContext node (if any): {req.context_node_id or 'none'}\n\nGenerate a Cypher query to answer this question."

    try:
        llm_result = await call_llm(_SYSTEM_PROMPT, user_prompt)
    except Exception as e:
        log.error("LLM call failed: %s", e)
        raise HTTPException(
            status_code=503,
            detail={"code": "LLM_UNAVAILABLE", "message": str(e)},
        )

    if "error" in llm_result:
        raise HTTPException(status_code=400, detail=llm_result["error"])

    cypher = llm_result.get("cypher", "")

    if _WRITE_KEYWORDS.search(cypher):
        raise HTTPException(
            status_code=400,
            detail={
                "code": "UNSAFE_QUERY",
                "message": "Generated query contains write operations",
            },
        )

    try:
        result = await session.run(cypher)
        records = [dict(rec) async for rec in result]
    except Neo4jError as e:
        log.error("Neo4j error executing query: %s", e)
        raise HTTPException(
            status_code=503,
            detail={"code": "GRAPH_UNAVAILABLE", "message": str(e)},
        )

    results_str = json.dumps(records[:50], default=str)

    try:
        answer = await call_llm_answer(req.question, results_str)
    except Exception as e:
        log.error("LLM answer generation failed: %s", e)
        raise HTTPException(
            status_code=503,
            detail={"code": "LLM_UNAVAILABLE", "message": str(e)},
        )

    response_time_ms = int((time.monotonic() - start) * 1000)

    supporting_edges = []
    for rec in records:
        source = rec.get("source", rec.get("a_arxiv_id", ""))
        target = rec.get("target", rec.get("b_arxiv_id", ""))
        rel_type = rec.get("rel_type", rec.get("type", ""))
        if source and target and rel_type:
            props = rec.get("rel_props", rec.get("properties", {}))
            supporting_edges.append(
                GraphEdge(
                    source=str(source),
                    target=str(target),
                    type=str(rel_type),
                    properties=EdgeProperties(**(props or {})),
                )
            )

    return NLQueryResponse(
        question=req.question,
        answer=answer,
        supporting_edges=supporting_edges,
        cypher_used=cypher,
        response_time_ms=response_time_ms,
    )
