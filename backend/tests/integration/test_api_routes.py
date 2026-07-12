import re
import uuid
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from neo4j.exceptions import Neo4jError
from starlette.testclient import TestClient

import config
from dependencies import get_db, get_neo4j
from main import app

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
TEST_API_KEY = "test-api-key-abc123"


async def _aiter(items):
    for item in items:
        yield item


def _make_neo4j_node(labels, props, element_id="elem-1"):
    from unittest.mock import MagicMock
    node = MagicMock()
    node.labels = set(labels)
    node.element_id = element_id
    node.__iter__ = lambda self: iter(props.items())
    node.__getitem__ = lambda self, k: props[k]
    node.get = props.get
    return node


def _make_record(**kwargs):
    rec = AsyncMock()
    rec.keys = lambda: kwargs.keys()
    rec.__getitem__ = lambda self, k, _kw=kwargs: _kw[k]
    return rec


async def _make_override(session):
    async def _override():
        yield session
    return _override


# ── Health ────────────────────────────────────────────────────────────────────

class TestHealth:
    @pytest.mark.asyncio
    async def test_health_200(self, client):
        resp = await client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["version"] == "1.0.0"

    @pytest.mark.asyncio
    async def test_health_has_request_id(self, client):
        resp = await client.get("/health")
        assert "x-request-id" in resp.headers
        uuid.UUID(resp.headers["x-request-id"])

    @pytest.mark.asyncio
    async def test_health_has_security_headers(self, client):
        resp = await client.get("/health")
        assert resp.headers.get("x-content-type-options") == "nosniff"
        assert resp.headers.get("x-frame-options") == "DENY"

    @pytest.mark.asyncio
    async def test_pipeline_run_get_returns_405(self, client):
        resp = await client.get("/pipeline/run")
        assert resp.status_code == 405


# ── CORS ──────────────────────────────────────────────────────────────────────

class TestCORS:
    @pytest.mark.asyncio
    async def test_allowed_origin(self, client):
        resp = await client.options("/health", headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        })
        assert resp.headers.get("access-control-allow-origin") == "http://localhost:3000"

    @pytest.mark.asyncio
    async def test_evil_origin_rejected(self, client):
        resp = await client.options("/health", headers={
            "Origin": "http://evil.com",
            "Access-Control-Request-Method": "GET",
        })
        assert resp.headers.get("access-control-allow-origin") != "http://evil.com"


# ── Pipeline ──────────────────────────────────────────────────────────────────

class TestPipeline:
    @pytest.mark.asyncio
    async def test_run_returns_202(self, client):
        resp = await client.post("/pipeline/run", json={"query": "retrieval augmented generation"})
        assert resp.status_code == 202
        data = resp.json()
        assert "job_id" in data
        assert data["status"] == "pending"
        uuid.UUID(data["job_id"])

    @pytest.mark.asyncio
    async def test_run_short_query_422(self, client):
        resp = await client.post("/pipeline/run", json={"query": "ab"})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_run_invalid_body_422(self, client):
        resp = await client.post("/pipeline/run", content="not json", headers={"content-type": "application/json"})
        assert resp.status_code == 422
        assert resp.json()["detail"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_run_empty_body_422(self, client):
        resp = await client.post("/pipeline/run", json={})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_status_returns_200(self, client):
        run_resp = await client.post("/pipeline/run", json={"query": "test status endpoint"})
        job_id = run_resp.json()["job_id"]
        resp = await client.get(f"/pipeline/status/{job_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["job_id"] == job_id
        assert data["status"] in ("pending", "ingesting", "done")
        assert "progress" in data
        assert "started_at" in data

    @pytest.mark.asyncio
    async def test_status_404_nonexistent(self, client):
        resp = await client.get(f"/pipeline/status/{uuid.uuid4()}")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_rate_limit_429(self, client):
        for i in range(5):
            resp = await client.post("/pipeline/run", json={"query": f"rate limit test {i}"})
            assert resp.status_code == 202
        resp = await client.post("/pipeline/run", json={"query": "rate limit test 6"})
        assert resp.status_code == 429
        assert resp.json()["detail"]["code"] == "RATE_LIMIT_EXCEEDED"


# ── Graph ─────────────────────────────────────────────────────────────────────

class TestGraphNodes:
    @pytest.mark.asyncio
    async def test_nodes_200(self, client):
        node = _make_neo4j_node(["Paper"], {"arxiv_id": "2401.12345", "title": "Test"})
        mock_session = AsyncMock()
        mock_session.run = AsyncMock(side_effect=[
            _aiter([_make_record(n=node)]),
            _aiter([_make_record(cnt=1)]),
        ])
        override = await _make_override(mock_session)
        app.dependency_overrides[get_neo4j] = override
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.get("/graph/nodes")
        app.dependency_overrides.pop(get_neo4j, None)
        assert resp.status_code == 200
        data = resp.json()
        assert "nodes" in data
        assert data["total"] == 1

    @pytest.mark.asyncio
    async def test_invalid_node_type_400(self, client):
        resp = await client.get("/graph/nodes?node_type=InvalidType")
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_valid_node_type_filter(self, client):
        mock_session = AsyncMock()
        mock_session.run = AsyncMock(side_effect=[
            _aiter([]),
            _aiter([_make_record(cnt=0)]),
        ])
        override = await _make_override(mock_session)
        app.dependency_overrides[get_neo4j] = override
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.get("/graph/nodes?node_type=Method")
        app.dependency_overrides.pop(get_neo4j, None)
        assert resp.status_code == 200


class TestGraphEdges:
    @pytest.mark.asyncio
    async def test_edges_200(self, client):
        mock_session = AsyncMock()
        mock_session.run = AsyncMock(side_effect=[
            _aiter([_make_record(source="a", target="b", rel_type="CONTRADICTS", rel_props={"confidence": 0.9})]),
            _aiter([_make_record(cnt=1)]),
        ])
        override = await _make_override(mock_session)
        app.dependency_overrides[get_neo4j] = override
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.get("/graph/edges")
        app.dependency_overrides.pop(get_neo4j, None)
        assert resp.status_code == 200
        assert "edges" in resp.json()

    @pytest.mark.asyncio
    async def test_invalid_rel_type_400(self, client):
        resp = await client.get("/graph/edges?relationship_type=INVALID")
        assert resp.status_code == 400


class TestGraphGaps:
    @pytest.mark.asyncio
    async def test_gaps_200_empty(self, client):
        mock_session = AsyncMock()
        mock_session.run = AsyncMock(return_value=_aiter([]))
        override = await _make_override(mock_session)
        app.dependency_overrides[get_neo4j] = override
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.get("/graph/gaps")
        app.dependency_overrides.pop(get_neo4j, None)
        assert resp.status_code == 200
        assert resp.json()["gaps"] == []


class TestGraphNodeDetail:
    @pytest.mark.asyncio
    async def test_node_detail_200(self, client):
        center = _make_neo4j_node(["Paper"], {"arxiv_id": "2401.12345", "title": "Test"})
        neighbor = _make_neo4j_node(["Paper"], {"arxiv_id": "2312.09876", "title": "Other"})
        from unittest.mock import MagicMock
        r_mock = MagicMock(type="CONTRADICTS")
        r_mock.__iter__ = lambda s: iter({"confidence": 0.9}.items())
        mock_session = AsyncMock()
        mock_session.run = AsyncMock(return_value=_aiter([
            _make_record(center=center, r=r_mock, neighbor=neighbor),
        ]))
        override = await _make_override(mock_session)
        app.dependency_overrides[get_neo4j] = override
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.get("/graph/node/2401.12345")
        app.dependency_overrides.pop(get_neo4j, None)
        assert resp.status_code == 200
        data = resp.json()
        assert "node" in data
        assert "neighbors" in data
        assert len(data["neighbors"]) == 1

    @pytest.mark.asyncio
    async def test_node_detail_404(self, client):
        mock_session = AsyncMock()
        mock_session.run = AsyncMock(return_value=_aiter([]))
        override = await _make_override(mock_session)
        app.dependency_overrides[get_neo4j] = override
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.get("/graph/node/nonexistent")
        app.dependency_overrides.pop(get_neo4j, None)
        assert resp.status_code == 404


class TestGraphNeo4jErrors:
    @pytest.mark.asyncio
    async def test_neo4j_error_503(self, client):
        mock_session = AsyncMock()
        mock_session.run = AsyncMock(side_effect=Neo4jError("connection lost"))
        override = await _make_override(mock_session)
        app.dependency_overrides[get_neo4j] = override
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.get("/graph/nodes")
        app.dependency_overrides.pop(get_neo4j, None)
        assert resp.status_code == 503
        assert resp.json()["detail"]["code"] == "GRAPH_UNAVAILABLE"


# ── Query ─────────────────────────────────────────────────────────────────────

class TestNLQuery:
    def _mock_llm_ok(self, cypher="MATCH (a:Paper) RETURN a LIMIT 10"):
        async def _call(system_prompt, user_prompt):
            return {"cypher": cypher, "explanation": "test query"}
        return _call

    def _mock_llm_answer(self, answer="Test answer"):
        async def _call(question, results):
            return answer
        return _call

    def _mock_llm_error(self):
        async def _call(system_prompt, user_prompt):
            return {"error": "cannot_translate", "reason": "schema mismatch"}
        return _call

    @pytest.mark.asyncio
    async def test_nl_query_200(self, client):
        mock_session = AsyncMock()
        mock_session.run = AsyncMock(side_effect=[
            _aiter([_make_record(n=1)]),
            _aiter([_make_record(source="a", target="b", rel_type="CONTRADICTS", rel_props={})]),
        ])
        override = await _make_override(mock_session)
        app.dependency_overrides[get_neo4j] = override
        with patch("api.routes.query.call_llm", self._mock_llm_ok()), \
             patch("api.routes.query.call_llm_answer", self._mock_llm_answer("Found 1 paper")):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                resp = await c.post("/query/natural-language", json={
                    "question": "Which papers contradict paper X?",
                    "context_node_id": "2401.12345",
                })
        app.dependency_overrides.pop(get_neo4j, None)
        assert resp.status_code == 200
        data = resp.json()
        assert data["answer"] == "Found 1 paper"
        assert data["cypher_used"] != ""
        assert data["response_time_ms"] >= 0

    @pytest.mark.asyncio
    async def test_nl_query_short_422(self, client):
        resp = await client.post("/query/natural-language", json={"question": "ab"})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_context_node_not_found_404(self, client):
        mock_session = AsyncMock()
        mock_session.run = AsyncMock(return_value=_aiter([]))
        override = await _make_override(mock_session)
        app.dependency_overrides[get_neo4j] = override
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.post("/query/natural-language", json={
                "question": "What about this node?",
                "context_node_id": "nonexistent",
            })
        app.dependency_overrides.pop(get_neo4j, None)
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_llm_error_400(self, client):
        mock_session = AsyncMock()
        mock_session.run = AsyncMock(return_value=_aiter([_make_record(n=1)]))
        override = await _make_override(mock_session)
        app.dependency_overrides[get_neo4j] = override
        with patch("api.routes.query.call_llm", self._mock_llm_error()):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                resp = await c.post("/query/natural-language", json={"question": "What is the meaning of life?"})
        app.dependency_overrides.pop(get_neo4j, None)
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_llm_failure_503(self, client):
        mock_session = AsyncMock()
        mock_session.run = AsyncMock(return_value=_aiter([]))
        override = await _make_override(mock_session)
        app.dependency_overrides[get_neo4j] = override

        async def _raise(*a, **kw):
            raise RuntimeError("LLM connection failed")

        with patch("api.routes.query.call_llm", _raise):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                resp = await c.post("/query/natural-language", json={"question": "What is the meaning of life?"})
        app.dependency_overrides.pop(get_neo4j, None)
        assert resp.status_code == 503


class TestCypherSafetyIntegration:
    @pytest.mark.asyncio
    async def test_delete_rejected_400(self, client):
        await self._assert_unsafe(client, "MATCH (n) DELETE n LIMIT 1")

    @pytest.mark.asyncio
    async def test_create_rejected_400(self, client):
        await self._assert_unsafe(client, "CREATE (n:Paper {arxiv_id: '123'})")

    @pytest.mark.asyncio
    async def test_merge_rejected_400(self, client):
        await self._assert_unsafe(client, "MERGE (n:Paper {arxiv_id: '123'})")

    @pytest.mark.asyncio
    async def test_set_rejected_400(self, client):
        await self._assert_unsafe(client, "MATCH (n:Paper) SET n.title = 'x'")

    @pytest.mark.asyncio
    async def test_remove_rejected_400(self, client):
        await self._assert_unsafe(client, "MATCH (n:Paper) REMOVE n.title")

    @pytest.mark.asyncio
    async def test_drop_rejected_400(self, client):
        await self._assert_unsafe(client, "DROP INDEX my_index")

    async def _assert_unsafe(self, client, cypher):
        mock_session = AsyncMock()
        mock_session.run = AsyncMock(return_value=_aiter([]))
        override = await _make_override(mock_session)
        app.dependency_overrides[get_neo4j] = override

        async def _mock_llm_ok(cypher):
            async def _call(system_prompt, user_prompt):
                return {"cypher": cypher, "explanation": "test"}
            return _call

        with patch("api.routes.query.call_llm", await _mock_llm_ok(cypher)):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                resp = await c.post("/query/natural-language", json={"question": "Do something dangerous"})
        app.dependency_overrides.pop(get_neo4j, None)
        assert resp.status_code == 400
        assert resp.json()["detail"]["code"] == "UNSAFE_QUERY"

    @pytest.mark.asyncio
    async def test_neo4j_error_503(self, client):
        mock_session = AsyncMock()
        mock_session.run = AsyncMock(side_effect=Neo4jError("connection lost"))
        override = await _make_override(mock_session)
        app.dependency_overrides[get_neo4j] = override
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.post("/query/natural-language", json={"question": "What papers exist?"})
        app.dependency_overrides.pop(get_neo4j, None)
        assert resp.status_code == 503


# ── Demo ──────────────────────────────────────────────────────────────────────

class TestDemo:
    @pytest.mark.asyncio
    async def test_topics_200(self, client):
        resp = await client.get("/demo/topics")
        assert resp.status_code == 200
        data = resp.json()
        assert "topics" in data
        assert len(data["topics"]) >= 1
        first = data["topics"][0]
        assert first["id"] == "rag_2024"
        assert first["paper_count"] == 3

    @pytest.mark.asyncio
    async def test_load_200(self, client):
        mock_session = AsyncMock()
        mock_session.run = AsyncMock(return_value=_aiter([]))
        override = await _make_override(mock_session)
        app.dependency_overrides[get_neo4j] = override
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.post("/demo/load/rag_2024")
        app.dependency_overrides.pop(get_neo4j, None)
        assert resp.status_code == 200
        data = resp.json()
        assert data["loaded"] is True
        assert data["papers_loaded"] == 3

    @pytest.mark.asyncio
    async def test_load_404_nonexistent(self, client):
        resp = await client.post("/demo/load/nonexistent_topic")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_load_503_neo4j_error(self, client):
        mock_session = AsyncMock()
        mock_session.run = AsyncMock(side_effect=Neo4jError("connection lost"))
        override = await _make_override(mock_session)
        app.dependency_overrides[get_neo4j] = override
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.post("/demo/load/rag_2024")
        app.dependency_overrides.pop(get_neo4j, None)
        assert resp.status_code == 503


# ── Error handling ────────────────────────────────────────────────────────────

class TestErrorHandling:
    @pytest.mark.asyncio
    async def test_request_id_on_every_response(self, client):
        resp = await client.get("/health")
        assert "x-request-id" in resp.headers
        resp = await client.get("/nonexistent")
        assert "x-request-id" in resp.headers

    def test_unhandled_exception_500(self):
        @app.get("/test-crash-phase11")
        async def crash():
            raise RuntimeError("boom")

        try:
            with TestClient(app, raise_server_exceptions=False) as c:
                resp = c.get("/test-crash-phase11")
            assert resp.status_code == 500
            assert resp.json()["detail"]["code"] == "INTERNAL_ERROR"
        finally:
            app.router.routes = [r for r in app.router.routes if not (hasattr(r, "path") and r.path == "/test-crash-phase11")]

    def test_runtime_error_in_dependency_500(self):
        mock_session = AsyncMock()
        mock_session.run = AsyncMock(side_effect=RuntimeError("boom"))

        async def _override():
            yield mock_session

        app.dependency_overrides[get_neo4j] = _override
        try:
            with TestClient(app, raise_server_exceptions=False) as c:
                resp = c.get("/graph/nodes")
            assert resp.status_code == 500
            assert resp.json()["detail"]["code"] == "INTERNAL_ERROR"
        finally:
            app.dependency_overrides.pop(get_neo4j, None)

    @pytest.mark.asyncio
    async def test_request_logged(self, client, caplog):
        import logging
        with caplog.at_level(logging.INFO, logger="contextforge.request"):
            resp = await client.get("/health")
        assert resp.status_code == 200
        assert any("GET" in r.message and "/health" in r.message for r in caplog.records)

    @pytest.mark.asyncio
    async def test_4xx_logged_as_warning(self, client, caplog):
        import logging
        with caplog.at_level(logging.WARNING, logger="contextforge.request"):
            resp = await client.post("/pipeline/run", content="bad", headers={"content-type": "application/json"})
        assert resp.status_code == 422
        assert any(r.levelno >= logging.WARNING for r in caplog.records)


# ── Auth (Phase 10) ──────────────────────────────────────────────────────────

class TestAuthentication:
    @pytest_asyncio.fixture(autouse=True)
    def _reset_api_key(self):
        original = config.settings.API_KEY
        yield
        config.settings.API_KEY = original

    @pytest.mark.asyncio
    async def test_pipeline_run_requires_auth(self):
        config.settings.API_KEY = TEST_API_KEY
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            resp = await c.post("/pipeline/run", json={"query": "test query"})
        assert resp.status_code == 401
        assert resp.json()["detail"]["code"] == "UNAUTHORIZED"

    @pytest.mark.asyncio
    async def test_query_requires_auth(self):
        config.settings.API_KEY = TEST_API_KEY
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            resp = await c.post("/query/natural-language", json={"question": "What papers exist?"})
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_demo_load_requires_auth(self):
        config.settings.API_KEY = TEST_API_KEY
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            resp = await c.post("/demo/load/test-topic")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_wrong_key_rejected(self):
        config.settings.API_KEY = TEST_API_KEY
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test", headers={"X-API-Key": "wrong-key"}) as c:
            resp = await c.post("/query/natural-language", json={"question": "What papers exist?"})
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_health_no_auth_required(self):
        config.settings.API_KEY = TEST_API_KEY
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            resp = await c.get("/health")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_dev_mode_no_auth_enforced(self):
        config.settings.API_KEY = ""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            resp = await c.post("/pipeline/run", json={"query": "dev mode test"})
        assert resp.status_code == 202


# ── Security (Phase 10) ──────────────────────────────────────────────────────

class TestSecurity:
    def test_no_hardcoded_secrets_in_api_dir(self):
        secret_pattern = re.compile(r"(sk-[a-zA-Z0-9]{20,}|gsk_[a-zA-Z0-9]{20,})")
        api_dir = BACKEND_DIR / "api"
        violations = []
        for py_file in api_dir.rglob("*.py"):
            content = py_file.read_text(encoding="utf-8")
            for match in secret_pattern.finditer(content):
                violations.append(f"{py_file.relative_to(BACKEND_DIR)}: {match.group()}")
        assert not violations, f"Hardcoded secrets found: {violations}"

    def test_parameterized_cypher_in_graph_routes(self):
        graph_file = BACKEND_DIR / "api" / "routes" / "graph.py"
        content = graph_file.read_text(encoding="utf-8")
        assert "$" in content, "Graph routes should use parameterized Cypher"
