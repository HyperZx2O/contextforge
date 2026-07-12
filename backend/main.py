"""FastAPI application entrypoint with lifespan-managed Neo4j schema init."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from db.neo4j_client import close_neo4j_driver, initialize_schema


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize Neo4j schema on startup; close driver on shutdown."""
    await initialize_schema()
    yield
    await close_neo4j_driver()


app = FastAPI(title="ContextForge", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint.

    Returns:
        dict: {"status": "ok"}
    """
    return {"status": "ok"}
