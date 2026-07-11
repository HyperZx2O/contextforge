"""
Shared application settings, loaded once from environment variables / `.env`.

⚠️  SHARED FILE — do not modify alone.
Everyone imports `settings` from here. If you need a new config value,
add it below and let the other two members know before merging.

Usage:
    from config import settings
    settings.GROQ_API_KEY
"""

from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # ---- LLM ----
    GROQ_API_KEY: str
    OPENROUTER_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.1-70b-versatile"
    OPENROUTER_MODEL: str = "mistralai/mixtral-8x7b-instruct"
    LLM_TIMEOUT_SECONDS: int = 30
    LLM_MAX_RETRIES: int = 3

    # ---- Neo4j ----
    NEO4J_URI: str = "bolt://neo4j:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "contextforge_neo4j"

    # ---- PostgreSQL ----
    DATABASE_URL: str = (
        "postgresql://contextforge:contextforge_pg@postgres:5432/contextforge"
    )

    # ---- Redis ----
    REDIS_URL: str = "redis://redis:6379/0"

    # ---- External APIs ----
    ARXIV_RATE_LIMIT_PER_SECOND: int = 3
    SEMANTIC_SCHOLAR_API_KEY: str = ""
    GITHUB_TOKEN: str = ""
    NEWS_API_KEY: str = ""

    # ---- Pipeline ----
    CONFIDENCE_THRESHOLD: float = 0.7
    MAX_PAPERS_PER_QUERY: int = 200
    ENTITY_DEDUP_SIMILARITY_THRESHOLD: float = 0.85
    GAP_DENSITY_THRESHOLD: float = 0.3
    GAP_TEMPORAL_YEARS: int = 5

    # ---- App ----
    BACKEND_CORS_ORIGINS: str = "http://localhost:3000"
    LOG_LEVEL: str = "INFO"

    @property
    def cors_origins_list(self) -> List[str]:
        """BACKEND_CORS_ORIGINS as a parsed list, split on commas."""
        return [origin.strip() for origin in self.BACKEND_CORS_ORIGINS.split(",")]


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance — safe to call repeatedly."""
    return Settings()


settings = get_settings()
