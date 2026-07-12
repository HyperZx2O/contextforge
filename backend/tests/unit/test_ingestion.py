import pytest
import httpx
from unittest.mock import patch, MagicMock

from agents.ingestion import (
    _fetch_arxiv_page,
    _fetch_github,
    _fetch_newsapi,
    _enrich_semantic_scholar,
)

ARXIV_XML = """<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2301.00001v1</id>
    <title>Test Paper One</title>
    <summary>We propose a novel method for attention.</summary>
    <published>2023-01-15T00:00:00Z</published>
    <author><name>Alice Smith</name></author>
  </entry>
  <entry>
    <id>http://arxiv.org/abs/2301.00002v1</id>
    <title>Test Paper Two</title>
    <summary>BERT achieves strong results on NLU benchmarks.</summary>
    <published>2023-02-20T00:00:00Z</published>
    <author><name>Bob Jones</name></author>
  </entry>
  <entry>
    <id>http://arxiv.org/abs/2301.00003v1</id>
    <title>Test Paper Three</title>
    <summary>We evaluate transformer variants on GLUE.</summary>
    <published>2023-03-10T00:00:00Z</published>
    <author><name>Carol Lee</name></author>
  </entry>
  <entry>
    <id>http://arxiv.org/abs/2301.00004v1</id>
    <title>Test Paper Four</title>
    <summary>Diffusion models for image generation.</summary>
    <published>2023-04-05T00:00:00Z</published>
    <author><name>Dave Kim</name></author>
  </entry>
  <entry>
    <id>http://arxiv.org/abs/2301.00005v1</id>
    <title>Test Paper Five</title>
    <summary>Scaling laws for neural language models.</summary>
    <published>2023-05-01T00:00:00Z</published>
    <author><name>Eve Wang</name></author>
  </entry>
</feed>"""


def _mock_settings(**overrides):
    m = MagicMock()
    for attr, val in overrides.items():
        setattr(m, attr, val)
    return m


def _mock_transport_arxiv(request):
    if "export.arxiv.org" in str(request.url):
        return httpx.Response(200, text=ARXIV_XML)
    return httpx.Response(404)


@pytest.mark.asyncio
async def test_fetch_arxiv_success():
    transport = httpx.MockTransport(_mock_transport_arxiv)
    async with httpx.AsyncClient(transport=transport) as client:
        papers = await _fetch_arxiv_page(client, "test", 2023, 2023, 0, 10)
    assert len(papers) == 5
    assert papers[0]["arxiv_id"] == "2301.00001v1"
    assert papers[0]["title"] == "Test Paper One"
    assert papers[0]["source"] == "arxiv"
    assert len(papers[0]["authors"]) == 1
    assert papers[0]["authors"][0]["name"] == "Alice Smith"


@pytest.mark.asyncio
async def test_fetch_arxiv_429_retry():
    call_count = 0

    def _transport(request):
        nonlocal call_count
        call_count += 1
        if call_count <= 2:
            return httpx.Response(429)
        return httpx.Response(200, text=ARXIV_XML)

    transport = httpx.MockTransport(_transport)
    async with httpx.AsyncClient(transport=transport) as client:
        papers = await _fetch_arxiv_page(client, "test", 2023, 2023, 0, 10)
    assert len(papers) == 5
    assert call_count == 3


@pytest.mark.asyncio
async def test_fetch_arxiv_empty():
    empty_xml = """<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
</feed>"""

    def _transport(request):
        return httpx.Response(200, text=empty_xml)

    transport = httpx.MockTransport(_transport)
    async with httpx.AsyncClient(transport=transport) as client:
        papers = await _fetch_arxiv_page(client, "test", 2023, 2023, 0, 10)
    assert len(papers) == 0


@pytest.mark.asyncio
async def test_enrich_semantic_scholar():
    with patch("agents.ingestion._settings") as mock_settings:
        mock_settings.return_value = _mock_settings(SEMANTIC_SCHOLAR_API_KEY="test_key")

        def _transport(request):
            if "semanticscholar.org" in str(request.url):
                return httpx.Response(200, json={"citationCount": 42, "authors": []})
            return httpx.Response(404)

        transport = httpx.MockTransport(_transport)
        async with httpx.AsyncClient(transport=transport) as client:
            papers = [{"arxiv_id": "2301.00001", "title": "Test"}]
            enriched = await _enrich_semantic_scholar(client, papers)
        assert enriched[0]["citation_count"] == 42


@pytest.mark.asyncio
async def test_enrich_ss_429_skip():
    with patch("agents.ingestion._settings") as mock_settings:
        mock_settings.return_value = _mock_settings(SEMANTIC_SCHOLAR_API_KEY="test_key")

        def _transport(request):
            return httpx.Response(429)

        transport = httpx.MockTransport(_transport)
        async with httpx.AsyncClient(transport=transport) as client:
            papers = [{"arxiv_id": "2301.00001", "title": "Test"}]
            enriched = await _enrich_semantic_scholar(client, papers)
        assert len(enriched) == 1
        assert "citation_count" not in enriched[0]


@pytest.mark.asyncio
async def test_enrich_ss_no_key():
    with patch("agents.ingestion._settings") as mock_settings:
        mock_settings.return_value = _mock_settings(SEMANTIC_SCHOLAR_API_KEY="")
        async with httpx.AsyncClient() as client:
            papers = [{"arxiv_id": "2301.00001", "title": "Test"}]
            enriched = await _enrich_semantic_scholar(client, papers)
        assert enriched == papers


@pytest.mark.asyncio
async def test_fetch_github_success():
    search_resp = {
        "items": [
            {
                "owner": {"login": "testuser"},
                "name": "testrepo",
                "html_url": "https://github.com/testuser/testrepo",
                "description": "A test repo",
                "created_at": "2023-01-01T00:00:00Z",
            }
        ]
    }

    def _transport(request):
        url = str(request.url)
        if "search/repositories" in url:
            return httpx.Response(200, json=search_resp)
        if "repos/testuser/testrepo/readme" in url:
            return httpx.Response(200, content=b"Test README content")
        return httpx.Response(404)

    with patch("agents.ingestion._settings") as mock_settings:
        mock_settings.return_value = _mock_settings(GITHUB_TOKEN="test_token")
        transport = httpx.MockTransport(_transport)
        async with httpx.AsyncClient(transport=transport) as client:
            papers = await _fetch_github(client, "test")
    assert len(papers) == 1
    assert papers[0]["source"] == "github"
    assert papers[0]["title"] == "testuser/testrepo"
    assert "Test README" in papers[0]["abstract"]


@pytest.mark.asyncio
async def test_fetch_github_403_skip():
    def _transport(request):
        return httpx.Response(403)

    with patch("agents.ingestion._settings") as mock_settings:
        mock_settings.return_value = _mock_settings(GITHUB_TOKEN="test_token")
        transport = httpx.MockTransport(_transport)
        async with httpx.AsyncClient(transport=transport) as client:
            papers = await _fetch_github(client, "test")
    assert papers == []


@pytest.mark.asyncio
async def test_fetch_newsapi_success():
    news_resp = {
        "articles": [
            {
                "title": "AI News",
                "description": "Latest in AI",
                "url": "https://example.com/ai",
                "publishedAt": "2023-06-15T10:00:00Z",
                "author": "Reporter",
            }
        ]
    }

    def _transport(request):
        if "newsapi.org" in str(request.url):
            return httpx.Response(200, json=news_resp)
        return httpx.Response(404)

    with patch("agents.ingestion._settings") as mock_settings:
        mock_settings.return_value = _mock_settings(NEWS_API_KEY="test_key")
        transport = httpx.MockTransport(_transport)
        async with httpx.AsyncClient(transport=transport) as client:
            papers = await _fetch_newsapi(client, "test", 2023)
    assert len(papers) == 1
    assert papers[0]["source"] == "news"
    assert papers[0]["title"] == "AI News"


@pytest.mark.asyncio
async def test_fetch_newsapi_error_skip():
    def _transport(request):
        return httpx.Response(500)

    with patch("agents.ingestion._settings") as mock_settings:
        mock_settings.return_value = _mock_settings(NEWS_API_KEY="test_key")
        transport = httpx.MockTransport(_transport)
        async with httpx.AsyncClient(transport=transport) as client:
            papers = await _fetch_newsapi(client, "test", 2023)
    assert papers == []


@pytest.mark.asyncio
async def test_fetch_newsapi_no_key():
    with patch("agents.ingestion._settings") as mock_settings:
        mock_settings.return_value = _mock_settings(NEWS_API_KEY="")
        async with httpx.AsyncClient() as client:
            papers = await _fetch_newsapi(client, "test", 2023)
    assert papers == []
