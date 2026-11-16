"""Extraction agent — runs SciSpaCy NER + sentence-transformer embeddings on papers, deduplicates, writes to entities_cache."""

import json
import logging
import re
import uuid
from datetime import datetime, timezone

from sqlalchemy import select, update

from agents.exceptions import PipelineAgentError, _set_job_failed
from db.models import EntitiesCache, PapersCache, PipelineJobs, _USE_PG
from dependencies import _session_factory
from llm.router import call_llm
from nlp.deduplication import find_duplicate
from nlp.embeddings import embed
from nlp.ner import extract_entities

logger = logging.getLogger(__name__)

_ARXIV_RE = re.compile(r"arXiv:\d{4}\.\d{4,5}")
_DOI_RE = re.compile(r"10\.\d{4,9}/[-._;()/:A-Z0-9]+", re.IGNORECASE)
_GITHUB_RE = re.compile(r"github\.com/[\w\-]+/[\w\-]+")


async def _resolve_entities(session_factory, job_id: str):
    """Use LLM to merge surface-form variants within the same entity type."""
    async with session_factory() as session:
        result = await session.execute(select(EntitiesCache))
        entities = result.scalars().all()

    by_type: dict[str, list] = {}
    for e in entities:
        by_type.setdefault(e.entity_type, []).append(e)

    for etype, ents in by_type.items():
        if len(ents) < 3:
            continue
        names = [e.name for e in ents]
        prompt = (
            f"Below are {etype} entities extracted from research papers. "
            f"Some are different surface forms of the same real-world entity.\n\n"
            f"Entities: {json.dumps(names)}\n\n"
            "Return a JSON object with a single key 'merges' containing a list of "
            "lists, where each inner list contains indices of entities that are the "
            "same. Only include groups with 2+ entities. Example: [[0, 2], [1, 3, 5]]"
        )
        try:
            raw = await call_llm(
                "You are an entity resolution assistant. Respond with valid JSON only.",
                prompt,
                response_format={"type": "json_object"},
            )
            data = json.loads(raw)
            merges = data.get("merges", [])
            for group in merges:
                if len(group) < 2:
                    continue
                # Keep the first, delete the rest
                keep_id = str(ents[group[0]].id)
                for idx in group[1:]:
                    dup_id = str(ents[idx].id)
                    async with session_factory() as session:
                        dup = await session.get(EntitiesCache, dup_id)
                        if dup:
                            await session.delete(dup)
                            await session.commit()
            logger.info("Resolved %d merge groups for %s", len(merges), etype)
        except Exception as exc:
            logger.warning("Entity resolution failed for %s: %s", etype, exc)


async def run_extraction(job_id: str, paper_ids: list[str]) -> list[str]:
    """Run NER, regex extraction, and embedding on papers; write deduplicated entities to entities_cache.

    Args:
        job_id: Pipeline job UUID.
        paper_ids: List of paper UUID strings from papers_cache.

    Returns:
        List of entity UUID strings written to entities_cache.

    Side effects:
        - Writes rows to entities_cache (PostgreSQL).
        - Updates pipeline_jobs status to "extracting" and papers_processed.
        - Calls SciSpaCy NER model and sentence-transformer embedding model.

    Raises:
        PipelineAgentError: On unrecoverable failure.
    """
    logger.info("extraction started job_id=%s papers=%d", job_id, len(paper_ids))
    try:
        entity_ids: list[str] = []

        session_factory = _session_factory

        async with session_factory() as session:
            await session.execute(
                update(PipelineJobs)
                .where(PipelineJobs.id == job_id)
                .values(status="extracting")
            )
            await session.commit()

            for paper_id in paper_ids:
                result = await session.execute(
                    select(PapersCache).where(PapersCache.id == paper_id)
                )
                paper = result.scalar_one_or_none()
                if not paper or not paper.abstract:
                    continue

                await session.execute(
                    update(PipelineJobs)
                    .where(PipelineJobs.id == job_id)
                    .values(status="extracting")
                )
                await session.commit()

                entities = extract_entities(paper.abstract)

                for match in _ARXIV_RE.finditer(paper.abstract):
                    entities.append({"entity_type": "Method", "name": match.group()})

                for match in _DOI_RE.finditer(paper.abstract):
                    entities.append({"entity_type": "Method", "name": match.group()})

                for match in _GITHUB_RE.finditer(paper.abstract):
                    entities.append({"entity_type": "Method", "name": match.group()})

                seen: dict[tuple[str, str], bool] = {}
                unique_entities: list[dict] = []
                for e in entities:
                    key = (e["entity_type"], e["name"].lower())
                    if key not in seen:
                        seen[key] = True
                        unique_entities.append(e)

                for entity in unique_entities:
                    new_emb = embed([entity["name"]])[0]

                    existing_result = await session.execute(
                        select(EntitiesCache).where(
                            EntitiesCache.entity_type == entity["entity_type"]
                        )
                    )
                    existing_entities = existing_result.scalars().all()

                    existing_embs = []
                    existing_ids: list[str] = []
                    for ex in existing_entities:
                        if ex.embedding is not None:
                            emb = (
                                json.loads(ex.embedding)
                                if isinstance(ex.embedding, str)
                                else ex.embedding
                            )
                            existing_embs.append(emb)
                            existing_ids.append(str(ex.id))

                    dup_idx = find_duplicate(new_emb, existing_embs, 0.85)

                    if dup_idx is not None:
                        dup_id = uuid.UUID(existing_ids[dup_idx])
                        existing_entity = await session.get(EntitiesCache, dup_id)
                        if existing_entity:
                            props = (
                                dict(existing_entity.properties)
                                if existing_entity.properties
                                else {}
                            )
                            props["papers_count"] = props.get("papers_count", 1) + 1
                            existing_entity.properties = props
                            await session.commit()
                        continue

                    entity_id = str(uuid.uuid4())
                    # Raw list for pgvector, JSON string for SQLite
                    embedding = new_emb if _USE_PG else json.dumps(new_emb)
                    await session.execute(
                        EntitiesCache.__table__.insert().values(
                            id=entity_id,
                            paper_id=paper_id,
                            entity_type=entity["entity_type"],
                            name=entity["name"],
                            properties={"papers_count": 1},
                            embedding=embedding,
                            created_at=datetime.now(timezone.utc),
                        )
                    )
                    await session.commit()
                    entity_ids.append(str(entity_id))

            # Post-extraction entity resolution: use LLM to merge surface-form
            # variants within the same entity type (e.g. "CNN" / "ConvNet").
            try:
                await _resolve_entities(session_factory, job_id)
            except Exception as exc:
                logger.warning("Entity resolution skipped: %s", exc)

            await session.execute(
                update(PipelineJobs)
                .where(PipelineJobs.id == job_id)
                .values(papers_processed=len(paper_ids))
            )
            await session.commit()

        logger.info(
            "extraction complete job_id=%s entities=%d", job_id, len(entity_ids)
        )
        return entity_ids
    except PipelineAgentError:
        raise
    except Exception as exc:
        logger.error("extraction failed job_id=%s: %s", job_id, exc, exc_info=True)
        await _set_job_failed(job_id, str(exc))
        raise PipelineAgentError(str(exc)) from exc
