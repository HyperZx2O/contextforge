from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    GROQ_API_KEY: str = ""
    OPENROUTER_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.1-70b-versatile"
    OPENROUTER_MODEL: str = "mistralai/mixtral-8x7b-instruct"
    LLM_TIMEOUT_SECONDS: int = 30
    LLM_MAX_RETRIES: int = 3

    NEO4J_URI: str = "bolt://neo4j:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = ""

    DATABASE_URL: str

    REDIS_URL: str = "redis://redis:6379/0"

    ARXIV_RATE_LIMIT_PER_SECOND: int = 3
    SEMANTIC_SCHOLAR_API_KEY: str = ""
    GITHUB_TOKEN: str = ""
    NEWS_API_KEY: str = ""

    CONFIDENCE_THRESHOLD: float = 0.7
    MAX_PAPERS_PER_QUERY: int = 200
    ENTITY_DEDUP_SIMILARITY_THRESHOLD: float = 0.85
    GAP_DENSITY_THRESHOLD: float = 0.3
    GAP_TEMPORAL_YEARS: int = 5

    API_KEY: str = ""
    BACKEND_CORS_ORIGINS: str = "http://localhost:3000"
    LOG_LEVEL: str = "INFO"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
