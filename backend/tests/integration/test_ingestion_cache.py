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


@pytest.mark.asyncio
async def test_ingestion_cache_hit():
    from agents.ingestion import run_ingestion

    arxiv_call_count = 0
    fake_paper = {
        "arxiv_id": "2401.00100",
        "title": "Test Paper",
        "abstract": "Test abstract about attention mechanisms",
        "authors": [{"name": "Test Author", "institution": "Test Uni"}],
        "publish_date": "2024-01-15",
        "source": "arxiv",
        "url": "https://arxiv.org/abs/2401.00100",
    }

    def fake_arxiv_response():
        import xml.etree.ElementTree as ET
        root = ET.Element("feed", xmlns="http://www.w3.org/2005/Atom")
        entry = ET.SubElement(root, "entry")
        ET.SubElement(entry, "id").text = "http://arxiv.org/abs/2401.00100"
        ET.SubElement(entry, "title").text = "Test Paper"
        ET.SubElement(entry, "summary").text = "Test abstract about attention mechanisms"
        ET.SubElement(entry, "published").text = "2024-01-15T00:00:00Z"
        author = ET.SubElement(entry, "author")
        ET.SubElement(author, "name").text = "Test Author"
        return ET.tostring(root, encoding="unicode")

    async def mock_get(url, params=None, timeout=None):
        nonlocal arxiv_call_count
        arxiv_call_count += 1
        resp = MagicMock()
        resp.status_code = 200
        resp.raise_for_status.return_value = None
        resp.text = fake_arxiv_response()
        return resp

    mock_http = MagicMock()
    mock_http.get = mock_get
    mock_http.__aenter__ = AsyncMock(return_value=mock_http)
    mock_http.__aexit__ = AsyncMock(return_value=None)

    with (
        patch("agents.ingestion.httpx.AsyncClient", return_value=mock_http),
        patch("agents.ingestion._arxiv_limiter") as mock_limiter,
    ):
        mock_limiter.acquire = AsyncMock()

        job_id = str(uuid.uuid4())
        result1 = await run_ingestion(job_id, "attention mechanism", 2024, 2024, 5, ["arxiv"])
        first_count = arxiv_call_count

        job_id2 = str(uuid.uuid4())
        result2 = await run_ingestion(job_id2, "attention mechanism", 2024, 2024, 5, ["arxiv"])

    assert len(result1) >= 1
    assert arxiv_call_count == first_count
