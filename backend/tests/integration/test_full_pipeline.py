import json
import pytest
import socket
import uuid
from unittest.mock import AsyncMock, patch, MagicMock


def _postgres_available():
    try:
        s = socket.create_connection(("localhost", 5432), timeout=2)
        s.close()
        return True
    except (ConnectionRefusedError, OSError):
        return False


pytestmark = pytest.mark.skipif(
    not _postgres_available(),
    reason="PostgreSQL not available (Docker stack not running)",
)


FAKE_LLM_RESPONSE = json.dumps({
    "relationship_type": "EXTENDS",
    "confidence": 0.85,
    "evidence_quote": "Paper A extends the methodology of Paper B",
    "dimension": "methodology",
    "direction": "a_to_b",
})


def _fake_arxiv_xml():
    import xml.etree.ElementTree as ET
    root = ET.Element("feed", xmlns="http://www.w3.org/2005/Atom")
    for i in range(6):
        entry = ET.SubElement(root, "entry")
        ET.SubElement(entry, "id").text = f"http://arxiv.org/abs/2401.0010{i}"
        ET.SubElement(entry, "title").text = f"Paper about attention mechanism {i}"
        ET.SubElement(entry, "summary").text = (
            f"This paper proposes a novel attention mechanism for transformers. "
            f"We use arXiv:2401.0010{i} as a reference. "
            f"Our method achieves state-of-the-art results on benchmark {i}."
        )
        ET.SubElement(entry, "published").text = "2024-01-15T00:00:00Z"
        author = ET.SubElement(entry, "author")
        ET.SubElement(author, "name").text = f"Author {i}"
    return ET.tostring(root, encoding="unicode")


@pytest.mark.asyncio
async def test_full_pipeline():
    from agents.ingestion import run_ingestion
    from agents.extractor import run_extraction
    from agents.synthesis import run_synthesis
    from agents.gap_finder import run_gap_finder
    from db.postgres_client import _get_session_maker
    from db.models import PipelineJobs

    async def mock_get(url, params=None, timeout=None):
        resp = MagicMock()
        resp.status_code = 200
        resp.raise_for_status.return_value = None
        resp.text = _fake_arxiv_xml()
        return resp

    mock_http = MagicMock()
    mock_http.get = mock_get
    mock_http.__aenter__ = AsyncMock(return_value=mock_http)
    mock_http.__aexit__ = AsyncMock(return_value=None)

    session_factory = _get_session_maker()
    job_id = str(uuid.uuid4())

    async with session_factory() as session:
        session.add(PipelineJobs(
            id=uuid.UUID(job_id),
            query="attention mechanism 2023",
            status="pending",
        ))
        await session.commit()

    with (
        patch("agents.ingestion.httpx.AsyncClient", return_value=mock_http),
        patch("agents.ingestion._arxiv_limiter") as mock_limiter,
        patch("agents.synthesis.call_llm", new_callable=AsyncMock) as mock_llm,
        patch("agents.gap_finder.call_llm", new_callable=AsyncMock) as mock_gap_llm,
    ):
        mock_limiter.acquire = AsyncMock()
        mock_llm.return_value = FAKE_LLM_RESPONSE
        mock_gap_llm.return_value = json.dumps({
            "description": "Under-researched area in attention mechanisms",
            "severity": 0.6,
        })

        paper_ids = await run_ingestion(job_id, "attention mechanism", 2023, 2024, 10, ["arxiv"])
        assert len(paper_ids) >= 5

        entity_ids = await run_extraction(job_id, paper_ids)
        assert len(entity_ids) >= 1

        rel_count = await run_synthesis(job_id, paper_ids)
        gap_count = await run_gap_finder(job_id)

    async with session_factory() as session:
        from sqlalchemy import select
        result = await session.execute(select(PipelineJobs).where(PipelineJobs.id == uuid.UUID(job_id)))
        job = result.scalar_one_or_none()

    assert job is not None
    assert job.status == "done"
    assert job.papers_found >= 5
