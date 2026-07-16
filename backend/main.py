import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException

from config import settings
from dependencies import limiter
from api.routes import demo, graph, pipeline, query
from middleware import RequestIDMiddleware, SecurityHeadersMiddleware

logging.basicConfig(level=settings.LOG_LEVEL)
log = logging.getLogger("contextforge")


def _rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": {"code": "RATE_LIMIT_EXCEEDED", "message": str(exc.detail)}},
    )


@asynccontextmanager
async def lifespan(app):
    try:
        from dependencies import create_tables
        await create_tables()
    except Exception as exc:
        log.warning("Database tables init skipped: %s", exc)
    try:
        from db.neo4j_client import initialize_schema
        await initialize_schema()
    except Exception as exc:
        log.warning("Neo4j schema init skipped: %s", exc)
    yield
    try:
        from db.neo4j_client import close_neo4j_driver
        await close_neo4j_driver()
    except Exception:
        pass


app = FastAPI(title="ContextForge", version="1.0.0", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestIDMiddleware)
app.add_middleware(SecurityHeadersMiddleware)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"detail": {"code": "VALIDATION_ERROR", "message": str(exc.errors())}},
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    if isinstance(exc.detail, dict):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": {"code": "HTTP_ERROR", "message": str(exc.detail)}},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    log.error("Unhandled exception on %s", request.url.path, exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={"detail": {"code": "INTERNAL_ERROR", "message": "An unexpected error occurred"}},
    )


app.include_router(pipeline.router)
app.include_router(graph.router)
app.include_router(query.router)
app.include_router(demo.router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
