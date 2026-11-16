from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    GROQ_API_KEY: str = ""
    OPENROUTER_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    OPENROUTER_MODEL: str = "openai/gpt-4o-mini"
    LLM_TIMEOUT_SECONDS: int = 30
    LLM_MAX_RETRIES: int = 3

    NEO4J_URI: str = "bolt://neo4j:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = ""

    DATABASE_URL: str

    ARXIV_RATE_LIMIT_PER_SECOND: int = 3
    SEMANTIC_SCHOLAR_API_KEY: str = ""
    GITHUB_TOKEN: str = ""
    NEWS_API_KEY: str = ""

    CONFIDENCE_THRESHOLD: float = 0.7
    GAP_TEMPORAL_YEARS: int = 5

    JWT_SECRET: str = ""
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    # Leave unset to derive from ENV: Secure+SameSite=None in production,
    # plain HttpOnly+Lax for local development over http.
    REFRESH_COOKIE_SECURE: bool | None = None
    REFRESH_COOKIE_SAMESITE: str = ""
    # Google OAuth client ID (the same value the frontend uses). Google
    # sign-in is disabled when empty, so the app still boots without it.
    GOOGLE_CLIENT_ID: str = ""

    ENV: str = "development"
    APP_URL: str = "http://localhost:8000"
    BACKEND_CORS_ORIGINS: str = "https://contextforge-chi.vercel.app,http://localhost:3000,http://localhost:5173"
    LOG_LEVEL: str = "INFO"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
