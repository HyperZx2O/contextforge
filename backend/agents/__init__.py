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
