"""
Shared Pydantic request/response models — THE API CONTRACT.

⚠️  CRITICAL SHARED FILE.
Every route (Member 2) and every frontend call (Member 3) depends on the
exact shape of these models. Any change here breaks the API layer and the
frontend simultaneously — get sign-off from all three members before
changing a field name, type, or default.

Reference: spec.md §6 (API Contract), §5.2 (Neo4j relationship vocabulary)
"""

from datetime import date, datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ============================================================
# Shared enums / vocab
# ============================================================

class RelationshipType(str, Enum):
    CONTRADICTS = "CONTRADICTS"
    EXTENDS = "EXTENDS"
    REPLICATES = "REPLICATES"
    REPLICATES_FAILED = "REPLICATES_FAILED"
    CHALLENGES = "CHALLENGES"
    CITES = "CITES"
    IMPLEMENTS = "IMPLEMENTS"
    DISAGREES_ON_SCOPE = "DISAGREES_ON_SCOPE"


class NodeLabel(str, Enum):
    PAPER = "Paper"
    AUTHOR = "Author"
    METHOD = "Method"
    DATASET = "Dataset"
    CLAIM = "Claim"
    GAP = "Gap"


class SourceType(str, Enum):
    ARXIV = "arxiv"
    SEMANTIC_SCHOLAR = "semantic_scholar"
    GITHUB = "github"
    NEWS = "news"


class JobStatus(str, Enum):
    PENDING = "pending"
    INGESTING = "ingesting"
    EXTRACTING = "extracting"
    SYNTHESIZING = "synthesizing"
    GAP_FINDING = "gap_finding"
    DONE = "done"
    FAILED = "failed"


class GapType(str, Enum):
    LOW_DENSITY = "low_density"
    UNRESOLVED_CONTRADICTION = "unresolved_contradiction"
    STALE_CLAIM = "stale_claim"
    BRIDGE_OPPORTUNITY = "bridge_opportunity"


# ============================================================
# 6.1 Pipeline Routes
# ============================================================

class PipelineRunRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=200)
    year_from: Optional[int] = None
    year_to: Optional[int] = None
    max_papers: Optional[int] = Field(default=100, ge=10, le=200)
    sources: Optional[List[SourceType]] = Field(
        default=[SourceType.ARXIV, SourceType.GITHUB, SourceType.NEWS]
    )


class PipelineRunResponse(BaseModel):
    job_id: str
    status: JobStatus
    message: str


class PipelineStatusResponse(BaseModel):
    job_id: str
    status: JobStatus
    progress: int = Field(..., ge=0, le=100)
    papers_found: int = 0
    papers_processed: int = 0
    relationships_created: int = 0
    started_at: datetime
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None


# ============================================================
# 6.2 Graph Routes
# ============================================================

class GraphNode(BaseModel):
    id: str
    label: NodeLabel
    properties: Dict[str, Any]


class GraphEdge(BaseModel):
    source: str
    target: str
    type: RelationshipType
    properties: Dict[str, Any]


class NodesResponse(BaseModel):
    nodes: List[GraphNode]
    total: int
    limit: int
    offset: int


class EdgesResponse(BaseModel):
    edges: List[GraphEdge]
    total: int
    limit: int
    offset: int


class Gap(BaseModel):
    id: str
    gap_type: GapType
    description: str
    affected_nodes: List[str]
    severity: float = Field(..., ge=0.0, le=1.0)
    detected_at: datetime


class GapsResponse(BaseModel):
    gaps: List[Gap]


class NodeNeighborRelationship(BaseModel):
    type: RelationshipType
    direction: str  # 'inbound' | 'outbound'
    properties: Dict[str, Any]


class NodeNeighbor(BaseModel):
    node: GraphNode
    relationship: NodeNeighborRelationship


class NodeDetailResponse(BaseModel):
    node: GraphNode
    neighbors: List[NodeNeighbor]


# ============================================================
# 6.3 Query Routes
# ============================================================

class NLQueryRequest(BaseModel):
    question: str = Field(..., min_length=5, max_length=500)
    context_node_id: Optional[str] = None


class SupportingEdge(BaseModel):
    source: str
    target: str
    type: RelationshipType
    evidence_quote: str


class NLQueryResponse(BaseModel):
    question: str
    answer: str
    supporting_edges: List[SupportingEdge]
    cypher_used: str
    response_time_ms: int


# ============================================================
# 6.4 Demo Routes
# ============================================================

class DemoTopic(BaseModel):
    id: str
    label: str
    paper_count: int
    edge_count: int


class DemoTopicsResponse(BaseModel):
    topics: List[DemoTopic]


class DemoLoadResponse(BaseModel):
    topic_id: str
    loaded: bool
    papers_loaded: int
    edges_loaded: int
    gaps_loaded: int


# ============================================================
# Generic error shape (used across all routes)
# ============================================================

class ErrorResponse(BaseModel):
    detail: str
