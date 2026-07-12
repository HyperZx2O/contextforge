"""Extraction agent — runs SciSpaCy NER + sentence-transformer embeddings on papers, deduplicates, writes to entities_cache."""

import logging
import re
import uuid
from datetime import datetime, timezone

from sqlalchemy import select, update

from agents import PipelineAgentError
from db.models import EntitiesCache, PapersCache, PipelineJobs
from db.postgres_client import _get_session_maker
from nlp.deduplication import find_duplicate
from nlp.embeddings import embed
from nlp.ner import extract_entities

logger = logging.getLogger(__name__)

_ARXIV_RE = re.compile(r"arXiv:\d{4}\.\d{4,5}")
_DOI_RE = re.compile(r"10\.\d{4,9}/[-._;()/:A-Z0-9]+", re.IGNORECASE)
_GITHUB_RE = re.compile(r"github\.com/[\w\-]+/[\w\-]+")


async def _set_job_failed(job_id: str, error_message: str):
    from db.models import PipelineJobs
    from db.postgres_client import _get_session_maker
    from sqlalchemy import select

    session_factory = _get_session_maker()
    async with session_factory() as session:
        result = await session.execute(select(PipelineJobs).where(PipelineJobs.id == job_id))
        job = result.scalar()
        if job:
            job.status = "failed"
            job.error_message = error_message
            await session.commit()


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

        session_factory = _get_session_maker()

        async with session_factory() as session:
            await session.execute(
                update(PipelineJobs).where(PipelineJobs.id == uuid.UUID(job_id)).values(status="extracting")
            )
            await session.commit()

            for paper_id in paper_ids:
                result = await session.execute(
                    select(PapersCache).where(PapersCache.id == uuid.UUID(paper_id))
                )
                paper = result.scalar_one_or_none()
                if not paper or not paper.abstract:
                    continue

                await session.execute(
                    update(PipelineJobs)
                    .where(PipelineJobs.id == uuid.UUID(job_id))
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
                        select(EntitiesCache).where(EntitiesCache.entity_type == entity["entity_type"])
                    )
                    existing_entities = existing_result.scalars().all()

                    existing_embs = []
                    existing_ids: list[str] = []
                    for ex in existing_entities:
                        if ex.embedding is not None:
                            existing_embs.append(ex.embedding)
                            existing_ids.append(str(ex.id))

                    dup_idx = find_duplicate(new_emb, existing_embs, 0.85)

                    if dup_idx is not None:
                        dup_id = uuid.UUID(existing_ids[dup_idx])
                        await session.execute(
                            update(EntitiesCache)
                            .where(EntitiesCache.id == dup_id)
                            .values(properties={"papers_count": "+1"})
                        )
                        await session.commit()
                        continue

                    entity_id = uuid.uuid4()
                    await session.execute(
                        EntitiesCache.__table__.insert().values(
                            id=entity_id,
                            paper_id=uuid.UUID(paper_id),
                            entity_type=entity["entity_type"],
                            name=entity["name"],
                            properties={"papers_count": 1},
                            embedding=new_emb,
                            created_at=datetime.now(timezone.utc),
                        )
                    )
                    await session.commit()
                    entity_ids.append(str(entity_id))

            await session.execute(
                update(PipelineJobs)
                .where(PipelineJobs.id == uuid.UUID(job_id))
                .values(papers_processed=len(paper_ids))
            )
            await session.commit()

        logger.info("extraction complete job_id=%s entities=%d", job_id, len(entity_ids))
        return entity_ids
    except PipelineAgentError:
        raise
    except Exception as exc:
        logger.error("extraction failed job_id=%s: %s", job_id, exc, exc_info=True)
        await _set_job_failed(job_id, str(exc))
        raise PipelineAgentError(str(exc)) from exc
