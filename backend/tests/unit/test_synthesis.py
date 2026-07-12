import json
import uuid
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from contextlib import asynccontextmanager


class _FakeSession:
    def __init__(self, entities=None, papers=None, cache_entries=None):
        self._entities = entities or []
        self._papers = papers or []
        self._cache_entries = list(cache_entries or [])
        self.execute_calls = []
        self.commit_count = 0

    async def execute(self, query):
        self.execute_calls.append(query)
        stmt_str = str(query)

        if "entities_cache" in stmt_str and "paper_id" in stmt_str:
            result = MagicMock()
            result.all.return_value = self._entities
            return result

        if "papers_cache" in stmt_str and "id" in stmt_str and "SELECT" in stmt_str:
            result = MagicMock()
            result.scalars.return_value.all.return_value = self._papers
            return result

        if "synthesis_cache" in stmt_str and "cache_key" in stmt_str:
            if self._cache_entries:
                entry = self._cache_entries.pop(0)
                result = MagicMock()
                result.scalar_one_or_none.return_value = entry
                return result
            result = MagicMock()
            result.scalar_one_or_none.return_value = None
            return result

        return MagicMock()

    async def commit(self):
        self.commit_count += 1


def _make_paper(arxiv_id, title="Test Paper", abstract="Test abstract"):
    p = MagicMock()
    p.id = uuid.uuid4()
    p.arxiv_id = arxiv_id
    p.title = title
    p.abstract = abstract
    p.publish_date = "2024-01-15"
    return p


_VALID_LLM_RESPONSE = json.dumps({
    "relationship_type": "CONTRADICTS",
    "confidence": 0.91,
    "evidence_quote": "We find a significant drop in accuracy.",
    "dimension": "retrieval_accuracy",
    "direction": "b_to_a",
})

_LOW_CONF_RESPONSE = json.dumps({
    "relationship_type": "CITES",
    "confidence": 0.5,
    "evidence_quote": "This paper references prior work.",
    "dimension": "general",
    "direction": "a_to_b",
})


@asynccontextmanager
async def _fake_session_factory(**kwargs):
    yield _FakeSession(**kwargs)


@pytest.mark.asyncio
async def test_llm_fallback_to_openrouter():
    from llm import GroqError
    from llm.router import call_llm

    with patch("llm.router.call_groq", new_callable=AsyncMock) as mock_groq:
        mock_groq.side_effect = GroqError("timeout")
        with patch("llm.router.call_openrouter", new_callable=AsyncMock) as mock_or:
            mock_or.return_value = '{"relationship_type": "CITES"}'
            result = await call_llm("system", "user")

    assert result == '{"relationship_type": "CITES"}'
    mock_groq.assert_called_once()
    mock_or.assert_called_once()


@pytest.mark.asyncio
async def test_both_providers_fail_raises():
    from llm import GroqError, OpenRouterError
    from agents import LLMUnavailableError
    from llm.router import call_llm

    with patch("llm.router.call_groq", new_callable=AsyncMock) as mock_groq:
        mock_groq.side_effect = GroqError("timeout")
        with patch("llm.router.call_openrouter", new_callable=AsyncMock) as mock_or:
            mock_or.side_effect = OpenRouterError("down")
            with pytest.raises(LLMUnavailableError):
                await call_llm("system", "user")


@pytest.mark.asyncio
async def test_synthesis_valid_response_writes_neo4j():
    paper_a = _make_paper("2401.00001", "Paper A", "We find accuracy drops.")
    paper_b = _make_paper("2401.00002", "Paper B", "We confirm accuracy holds.")

    emb_a = [1.0] + [0.0] * 767
    emb_b = [0.99] + [0.01] * 767

    entities = [
        (paper_a.id, emb_a),
        (paper_b.id, emb_b),
    ]

    with (
        patch("agents.synthesis._get_session_maker") as mock_sm,
        patch("agents.synthesis.execute_query", new_callable=AsyncMock) as mock_neo4j,
        patch("agents.synthesis.call_llm", new_callable=AsyncMock) as mock_llm,
        patch("agents.synthesis._settings") as mock_settings,
    ):
        mock_settings_obj = MagicMock()
        mock_settings_obj.CONFIDENCE_THRESHOLD = 0.7
        mock_settings.return_value = mock_settings_obj
        mock_llm.return_value = _VALID_LLM_RESPONSE
        mock_neo4j.return_value = [{"r": {}}]
        mock_sm.return_value = lambda: _fake_session_factory(
            entities=entities, papers=[paper_a, paper_b]
        )

        from agents.synthesis import run_synthesis

        job_id = str(uuid.uuid4())
        count = await run_synthesis(job_id, [str(paper_a.id), str(paper_b.id)])

        assert count >= 1
        mock_llm.assert_called_once()
        assert mock_neo4j.call_count >= 1


@pytest.mark.asyncio
async def test_synthesis_cache_hit_skips_llm():
    paper_a = _make_paper("2401.00001")
    paper_b = _make_paper("2401.00002")

    emb_a = [1.0] + [0.0] * 767
    emb_b = [0.99] + [0.01] * 767

    entities = [
        (paper_a.id, emb_a),
        (paper_b.id, emb_b),
    ]

    cached_entry = MagicMock()
    cached_entry.relationship_type = "CITES"
    cached_entry.confidence = 0.95
    cached_entry.llm_response = {
        "direction": "a_to_b",
        "evidence_quote": "cached quote",
        "dimension": "test",
    }

    with (
        patch("agents.synthesis._get_session_maker") as mock_sm,
        patch("agents.synthesis.execute_query", new_callable=AsyncMock) as mock_neo4j,
        patch("agents.synthesis.call_llm", new_callable=AsyncMock) as mock_llm,
        patch("agents.synthesis._settings") as mock_settings,
    ):
        mock_settings_obj = MagicMock()
        mock_settings_obj.CONFIDENCE_THRESHOLD = 0.7
        mock_settings.return_value = mock_settings_obj
        mock_neo4j.return_value = [{"r": {}}]
        mock_sm.return_value = lambda: _fake_session_factory(
            entities=entities,
            papers=[paper_a, paper_b],
            cache_entries=[cached_entry],
        )

        from agents.synthesis import run_synthesis

        job_id = str(uuid.uuid4())
        count = await run_synthesis(job_id, [str(paper_a.id), str(paper_b.id)])

        assert count >= 1
        mock_llm.assert_not_called()


@pytest.mark.asyncio
async def test_synthesis_low_confidence_discarded():
    paper_a = _make_paper("2401.00001")
    paper_b = _make_paper("2401.00002")

    emb_a = [1.0] + [0.0] * 767
    emb_b = [0.99] + [0.01] * 767

    entities = [
        (paper_a.id, emb_a),
        (paper_b.id, emb_b),
    ]

    with (
        patch("agents.synthesis._get_session_maker") as mock_sm,
        patch("agents.synthesis.execute_query", new_callable=AsyncMock) as mock_neo4j,
        patch("agents.synthesis.call_llm", new_callable=AsyncMock) as mock_llm,
        patch("agents.synthesis._settings") as mock_settings,
    ):
        mock_settings_obj = MagicMock()
        mock_settings_obj.CONFIDENCE_THRESHOLD = 0.7
        mock_settings.return_value = mock_settings_obj
        mock_llm.return_value = _LOW_CONF_RESPONSE
        mock_sm.return_value = lambda: _fake_session_factory(
            entities=entities, papers=[paper_a, paper_b]
        )

        from agents.synthesis import run_synthesis

        job_id = str(uuid.uuid4())
        count = await run_synthesis(job_id, [str(paper_a.id), str(paper_b.id)])

        assert count == 0
        mock_neo4j.assert_not_called()


@pytest.mark.asyncio
async def test_synthesis_invalid_json_retries():
    paper_a = _make_paper("2401.00001")
    paper_b = _make_paper("2401.00002")

    emb_a = [1.0] + [0.0] * 767
    emb_b = [0.99] + [0.01] * 767

    entities = [
        (paper_a.id, emb_a),
        (paper_b.id, emb_b),
    ]

    with (
        patch("agents.synthesis._get_session_maker") as mock_sm,
        patch("agents.synthesis.execute_query", new_callable=AsyncMock) as mock_neo4j,
        patch("agents.synthesis.call_llm", new_callable=AsyncMock) as mock_llm,
        patch("agents.synthesis._settings") as mock_settings,
    ):
        mock_settings_obj = MagicMock()
        mock_settings_obj.CONFIDENCE_THRESHOLD = 0.7
        mock_settings.return_value = mock_settings_obj
        mock_llm.side_effect = [
            "not valid json {{{",
            "also bad {{{{",
            _VALID_LLM_RESPONSE,
        ]
        mock_neo4j.return_value = [{"r": {}}]
        mock_sm.return_value = lambda: _fake_session_factory(
            entities=entities, papers=[paper_a, paper_b]
        )

        from agents.synthesis import run_synthesis

        job_id = str(uuid.uuid4())
        count = await run_synthesis(job_id, [str(paper_a.id), str(paper_b.id)])

        assert count >= 1
        assert mock_llm.call_count == 3
