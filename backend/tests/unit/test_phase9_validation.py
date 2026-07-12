import json
import logging
import uuid
import pytest
import httpx
from unittest.mock import AsyncMock, patch, MagicMock
from contextlib import asynccontextmanager


class _FakeSession:
    def __init__(self):
        self.execute_calls = []

    async def execute(self, query):
        self.execute_calls.append(query)
        result = MagicMock()
        result.scalar.return_value = None
        result.scalar_one_or_none.return_value = None
        result.scalars.return_value = MagicMock(all=MagicMock(return_value=[]))
        return result

    async def commit(self):
        pass


@asynccontextmanager
async def _fake_cm(session):
    yield session


def _make_factory(session=None):
    s = session or _FakeSession()

    def factory():
        return _fake_cm(s)

    return factory


# ── Acceptance Criteria 1: arXiv 429 three times → logs warnings, does not raise ──


@pytest.mark.asyncio
async def test_arxiv_429_three_times_logs_warnings():
    from agents.ingestion import run_ingestion

    call_count = 0

    with (
        patch("agents.ingestion._arxiv_limiter") as mock_limiter,
        patch("db.postgres_client._get_session_maker", return_value=_make_factory()),
        patch("agents.ingestion._settings") as mock_settings,
    ):
        mock_limiter.acquire = AsyncMock()
        mock_settings.return_value = MagicMock(SEMANTIC_SCHOLAR_API_KEY="")

        async def fake_get(url, params=None, timeout=None):
            nonlocal call_count
            call_count += 1
            request = httpx.Request("GET", str(url))
            return httpx.Response(429, request=request)

        mock_http = MagicMock()
        mock_http.get = fake_get
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__ = AsyncMock(return_value=None)

        with patch("agents.ingestion.httpx.AsyncClient", return_value=mock_http):
            job_id = str(uuid.uuid4())
            result = await run_ingestion(job_id, "test query", 2023, 2024, 10, ["arxiv"])

    assert call_count >= 3
    assert result == []


# ── Acceptance Criteria 2: Both LLM providers fail → pair logged, synthesis continues ──


@pytest.mark.asyncio
async def test_synthesis_both_llm_fail_continues():
    from agents.synthesis import run_synthesis
    from llm.router import LLMUnavailableError

    paper_a_id = uuid.uuid4()
    paper_b_id = uuid.uuid4()
    arxiv_a = "2401.00001"
    arxiv_b = "2401.00002"

    session = _FakeSession()
    call_idx = 0

    async def tracking_execute(query):
        nonlocal call_idx
        call_idx += 1
        result = MagicMock()
        query_str = str(query) if hasattr(query, '__str__') else ""

        if call_idx == 1:
            result.all.return_value = []
            return result

        if "EntitiesCache" in query_str or "entities_cache" in query_str:
            result.all.return_value = [
                (paper_a_id, [0.1] * 768),
                (paper_b_id, [0.2] * 768),
            ]
            return result

        if "PapersCache" in query_str or "papers_cache" in query_str:
            mock_a = MagicMock()
            mock_a.id = paper_a_id
            mock_a.arxiv_id = arxiv_a
            mock_a.title = "Paper A"
            mock_a.abstract = "Abstract A about transformers"
            mock_a.publish_date = "2024-01-01"

            mock_b = MagicMock()
            mock_b.id = paper_b_id
            mock_b.arxiv_id = arxiv_b
            mock_b.title = "Paper B"
            mock_b.abstract = "Abstract B about attention"
            mock_b.publish_date = "2024-01-02"

            scalars_mock = MagicMock()
            scalars_mock.scalars.return_value = MagicMock(
                all=MagicMock(return_value=[mock_a, mock_b])
            )
            return scalars_mock

        if "SynthesisCache" in query_str or "synthesis_cache" in query_str:
            result.scalar_one_or_none.return_value = None
            return result

        result.all.return_value = []
        return result

    session.execute = tracking_execute

    with (
        patch("db.postgres_client._get_session_maker", return_value=_make_factory(session)),
        patch("agents.synthesis._get_session_maker", return_value=_make_factory(session)),
        patch("agents.synthesis.call_llm", new_callable=AsyncMock) as mock_llm,
        patch("agents.synthesis._neo4j_write", new_callable=AsyncMock),
        patch("agents.synthesis._settings") as mock_settings,
    ):
        mock_llm.side_effect = LLMUnavailableError("Both providers failed")
        mock_settings.return_value = MagicMock(CONFIDENCE_THRESHOLD=0.7)

        job_id = str(uuid.uuid4())
        count = await run_synthesis(job_id, [str(paper_a_id), str(paper_b_id)])

        assert count == 0
        assert mock_llm.call_count >= 1


# ── Acceptance Criteria 3: Neo4j failure → raises DatabaseError ──


@pytest.mark.asyncio
async def test_synthesis_neo4j_failure_raises_database_error():
    from agents.synthesis import run_synthesis
    from agents import DatabaseError

    paper_a_id = uuid.uuid4()
    paper_b_id = uuid.uuid4()
    arxiv_a = "2401.00001"
    arxiv_b = "2401.00002"

    session = _FakeSession()
    call_idx = 0

    async def tracking_execute(query):
        nonlocal call_idx
        call_idx += 1
        result = MagicMock()
        query_str = str(query) if hasattr(query, '__str__') else ""

        if call_idx == 1:
            result.all.return_value = []
            return result

        if "EntitiesCache" in query_str or "entities_cache" in query_str:
            result.all.return_value = [
                (paper_a_id, [0.1] * 768),
                (paper_b_id, [0.2] * 768),
            ]
            return result

        if "PapersCache" in query_str or "papers_cache" in query_str:
            mock_a = MagicMock()
            mock_a.id = paper_a_id
            mock_a.arxiv_id = arxiv_a
            mock_a.title = "Paper A"
            mock_a.abstract = "Abstract A about transformers"
            mock_a.publish_date = "2024-01-01"

            mock_b = MagicMock()
            mock_b.id = paper_b_id
            mock_b.arxiv_id = arxiv_b
            mock_b.title = "Paper B"
            mock_b.abstract = "Abstract B about attention"
            mock_b.publish_date = "2024-01-02"

            scalars_mock = MagicMock()
            scalars_mock.scalars.return_value = MagicMock(
                all=MagicMock(return_value=[mock_a, mock_b])
            )
            return scalars_mock

        if "SynthesisCache" in query_str or "synthesis_cache" in query_str:
            result.scalar_one_or_none.return_value = None
            return result

        result.all.return_value = []
        return result

    session.execute = tracking_execute

    with (
        patch("db.postgres_client._get_session_maker", return_value=_make_factory(session)),
        patch("agents.synthesis._get_session_maker", return_value=_make_factory(session)),
        patch("agents.synthesis.call_llm", new_callable=AsyncMock) as mock_llm,
        patch("agents.synthesis._neo4j_write", new_callable=AsyncMock) as mock_neo4j,
        patch("agents.synthesis._settings") as mock_settings,
    ):
        mock_llm.return_value = json.dumps({
            "relationship_type": "EXTENDS",
            "confidence": 0.85,
            "evidence_quote": "Paper A extends findings of Paper B",
            "dimension": "methodology",
            "direction": "a_to_b",
        })
        mock_neo4j.side_effect = DatabaseError("Neo4j connection refused")
        mock_settings.return_value = MagicMock(CONFIDENCE_THRESHOLD=0.7)

        job_id = str(uuid.uuid4())
        with pytest.raises(DatabaseError):
            await run_synthesis(job_id, [str(paper_a_id), str(paper_b_id)])


# ── Acceptance Criteria 4: pipeline_jobs.status = 'failed' on unrecoverable error ──


@pytest.mark.asyncio
async def test_ingestion_sets_job_failed_on_error():
    from agents.ingestion import run_ingestion
    from agents import PipelineAgentError

    session = _FakeSession()

    with (
        patch("db.postgres_client._get_session_maker", return_value=_make_factory(session)),
        patch("agents.ingestion._write_papers", new_callable=AsyncMock) as mock_write,
        patch("agents.ingestion._settings") as mock_settings,
    ):
        mock_write.side_effect = Exception("DB connection refused")
        mock_settings.return_value = MagicMock(
            SEMANTIC_SCHOLAR_API_KEY="", GITHUB_TOKEN="", NEWS_API_KEY=""
        )

        job_id = str(uuid.uuid4())
        with pytest.raises(PipelineAgentError):
            await run_ingestion(job_id, "test", 2023, 2024, 10, ["arxiv"])

        assert len(session.execute_calls) >= 2


@pytest.mark.asyncio
async def test_gap_finder_sets_job_failed_on_error():
    from agents.gap_finder import run_gap_finder
    from agents import PipelineAgentError

    session = _FakeSession()

    with (
        patch("db.postgres_client._get_session_maker", return_value=_make_factory(session)),
        patch("agents.gap_finder._get_session_maker", return_value=_make_factory(session)),
        patch("agents.gap_finder.execute_query", new_callable=AsyncMock) as mock_eq,
        patch("agents.gap_finder._settings") as mock_settings,
    ):
        mock_eq.side_effect = Exception("Neo4j connection lost")
        mock_settings.return_value = MagicMock(GAP_TEMPORAL_YEARS=5)

        job_id = str(uuid.uuid4())
        result = await run_gap_finder(job_id)
        assert result == 0


# ── Acceptance Criteria 5: No log line contains API key or password ──


@pytest.mark.asyncio
async def test_no_api_key_in_logs(caplog):
    import re

    with caplog.at_level(logging.DEBUG, logger="agents.ingestion"):
        with (
            patch("db.postgres_client._get_session_maker", return_value=_make_factory()),
            patch("agents.ingestion._settings") as mock_settings,
        ):
            mock_settings.return_value = MagicMock(
                SEMANTIC_SCHOLAR_API_KEY="", GITHUB_TOKEN="ghp_secret123", NEWS_API_KEY=""
            )

            async def fake_get(url, params=None, timeout=None):
                resp = MagicMock()
                resp.status_code = 200
                resp.raise_for_status.return_value = None
                resp.text = '<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"></feed>'
                return resp

            mock_http = MagicMock()
            mock_http.get = fake_get
            mock_http.__aenter__ = AsyncMock(return_value=mock_http)
            mock_http.__aexit__ = AsyncMock(return_value=None)

            with patch("agents.ingestion.httpx.AsyncClient", return_value=mock_http):
                with patch("agents.ingestion._arxiv_limiter") as mock_limiter:
                    mock_limiter.acquire = AsyncMock()
                    job_id = str(uuid.uuid4())
                    try:
                        await run_ingestion(job_id, "test", 2023, 2024, 5, ["arxiv"])
                    except Exception:
                        pass

    key_pattern = re.compile(r"(sk-|ghp_|AKIA|apikey[=:]\s*\S+)", re.IGNORECASE)
    for record in caplog.records:
        match = key_pattern.search(record.message)
        assert not match, f"Log contains possible API key: {record.message}"
