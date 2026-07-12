"""Test helper — inserts 3 fake papers and 2 fake pipeline jobs for downstream testing."""

import asyncio

from db.models import Base, PapersCache, PipelineJobs
from db.postgres_client import _get_engine, _get_session_maker


async def seed():
    engine = _get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = _get_session_maker()
    async with session_factory() as session:
        papers = [
            PapersCache(
                arxiv_id="2301.00001",
                title="Attention Is All You Need Revisited",
                abstract="We revisit the transformer architecture and propose improvements.",
                authors=[{"name": "Alice Smith", "institution": "MIT"}],
                source="arxiv",
                url="https://arxiv.org/abs/2301.00001",
            ),
            PapersCache(
                arxiv_id="2301.00002",
                title="BERT Pre-training of Deep Bidirectional Transformers",
                abstract="We introduce BERT, a new language representation model.",
                authors=[{"name": "Bob Jones", "institution": "Google"}],
                source="arxiv",
                url="https://arxiv.org/abs/2301.00002",
            ),
            PapersCache(
                arxiv_id="2301.00003",
                title="GPT-4 Technical Report",
                abstract="We report the development of GPT-4, a large-scale multimodal model.",
                authors=[{"name": "Carol Lee", "institution": "OpenAI"}],
                source="arxiv",
                url="https://arxiv.org/abs/2301.00003",
            ),
        ]
        session.add_all(papers)

        jobs = [
            PipelineJobs(query="attention mechanism", status="pending"),
            PipelineJobs(query="language models", status="done"),
        ]
        session.add_all(jobs)
        await session.commit()

    papers_count = await _count(session_factory, PapersCache)
    jobs_count = await _count(session_factory, PipelineJobs)
    print(f"Seeded {papers_count} papers, {jobs_count} jobs")


async def _count(session_factory, model):
    from sqlalchemy import func, select

    async with session_factory() as session:
        result = await session.execute(select(func.count()).select_from(model))
        return result.scalar()


if __name__ == "__main__":
    asyncio.run(seed())
