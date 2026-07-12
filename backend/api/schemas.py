from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator

RELATIONSHIP_TYPES = [
    "CONTRADICTS",
    "EXTENDS",
    "REPLICATES",
    "REPLICATES_FAILED",
    "CHALLENGES",
    "CITES",
    "IMPLEMENTS",
    "DISAGREES_ON_SCOPE",
]

NODE_TYPES = ["Paper", "Author", "Method", "Dataset", "Claim", "Gap"]


def _len_range(min_len: int, max_len: int, label: str):
    def validator(cls, v: str) -> str:
        if len(v) < min_len or len(v) > max_len:
            raise ValueError(f"{label} must be {min_len}-{max_len} characters")
        return v
    return classmethod(validator)


# ── Pipeline ──────────────────────────────────────────────────────────────────


class PipelineRunRequest(BaseModel):
    query: str
    year_from: int | None = None
    year_to: int | None = None
    max_papers: int = 100
    sources: list[str] = ["arxiv", "github", "news"]

    @field_validator("query")
    @classmethod
    def query_length(cls, v: str) -> str:
        return _len_range(3, 200, "query").__func__(cls, v)

    @field_validator("max_papers")
    @classmethod
    def max_papers_range(cls, v: int) -> int:
        if not 10 <= v <= 200:
            raise ValueError("max_papers must be 10-200")
        return v


class PipelineRunResponse(BaseModel):
    job_id: str
    status: str
    message: str


class PipelineStatusResponse(BaseModel):
    job_id: str
    status: str
    progress: int
    papers_found: int
    papers_processed: int
    relationships_created: int
    started_at: str
    completed_at: str | None
    error_message: str | None


# ── Graph ─────────────────────────────────────────────────────────────────────


class NodeProperties(BaseModel):
    model_config = ConfigDict(extra="allow")


class GraphNode(BaseModel):
    id: str
    label: str
    properties: NodeProperties


class GraphNodesResponse(BaseModel):
    nodes: list[GraphNode]
    total: int
    limit: int
    offset: int


class EdgeProperties(BaseModel):
    model_config = ConfigDict(extra="allow")


class GraphEdge(BaseModel):
    source: str
    target: str
    type: str
    properties: EdgeProperties


class GraphEdgesResponse(BaseModel):
    edges: list[GraphEdge]
    total: int
    limit: int
    offset: int


class GapItem(BaseModel):
    id: str
    gap_type: str
    description: str
    affected_nodes: list[str]
    severity: float
    detected_at: str


class GraphGapsResponse(BaseModel):
    gaps: list[GapItem]


class NeighborItem(BaseModel):
    node: GraphNode
    relationship: dict


class NodeDetailResponse(BaseModel):
    node: GraphNode
    neighbors: list[NeighborItem]


# ── Query ─────────────────────────────────────────────────────────────────────


class NLQueryRequest(BaseModel):
    question: str
    context_node_id: str | None = None

    @field_validator("question")
    @classmethod
    def question_length(cls, v: str) -> str:
        return _len_range(5, 500, "question").__func__(cls, v)


class NLQueryResponse(BaseModel):
    question: str
    answer: str
    supporting_edges: list[GraphEdge]
    cypher_used: str
    response_time_ms: int


# ── Demo ──────────────────────────────────────────────────────────────────────


class DemoTopic(BaseModel):
    id: str
    label: str
    paper_count: int
    edge_count: int


class DemoTopicsResponse(BaseModel):
    topics: list[DemoTopic]


class DemoLoadResponse(BaseModel):
    topic_id: str
    loaded: bool
    papers_loaded: int
    edges_loaded: int
    gaps_loaded: int


# ── LLM Output (shared contract) ─────────────────────────────────────────────


class LLMRelationshipResponse(BaseModel):
    relationship_type: Literal[
        "CONTRADICTS",
        "EXTENDS",
        "REPLICATES",
        "REPLICATES_FAILED",
        "CHALLENGES",
        "CITES",
        "IMPLEMENTS",
        "DISAGREES_ON_SCOPE",
        "NONE",
    ]
    confidence: float
    evidence_quote: str
    dimension: str
    direction: Literal["a_to_b", "b_to_a"]

    @field_validator("confidence")
    @classmethod
    def confidence_in_range(cls, v: float) -> float:
        if not 0.0 <= v <= 1.0:
            raise ValueError("confidence must be 0.0-1.0")
        return v

    @field_validator("evidence_quote")
    @classmethod
    def quote_not_empty_unless_none(cls, v: str, info) -> str:
        if info.data.get("relationship_type") != "NONE" and not v:
            raise ValueError("evidence_quote required for non-NONE relationships")
        return v
