import uuid


async def run_ingestion(job_id: str, query: str, year_from: int, year_to: int,
                        max_papers: int, sources: list[str]) -> list[str]:
    return [f"paper-{uuid.uuid4().hex[:8]}" for _ in range(3)]


async def run_extraction(job_id: str, paper_ids: list[str]) -> list[str]:
    return [f"entity-{uuid.uuid4().hex[:8]}" for _ in paper_ids]


async def run_synthesis(job_id: str, paper_ids: list[str]) -> int:
    return len(paper_ids) * 2


async def run_gap_finder(job_id: str) -> int:
    return 1


async def call_llm(system_prompt: str, user_prompt: str) -> dict:
    return {
        "cypher": "MATCH (a:Paper)-[r:CONTRADICTS]->(b:Paper) RETURN a.arxiv_id AS source, b.arxiv_id AS target, type(r) AS rel_type, properties(r) AS rel_props LIMIT 10",
        "explanation": "Finds all papers that contradict each other.",
    }


async def call_llm_answer(question: str, results: str) -> str:
    return f"Based on the graph data: {results[:200]}"
"""Shared exception types for the agent pipeline.

Classes:
    PipelineAgentError: Base exception for all agent failures.
    LLMUnavailableError: Both LLM providers (Groq, OpenRouter) failed.
    DatabaseError: Neo4j or PostgreSQL operation failed.
    ExternalAPIError: Third-party API (arXiv, Semantic Scholar, GitHub, NewsAPI) failed.
"""


class PipelineAgentError(Exception):
    pass


class LLMUnavailableError(PipelineAgentError):
    pass


class DatabaseError(PipelineAgentError):
    pass


class ExternalAPIError(PipelineAgentError):
    pass
