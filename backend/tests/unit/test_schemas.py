import pytest
from pydantic import ValidationError

from api.schemas import (
    DemoLoadResponse,
    DemoTopic,
    DemoTopicsResponse,
    EdgeProperties,
    GapItem,
    GraphEdge,
    GraphEdgesResponse,
    GraphGapsResponse,
    GraphNode,
    GraphNodesResponse,
    LLMRelationshipResponse,
    NeighborItem,
    NodeDetailResponse,
    NLQueryRequest,
    NLQueryResponse,
    NodeProperties,
    PipelineRunRequest,
    PipelineRunResponse,
    PipelineStatusResponse,
)


class TestPipelineRunRequest:
    def test_valid(self):
        r = PipelineRunRequest(query="retrieval augmented generation")
        assert r.query == "retrieval augmented generation"
        assert r.max_papers == 100
        assert r.sources == ["arxiv", "github", "news"]
        assert r.year_from is None

    def test_query_too_short(self):
        with pytest.raises(ValidationError, match="query"):
            PipelineRunRequest(query="ab")

    def test_query_too_long(self):
        with pytest.raises(ValidationError, match="query"):
            PipelineRunRequest(query="x" * 201)

    def test_max_papers_too_low(self):
        with pytest.raises(ValidationError, match="max_papers"):
            PipelineRunRequest(query="test", max_papers=5)

    def test_max_papers_too_high(self):
        with pytest.raises(ValidationError, match="max_papers"):
            PipelineRunRequest(query="test", max_papers=500)


class TestPipelineRunResponse:
    def test_valid(self):
        r = PipelineRunResponse(job_id="abc", status="pending", message="started")
        assert r.job_id == "abc"


class TestPipelineStatusResponse:
    def test_valid(self):
        r = PipelineStatusResponse(
            job_id="abc", status="done", progress=100,
            papers_found=10, papers_processed=10, relationships_created=5,
            started_at="2026-01-01T00:00:00Z",
            completed_at="2026-01-01T00:05:00Z", error_message=None,
        )
        assert r.completed_at == "2026-01-01T00:05:00Z"

    def test_with_error(self):
        r = PipelineStatusResponse(
            job_id="abc", status="failed", progress=50,
            papers_found=10, papers_processed=5, relationships_created=0,
            started_at="2026-01-01T00:00:00Z",
            completed_at=None, error_message="LLM timeout",
        )
        assert r.error_message == "LLM timeout"
        assert r.completed_at is None


class TestGraphNode:
    def test_valid(self):
        n = GraphNode(id="2401.12345", label="Paper", properties={"title": "Test"})
        assert n.id == "2401.12345"

    def test_extra_properties_allowed(self):
        n = GraphNode(id="1", label="Paper", properties={"custom_field": 42})
        assert n.properties.custom_field == 42


class TestGraphEdge:
    def test_valid(self):
        e = GraphEdge(source="a", target="b", type="CONTRADICTS", properties={"confidence": 0.9})
        assert e.type == "CONTRADICTS"

    def test_extra_properties_allowed(self):
        e = GraphEdge(source="a", target="b", type="CITES", properties={"custom": True})
        assert e.properties.custom is True


class TestGraphNodesResponse:
    def test_valid(self):
        r = GraphNodesResponse(nodes=[], total=0, limit=500, offset=0)
        assert r.total == 0


class TestGraphEdgesResponse:
    def test_valid(self):
        r = GraphEdgesResponse(edges=[], total=0, limit=1000, offset=0)
        assert r.limit == 1000


class TestGapItem:
    def test_valid(self):
        g = GapItem(
            id="gap-1", gap_type="unresolved_contradiction",
            description="Two papers disagree",
            affected_nodes=["2401.12345", "2312.09876"],
            severity=0.84, detected_at="2026-01-07T16:00:00Z",
        )
        assert g.severity == 0.84


class TestGraphGapsResponse:
    def test_empty(self):
        r = GraphGapsResponse(gaps=[])
        assert r.gaps == []


class TestNodeDetailResponse:
    def test_valid(self):
        node = GraphNode(id="1", label="Paper", properties={"title": "X"})
        neighbor = NeighborItem(
            node=GraphNode(id="2", label="Paper", properties={}),
            relationship={"type": "CITES"},
        )
        r = NodeDetailResponse(node=node, neighbors=[neighbor])
        assert len(r.neighbors) == 1


class TestNLQueryRequest:
    def test_valid(self):
        r = NLQueryRequest(question="Which papers contradict 2401.12345?")
        assert r.context_node_id is None

    def test_question_too_short(self):
        with pytest.raises(ValidationError, match="question"):
            NLQueryRequest(question="hi")

    def test_question_too_long(self):
        with pytest.raises(ValidationError, match="question"):
            NLQueryRequest(question="x" * 501)

    def test_with_context_node(self):
        r = NLQueryRequest(question="Tell me about this paper", context_node_id="2401.12345")
        assert r.context_node_id == "2401.12345"


class TestNLQueryResponse:
    def test_valid(self):
        r = NLQueryResponse(
            question="What?", answer="Two papers contradict.",
            supporting_edges=[], cypher_used="MATCH (n) RETURN n",
            response_time_ms=1240,
        )
        assert r.response_time_ms == 1240


class TestDemoTopic:
    def test_valid(self):
        t = DemoTopic(id="rag_2024", label="RAG", paper_count=94, edge_count=312)
        assert t.paper_count == 94


class TestDemoTopicsResponse:
    def test_valid(self):
        r = DemoTopicsResponse(topics=[])
        assert r.topics == []


class TestDemoLoadResponse:
    def test_valid(self):
        r = DemoLoadResponse(topic_id="rag_2024", loaded=True, papers_loaded=94, edges_loaded=312, gaps_loaded=7)
        assert r.loaded is True


class TestLLMRelationshipResponse:
    def _base(self, **overrides):
        data = dict(
            relationship_type="CONTRADICTS", confidence=0.9,
            evidence_quote="Our results contradict prior findings.",
            dimension="accuracy", direction="a_to_b",
        )
        data.update(overrides)
        return data

    def test_valid(self):
        r = LLMRelationshipResponse(**self._base())
        assert r.confidence == 0.9

    def test_confidence_too_high(self):
        with pytest.raises(ValidationError, match="confidence"):
            LLMRelationshipResponse(**self._base(confidence=1.5))

    def test_confidence_too_low(self):
        with pytest.raises(ValidationError, match="confidence"):
            LLMRelationshipResponse(**self._base(confidence=-0.1))

    def test_empty_quote_on_non_none_rejects(self):
        with pytest.raises(ValidationError, match="evidence_quote"):
            LLMRelationshipResponse(**self._base(evidence_quote=""))

    def test_empty_quote_on_none_accepts(self):
        r = LLMRelationshipResponse(**self._base(
            relationship_type="NONE", confidence=0.0, evidence_quote="", dimension="",
        ))
        assert r.relationship_type == "NONE"

    def test_invalid_relationship_type(self):
        with pytest.raises(ValidationError):
            LLMRelationshipResponse(**self._base(relationship_type="INVALID"))

    def test_invalid_direction(self):
        with pytest.raises(ValidationError):
            LLMRelationshipResponse(**self._base(direction="left"))
