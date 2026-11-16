"""Synthesis agent — generates candidate paper pairs via K-NN, classifies relationships with LLM, writes typed edges to Neo4j.

Phase 12 — Performance Optimization

Baseline (sequential LLM calls, 50 papers, ~250 pairs):
  ~750s (250 pairs × 3s/pair sequential)

Post-optimization (5 concurrent LLM calls via asyncio.gather + Semaphore):
  ~150s (250 pairs × 3s / 5 concurrent)

Embedding computation already batched (batch_size=32 in nlp/embeddings.py).
arXiv rate limiter is spec-mandated (3 req/sec), not bypassed.
"""

import asyncio
import hashlib
import json
import logging
import re
import uuid
from datetime import datetime, timezone

import numpy as np
from sqlalchemy import select, update

from agents.exceptions import (
    DatabaseError,
    PipelineAgentError,
    _set_job_failed,
    _strip_fences,
)
from api.schemas import LLMRelationshipResponse as RelationshipResult
from db.models import EntitiesCache, PapersCache, PipelineJobs, SynthesisCache
from dependencies import _session_factory
from db.neo4j_client import execute_query
from llm.router import call_llm

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = (
    "You are a scientific relationship classifier. Your job is to analyze two research papers and determine the relationship between them.\n\n"
    "You must respond with a single valid JSON object and nothing else. No explanation, no markdown, no backticks. Only the JSON.\n\n"
    "The JSON must follow this exact schema:\n"
    "{\n"
    '  "relationship_type": string,   // one of: CONTRADICTS, EXTENDS, REPLICATES, REPLICATES_FAILED, CHALLENGES, CITES, IMPLEMENTS, DISAGREES_ON_SCOPE\n'
    '  "confidence": float,           // 0.0 to 1.0\n'
    '  "evidence_quote": string,      // direct quote from Paper A or Paper B. Must not be empty.\n'
    '  "dimension": string,           // specific aspect (e.g. "retrieval accuracy", "training efficiency")\n'
    '  "direction": string            // "a_to_b" or "b_to_a"\n'
    "}\n\n"
    "If no meaningful relationship exists beyond incidental topic overlap, return:\n"
    '{"relationship_type": "NONE", "confidence": 0.0, "evidence_quote": "", "dimension": "", "direction": "a_to_b"}\n\n'
    "Do not invent quotes. The evidence_quote must come from the text you are given.\n\n"
    "Examples:\n"
    "Example 1 (CONTRADICTS):\n"
    "Paper A claims retrieval accuracy drops 18% under long context. Paper B claims RAG maintains accuracy.\n"
    '{"relationship_type": "CONTRADICTS", "confidence": 0.91, "evidence_quote": "Our results show retrieval accuracy drops 18% under long-context conditions.", "dimension": "retrieval accuracy", "direction": "a_to_b"}\n\n'
    "Example 2 (EXTENDS):\n"
    "Paper A proposes a base method. Paper B adds an optimization on top.\n"
    '{"relationship_type": "EXTENDS", "confidence": 0.85, "evidence_quote": "We build upon the method proposed by [A] and add X.", "dimension": "method efficiency", "direction": "b_to_a"}\n\n'
    "Example 3 (CITES):\n"
    "Paper B references Paper A for background without making a claim.\n"
    '{"relationship_type": "CITES", "confidence": 0.7, "evidence_quote": "As shown in [A], ...", "dimension": "background", "direction": "b_to_a"}\n'
)

_JSON_RESPONSE_FORMAT = {"type": "json_object"}

_USER_TEMPLATE = (
    "Paper A:\nTitle: {title_a}\nPublished: {date_a}\nAbstract: {abstract_a}\n\n"
    "Paper B:\nTitle: {title_b}\nPublished: {date_b}\nAbstract: {abstract_b}\n\n"
    "Identify the relationship between Paper A and Paper B."
)

from config import settings

_K = 10
_MAX_PARSE_RETRIES = 2
_CONCURRENCY_LIMIT = 5


def _cache_key(arxiv_a: str, arxiv_b: str) -> str:
    a, b = sorted([arxiv_a or "", arxiv_b or ""])
    raw = f"{a}:{b}"
    return hashlib.sha256(raw.encode()).hexdigest()


def _paper_embedding_map(rows: list) -> dict[str, list[float]]:
    by_paper: dict[str, list[list[float]]] = {}
    for row in rows:
        pid = str(row["paper_id"])
        emb = row["embedding"]
        if emb is not None:
            by_paper.setdefault(pid, []).append(np.array(emb, dtype=np.float32))
    return {pid: np.mean(vecs, axis=0).tolist() for pid, vecs in by_paper.items()}


def _top_k_neighbors(
    target_emb: list[float], all_embs: dict[str, list[float]], k: int
) -> list[str]:
    target = np.array(target_emb, dtype=np.float32)
    t_norm = np.linalg.norm(target)
    if t_norm == 0:
        return []
    scores: list[tuple[str, float]] = []
    for pid, emb in all_embs.items():
        e = np.array(emb, dtype=np.float32)
        e_norm = np.linalg.norm(e)
        if e_norm == 0:
            continue
        sim = float(target @ e / (t_norm * e_norm))
        scores.append((pid, sim))
    scores.sort(key=lambda x: x[1], reverse=True)
    return [pid for pid, _ in scores[:k]]


def _build_cypher(rel_type: str, props: dict) -> tuple[str, dict]:
    safe_type = re.sub(r"[^A-Z_]", "", rel_type.upper())
    params = {
        "source_arxiv_id": props["source_arxiv_id"],
        "target_arxiv_id": props["target_arxiv_id"],
    }
    set_clauses = []
    for k, v in props.items():
        if k in ("source_arxiv_id", "target_arxiv_id"):
            continue
        param_name = f"prop_{k}"
        params[param_name] = v
        set_clauses.append(f"r.{k} = ${param_name}")
    set_clauses.append("r.timestamp = datetime()")
    set_block = ",\n    ".join(set_clauses)
    cypher = (
        f"MATCH (a:Paper {{arxiv_id: $source_arxiv_id}})\n"
        f"MATCH (b:Paper {{arxiv_id: $target_arxiv_id}})\n"
        f"MERGE (a)-[r:{safe_type}]->(b)\n"
        f"SET {set_block}\n"
        f"RETURN r"
    )
    return cypher, params


async def _neo4j_write(cypher: str, params: dict | None = None):
    try:
        return await execute_query(cypher, params)
    except DatabaseError:
        raise
    except Exception as exc:
        raise DatabaseError(f"Neo4j write failed: {exc}") from exc


async def _call_llm_with_retry(
    system: str, user: str, pair_label: str
) -> RelationshipResult | None:
    for attempt in range(_MAX_PARSE_RETRIES + 1):
        try:
            raw_text = await call_llm(
                system, user, response_format=_JSON_RESPONSE_FORMAT
            )
            cleaned = _strip_fences(raw_text)
            parsed = json.loads(cleaned)
            return RelationshipResult(**parsed)
        except Exception as exc:
            logger.warning(
                "LLM parse error on attempt %d for pair %s: %s",
                attempt + 1,
                pair_label,
                exc,
            )
    return None


async def _process_batch(
    batch: list[tuple[str, str]],
    papers: dict,
    session_factory,
    confidence_threshold: float,
    semaphore: asyncio.Semaphore,
) -> int:
    """Process a batch of paper pairs in a single LLM call."""
    # Filter valid pairs
    valid_pairs = []
    for pid_a, pid_b in batch:
        paper_a = papers.get(pid_a)
        paper_b = papers.get(pid_b)
        if paper_a and paper_b and paper_a.arxiv_id and paper_b.arxiv_id:
            valid_pairs.append((pid_a, pid_b, paper_a, paper_b))

    if not valid_pairs:
        return 0

    # Check cache for each pair
    uncached = []
    cached_results = 0
    for pid_a, pid_b, paper_a, paper_b in valid_pairs:
        ck = _cache_key(paper_a.arxiv_id, paper_b.arxiv_id)
        async with session_factory() as session:
            cache_result = await session.execute(
                select(SynthesisCache).where(SynthesisCache.cache_key == ck)
            )
            cached = cache_result.scalar_one_or_none()
            if cached and cached.relationship_type and cached.confidence:
                if cached.confidence >= confidence_threshold:
                    source_id = paper_a.arxiv_id
                    target_id = paper_b.arxiv_id
                    if (
                        cached.llm_response
                        and cached.llm_response.get("direction") == "b_to_a"
                    ):
                        source_id, target_id = target_id, source_id
                    props = {
                        "source_arxiv_id": source_id,
                        "target_arxiv_id": target_id,
                        "confidence": cached.confidence,
                        "evidence_quote": cached.llm_response.get("evidence_quote", "")
                        if cached.llm_response
                        else "",
                        "on_dimension": cached.llm_response.get("dimension", "")
                        if cached.llm_response
                        else "",
                    }
                    cypher, params = _build_cypher(cached.relationship_type, props)
                    await _neo4j_write(cypher, params)
                    cached_results += 1
                continue
            uncached.append((pid_a, pid_b, paper_a, paper_b, ck))

    if not uncached:
        return cached_results

    # Build batch prompt
    batch_prompt = (
        "Analyze the following paper pairs and classify each relationship.\n\n"
    )
    for i, (pid_a, pid_b, paper_a, paper_b, ck) in enumerate(uncached):
        batch_prompt += (
            f"--- Pair {i + 1} ---\n"
            f"Paper A:\nTitle: {paper_a.title or ''}\nPublished: {str(paper_a.publish_date or '')}\nAbstract: {paper_a.abstract or ''}\n\n"
            f"Paper B:\nTitle: {paper_b.title or ''}\nPublished: {str(paper_b.publish_date or '')}\nAbstract: {paper_b.abstract or ''}\n\n"
        )
    batch_prompt += (
        f"Return a JSON object with a single key 'results' containing an array of "
        f"{len(uncached)} objects, one per pair, in the same order. Each object must follow "
        f"the schema: {{relationship_type, confidence, evidence_quote, dimension, direction}}."
    )

    async with semaphore:
        raw_text = await _call_llm_with_retry_batch(
            _SYSTEM_PROMPT, batch_prompt, f"batch-{len(uncached)}", len(uncached)
        )

    if not raw_text:
        return cached_results

    try:
        parsed = json.loads(_strip_fences(raw_text))
        results = parsed.get("results", []) if isinstance(parsed, dict) else parsed
    except Exception:
        logger.warning("Failed to parse batch response")
        return cached_results

    rel_count = cached_results
    for i, (pid_a, pid_b, paper_a, paper_b, ck) in enumerate(uncached):
        if i >= len(results):
            break
        r = results[i]
        if not isinstance(r, dict):
            continue
        try:
            result = RelationshipResult(**r)
        except Exception:
            continue

        # Cache the result
        async with session_factory() as session:
            await session.execute(
                SynthesisCache.__table__.insert().values(
                    id=str(uuid.uuid4()),
                    paper_a_id=pid_a,
                    paper_b_id=pid_b,
                    cache_key=ck,
                    llm_response=result.model_dump(),
                    confidence=result.confidence,
                    relationship_type=result.relationship_type,
                    created_at=datetime.now(timezone.utc),
                )
            )
            await session.commit()

        if (
            result.relationship_type == "NONE"
            or result.confidence < confidence_threshold
        ):
            continue

        source_id = paper_a.arxiv_id
        target_id = paper_b.arxiv_id
        if result.direction == "b_to_a":
            source_id, target_id = target_id, source_id

        props = {
            "source_arxiv_id": source_id,
            "target_arxiv_id": target_id,
            "confidence": result.confidence,
            "evidence_quote": result.evidence_quote,
            "on_dimension": result.dimension,
        }
        cypher, params = _build_cypher(result.relationship_type, props)
        await _neo4j_write(cypher, params)
        rel_count += 1

    return rel_count


async def _call_llm_with_retry_batch(
    system: str, user: str, label: str, expected: int
) -> str | None:
    for attempt in range(_MAX_PARSE_RETRIES + 1):
        try:
            raw_text = await call_llm(
                system, user, response_format=_JSON_RESPONSE_FORMAT
            )
            cleaned = _strip_fences(raw_text)
            parsed = json.loads(cleaned)
            # Validate it's a dict with 'results' or a list
            if isinstance(parsed, dict) and "results" in parsed:
                if len(parsed["results"]) != expected:
                    logger.warning(
                        "Batch response has %d results, expected %d",
                        len(parsed["results"]),
                        expected,
                    )
            elif isinstance(parsed, list):
                if len(parsed) != expected:
                    logger.warning(
                        "Batch response has %d results, expected %d",
                        len(parsed),
                        expected,
                    )
            return raw_text
        except Exception as exc:
            logger.warning(
                "LLM parse error on attempt %d for batch %s: %s",
                attempt + 1,
                label,
                exc,
            )
    return None
    paper_a = papers.get(pid_a)
    paper_b = papers.get(pid_b)
    if not paper_a or not paper_b:
        return 0
    if not paper_a.arxiv_id or not paper_b.arxiv_id:
        return 0

    ck = _cache_key(paper_a.arxiv_id, paper_b.arxiv_id)
    pair_label = f"{paper_a.arxiv_id}-{paper_b.arxiv_id}"

    async with session_factory() as session:
        cache_result = await session.execute(
            select(SynthesisCache).where(SynthesisCache.cache_key == ck)
        )
        cached = cache_result.scalar_one_or_none()

        if cached and cached.relationship_type and cached.confidence:
            if cached.confidence >= confidence_threshold:
                source_id = paper_a.arxiv_id
                target_id = paper_b.arxiv_id
                if (
                    cached.llm_response
                    and cached.llm_response.get("direction") == "b_to_a"
                ):
                    source_id, target_id = target_id, source_id
                props = {
                    "source_arxiv_id": source_id,
                    "target_arxiv_id": target_id,
                    "confidence": cached.confidence,
                    "evidence_quote": cached.llm_response.get("evidence_quote", "")
                    if cached.llm_response
                    else "",
                    "on_dimension": cached.llm_response.get("dimension", "")
                    if cached.llm_response
                    else "",
                }
                cypher, params = _build_cypher(cached.relationship_type, props)
                await _neo4j_write(cypher, params)
                return 1
            return 0

    user_prompt = _USER_TEMPLATE.format(
        title_a=paper_a.title or "",
        date_a=str(paper_a.publish_date or ""),
        abstract_a=paper_a.abstract or "",
        title_b=paper_b.title or "",
        date_b=str(paper_b.publish_date or ""),
        abstract_b=paper_b.abstract or "",
    )

    async with semaphore:
        raw_response = await _call_llm_with_retry(
            _SYSTEM_PROMPT, user_prompt, pair_label
        )

    if not raw_response:
        return 0

    async with session_factory() as session:
        await session.execute(
            SynthesisCache.__table__.insert().values(
                id=str(uuid.uuid4()),
                paper_a_id=pid_a,
                paper_b_id=pid_b,
                cache_key=ck,
                llm_response=raw_response.model_dump(),
                confidence=raw_response.confidence,
                relationship_type=raw_response.relationship_type,
                created_at=datetime.now(timezone.utc),
            )
        )
        await session.commit()

        if (
            raw_response.relationship_type == "NONE"
            or raw_response.confidence < confidence_threshold
        ):
            return 0

        source_id = paper_a.arxiv_id
        target_id = paper_b.arxiv_id
        if raw_response.direction == "b_to_a":
            source_id, target_id = target_id, source_id

        props = {
            "source_arxiv_id": source_id,
            "target_arxiv_id": target_id,
            "confidence": raw_response.confidence,
            "evidence_quote": raw_response.evidence_quote,
            "on_dimension": raw_response.dimension,
        }
        cypher, params = _build_cypher(raw_response.relationship_type, props)
        await _neo4j_write(cypher, params)
        return 1


async def run_synthesis(job_id: str, paper_ids: list[str]) -> int:
    """Generate K-NN candidate pairs, classify relationships via LLM, write typed edges to Neo4j.

    Args:
        job_id: Pipeline job UUID.
        paper_ids: List of paper UUID strings with embeddings.

    Returns:
        Count of relationships written to Neo4j.

    Side effects:
        - Writes typed relationship edges to Neo4j.
        - Writes cache entries to synthesis_cache (PostgreSQL).
        - Updates pipeline_jobs status to "synthesizing" and relationships_created.
        - Calls LLM (Groq/OpenRouter) for each uncached pair.

    Raises:
        DatabaseError: If Neo4j write fails.
        PipelineAgentError: On unrecoverable failure.
    """
    logger.info("synthesis started job_id=%s papers=%d", job_id, len(paper_ids))
    try:
        return await _run_synthesis_inner(job_id, paper_ids)
    except (DatabaseError, PipelineAgentError):
        raise
    except Exception as exc:
        logger.error("synthesis failed job_id=%s: %s", job_id, exc, exc_info=True)
        await _set_job_failed(job_id, str(exc))
        raise PipelineAgentError(str(exc)) from exc


async def _run_synthesis_inner(job_id: str, paper_ids: list[str]) -> int:
    session_factory = _session_factory

    async with session_factory() as session:
        await session.execute(
            update(PipelineJobs)
            .where(PipelineJobs.id == job_id)
            .values(status="synthesizing")
        )
        await session.commit()

        ent_result = await session.execute(
            select(
                EntitiesCache.paper_id,
                EntitiesCache.embedding,
            ).where(
                EntitiesCache.paper_id.in_(paper_ids),
                EntitiesCache.embedding.isnot(None),
            )
        )
        emb_rows = ent_result.all()
        emb_map = _paper_embedding_map(
            [{"paper_id": str(r[0]), "embedding": r[1]} for r in emb_rows]
        )

        if len(emb_map) < 2:
            await session.execute(
                update(PipelineJobs)
                .where(PipelineJobs.id == job_id)
                .values(status="done", relationships_created=0)
            )
            await session.commit()
            return 0

        paper_ids_with_emb = list(emb_map.keys())
        candidate_pairs: list[tuple[str, str]] = []
        for pid in paper_ids_with_emb:
            neighbors = _top_k_neighbors(emb_map[pid], emb_map, _K)
            for nid in neighbors:
                if nid != pid:
                    pair = tuple(sorted([pid, nid]))
                    candidate_pairs.append(pair)
        candidate_pairs = list(dict.fromkeys(candidate_pairs))

        paper_result = await session.execute(
            select(PapersCache).where(PapersCache.id.in_(paper_ids_with_emb))
        )
        papers = {str(p.id): p for p in paper_result.scalars().all()}

    semaphore = asyncio.Semaphore(_CONCURRENCY_LIMIT)

    # Batch pairs into groups of 3 for fewer LLM calls
    batch_size = 3
    batches = [
        candidate_pairs[i : i + batch_size]
        for i in range(0, len(candidate_pairs), batch_size)
    ]

    tasks = [
        _process_batch(
            batch,
            papers,
            session_factory,
            settings.CONFIDENCE_THRESHOLD,
            semaphore,
        )
        for batch in batches
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    rel_count = 0
    for r in results:
        if isinstance(r, DatabaseError):
            raise r
        elif isinstance(r, Exception):
            logger.warning("Batch processing failed: %s", r)
        elif isinstance(r, int):
            rel_count += r

    async with session_factory() as session:
        await session.execute(
            update(PipelineJobs)
            .where(PipelineJobs.id == job_id)
            .values(status="done", relationships_created=rel_count)
        )
        await session.commit()

    logger.info("synthesis complete job_id=%s relationships=%d", job_id, rel_count)
    return rel_count
