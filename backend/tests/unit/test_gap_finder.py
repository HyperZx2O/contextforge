import json
import uuid
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from contextlib import asynccontextmanager


_VALID_GAP_RESPONSE = json.dumps({
    "description": "These two papers present conflicting findings on retrieval accuracy under long context conditions. No subsequent work has reconciled this discrepancy.",
    "severity": 0.84,
})

_INVALID_SEVERITY_RESPONSE = json.dumps({
    "description": "Some gap description here.",
    "severity": 2.5,
})

_EMPTY_DESC_RESPONSE = json.dumps({
    "description": "",
    "severity": 0.5,
})


class _FakeSession:
    def __init__(self):
        self.execute_calls = []
        self.commit_count = 0

    async def execute(self, query):
        self.execute_calls.append(query)
        return MagicMock()

    async def commit(self):
        self.commit_count += 1


@asynccontextmanager
async def _fake_session_factory():
    yield _FakeSession()


MOCK_CONTRADICTION_RESULTS = [
    {
        "paper_a": "2401.00001",
        "title_a": "Paper A on RAG",
        "paper_b": "2401.00002",
        "title_b": "Paper B on RAG",
        "dimension": "retrieval_accuracy",
        "evidence": "We find a significant drop.",
        "confidence": 0.91,
    }
]

MOCK_LOW_DENSITY_RESULTS = [
    {"arxiv_id": "2401.00010", "title": "Sparse Paper", "degree": 1, "avg_degree": 5.0},
]

MOCK_STALE_RESULTS = [
    {"arxiv_id": "2001.00001", "title": "Old Paper", "publish_date": "2020-01-01", "years_since": 6},
]

MOCK_BRIDGE_RESULTS = [
    {"arxiv_id_a": "2401.00001", "title_a": "Paper A", "arxiv_id_b": "2401.00099", "title_b": "Paper B", "path_length": 7},
]


@pytest.mark.asyncio
async def test_find_unresolved_contradictions():
    with patch("agents.gap_finder.execute_query", new_callable=AsyncMock) as mock_eq:
        mock_eq.return_value = MOCK_CONTRADICTION_RESULTS
        from agents.gap_finder import find_unresolved_contradictions
        results = await find_unresolved_contradictions()

    assert len(results) == 1
    assert results[0]["paper_a"] == "2401.00001"
    assert results[0]["confidence"] == 0.91
    mock_eq.assert_called_once()


@pytest.mark.asyncio
async def test_find_low_density_gaps():
    with patch("agents.gap_finder.execute_query", new_callable=AsyncMock) as mock_eq:
        mock_eq.return_value = MOCK_LOW_DENSITY_RESULTS
        from agents.gap_finder import find_low_density_gaps
        results = await find_low_density_gaps()

    assert len(results) == 1
    assert results[0]["degree"] == 1
    mock_eq.assert_called_once()


@pytest.mark.asyncio
async def test_gap_finder_writes_gap_node():
    with (
        patch("agents.gap_finder._get_session_maker") as mock_sm,
        patch("agents.gap_finder.execute_query", new_callable=AsyncMock) as mock_eq,
        patch("agents.gap_finder.call_llm", new_callable=AsyncMock) as mock_llm,
    ):
        mock_llm.return_value = _VALID_GAP_RESPONSE

        call_count = 0

        def eq_side_effect(cypher, params=None):
            nonlocal call_count
            call_count += 1
            if call_count <= 4:
                if "CONTRADICTS" in cypher:
                    return MOCK_CONTRADICTION_RESULTS
                if "degree" in cypher.lower() or "degree" in (cypher + str(params)):
                    return MOCK_LOW_DENSITY_RESULTS
                if "duration" in cypher:
                    return MOCK_STALE_RESULTS
                if "shortestPath" in cypher:
                    return MOCK_BRIDGE_RESULTS
                return []
            return [{"g": {}}]

        mock_eq.side_effect = eq_side_effect
        mock_sm.return_value = lambda: _fake_session_factory()

        from agents.gap_finder import run_gap_finder

        job_id = str(uuid.uuid4())
        count = await run_gap_finder(job_id)

        assert count >= 1
        assert mock_llm.call_count >= 1

        gap_write_calls = [
            c for c in mock_eq.call_args_list
            if "Gap" in str(c) and "CREATE" in str(c)
        ]
        assert len(gap_write_calls) >= 1


@pytest.mark.asyncio
async def test_gap_finder_status_done():
    with (
        patch("agents.gap_finder._get_session_maker") as mock_sm,
        patch("agents.gap_finder.execute_query", new_callable=AsyncMock) as mock_eq,
        patch("agents.gap_finder.call_llm", new_callable=AsyncMock) as mock_llm,
        patch("agents.gap_finder._settings") as mock_settings,
    ):
        mock_llm.return_value = _VALID_GAP_RESPONSE
        mock_settings.return_value = MagicMock(GAP_TEMPORAL_YEARS=5)

        call_count = 0

        def eq_side_effect(cypher, params=None):
            nonlocal call_count
            call_count += 1
            if call_count <= 4:
                if "CONTRADICTS" in cypher:
                    return MOCK_CONTRADICTION_RESULTS
                if "duration" in cypher:
                    return MOCK_STALE_RESULTS
                return []
            return [{"g": {}}]

        mock_eq.side_effect = eq_side_effect

        session = _FakeSession()

        @asynccontextmanager
        async def _fixed_factory():
            yield session

        mock_sm.return_value = _fixed_factory

        from agents.gap_finder import run_gap_finder

        job_id = str(uuid.uuid4())
        count = await run_gap_finder(job_id)

        assert len(session.execute_calls) >= 2
        assert session.commit_count >= 2


@pytest.mark.asyncio
async def test_gap_finder_llm_failure_skips():
    with (
        patch("agents.gap_finder._get_session_maker") as mock_sm,
        patch("agents.gap_finder.execute_query", new_callable=AsyncMock) as mock_eq,
        patch("agents.gap_finder.call_llm", new_callable=AsyncMock) as mock_llm,
    ):
        mock_llm.side_effect = Exception("LLM unavailable")

        call_count = 0

        def eq_side_effect(cypher, params=None):
            nonlocal call_count
            call_count += 1
            if call_count <= 4:
                if "CONTRADICTS" in cypher:
                    return MOCK_CONTRADICTION_RESULTS
                return []
            return []

        mock_eq.side_effect = eq_side_effect
        mock_sm.return_value = lambda: _fake_session_factory()

        from agents.gap_finder import run_gap_finder

        job_id = str(uuid.uuid4())
        count = await run_gap_finder(job_id)

        assert count == 0


@pytest.mark.asyncio
async def test_gap_finder_empty_graph():
    with (
        patch("agents.gap_finder._get_session_maker") as mock_sm,
        patch("agents.gap_finder.execute_query", new_callable=AsyncMock) as mock_eq,
        patch("agents.gap_finder.call_llm", new_callable=AsyncMock) as mock_llm,
    ):
        mock_eq.return_value = []
        mock_sm.return_value = lambda: _fake_session_factory()

        from agents.gap_finder import run_gap_finder

        job_id = str(uuid.uuid4())
        count = await run_gap_finder(job_id)

        assert count == 0
        mock_llm.assert_not_called()
