import uuid
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from contextlib import asynccontextmanager


def _make_paper(abstract: str):
    paper = MagicMock()
    paper.id = uuid.uuid4()
    paper.abstract = abstract
    return paper


class _FakeSession:
    def __init__(self, existing_entities=None):
        self._existing_entities = existing_entities or []
        self._commit_count = 0
        self.execute_calls = []

    async def execute(self, query):
        self.execute_calls.append(query)
        n = len(self.execute_calls)
        if n == 1:
            return MagicMock()
        if n == 2:
            paper = _make_paper(
                "We fine-tune BERT on the SQuAD dataset. "
                "arXiv:2301.00001 and https://github.com/test/repo are referenced."
            )
            result = MagicMock()
            result.scalar_one_or_none.return_value = paper
            return result
        if n == 3:
            return MagicMock()
        result = MagicMock()
        result.scalars.return_value.all.return_value = self._existing_entities
        return result

    async def commit(self):
        self._commit_count += 1


@asynccontextmanager
async def _fake_session_factory(existing_entities=None):
    yield _FakeSession(existing_entities)


def _emb_side_effect(responses):
    idx = [0]

    def side_effect(texts):
        r = responses[min(idx[0], len(responses) - 1)]
        idx[0] += 1
        return [r]

    return side_effect


@pytest.mark.asyncio
async def test_extractor_writes_new_entity():
    with (
        patch("agents.extractor._get_session_maker") as mock_sm,
        patch("agents.extractor.extract_entities") as mock_ner,
        patch("agents.extractor.embed") as mock_emb,
    ):
        mock_ner.return_value = [{"entity_type": "Method", "name": "BERT"}]
        mock_emb.side_effect = _emb_side_effect([[0.1, 0.2, 0.3]])
        mock_sm.return_value = lambda: _fake_session_factory()

        from agents.extractor import run_extraction

        job_id = str(uuid.uuid4())
        paper_id = str(uuid.uuid4())
        entity_ids = await run_extraction(job_id, [paper_id])

        assert len(entity_ids) >= 1
        mock_ner.assert_called_once()


@pytest.mark.asyncio
async def test_extractor_deduplicates():
    with (
        patch("agents.extractor._get_session_maker") as mock_sm,
        patch("agents.extractor.extract_entities") as mock_ner,
        patch("agents.extractor.embed") as mock_emb,
    ):
        mock_ner.return_value = [{"entity_type": "Method", "name": "BERT"}]
        mock_emb.side_effect = _emb_side_effect([[0.1, 0.2, 0.3]])

        existing = MagicMock()
        existing.id = uuid.uuid4()
        existing.entity_type = "Method"
        existing.embedding = [0.1, 0.2, 0.3]

        mock_sm.return_value = lambda: _fake_session_factory([existing])

        from agents.extractor import run_extraction

        job_id = str(uuid.uuid4())
        paper_id = str(uuid.uuid4())
        entity_ids = await run_extraction(job_id, [paper_id])

        assert len(entity_ids) == 0


@pytest.mark.asyncio
async def test_extractor_status_transition():
    with (
        patch("agents.extractor._get_session_maker") as mock_sm,
        patch("agents.extractor.extract_entities") as mock_ner,
        patch("agents.extractor.embed") as mock_emb,
    ):
        mock_ner.return_value = [{"entity_type": "Method", "name": "BERT"}]
        mock_emb.side_effect = _emb_side_effect([[0.1, 0.2, 0.3]])

        session_ref = [None]

        @asynccontextmanager
        async def _capturing_factory(existing_entities=None):
            s = _FakeSession(existing_entities)
            session_ref[0] = s
            yield s

        mock_sm.return_value = _capturing_factory

        from agents.extractor import run_extraction

        job_id = str(uuid.uuid4())
        paper_id = str(uuid.uuid4())
        await run_extraction(job_id, [paper_id])

        assert len(session_ref[0].execute_calls) >= 3
        assert session_ref[0]._commit_count >= 2


@pytest.mark.asyncio
async def test_extractor_regex_finds_arxiv():
    with (
        patch("agents.extractor._get_session_maker") as mock_sm,
        patch("agents.extractor.extract_entities") as mock_ner,
        patch("agents.extractor.embed") as mock_emb,
    ):
        mock_ner.return_value = []
        mock_emb.side_effect = _emb_side_effect([[0.5, 0.5, 0.0]])
        mock_sm.return_value = lambda: _fake_session_factory()

        from agents.extractor import run_extraction

        job_id = str(uuid.uuid4())
        paper_id = str(uuid.uuid4())
        entity_ids = await run_extraction(job_id, [paper_id])

        assert len(entity_ids) >= 1
