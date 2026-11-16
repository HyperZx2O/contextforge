"""Agent pipeline — re-exports real implementations from submodules.

Exception classes and shared helpers are defined in agents.exceptions
to avoid circular imports (submodule agents import them here).
"""

import json
import logging

from agents.exceptions import (
    DatabaseError,
    ExternalAPIError,
    LLMUnavailableError,
    PipelineAgentError,
    _set_job_failed,
    _strip_fences,
)
from utils.cache import cache_get, cache_set, make_cache_key

# ── Re-export real agent functions ───────────────────────────────────────────

from agents.ingestion import run_ingestion  # noqa: E402
from agents.extractor import run_extraction  # noqa: E402
from agents.synthesis import run_synthesis  # noqa: E402
from agents.gap_finder import run_gap_finder  # noqa: E402
from llm.router import call_llm as _raw_call_llm  # noqa: E402

logger = logging.getLogger(__name__)


async def call_llm(system_prompt: str, user_prompt: str) -> dict:
    """Call LLM with in-memory caching. Returns parsed JSON dict.

    Used by the NL-to-Cypher route (query.py).
    """
    cache_key = make_cache_key("llm:", system_prompt, user_prompt)
    cached = await cache_get(cache_key)
    if cached:
        logger.debug("LLM cache hit for key=%s", cache_key[:12])
        try:
            return json.loads(cached)
        except (json.JSONDecodeError, TypeError):
            pass  # stale/bad cache, re-fetch

    raw = await _raw_call_llm(system_prompt, user_prompt)
    await cache_set(cache_key, raw, ttl=7200)

    cleaned = _strip_fences(raw)
    try:
        return json.loads(cleaned)
    except (json.JSONDecodeError, TypeError):
        logger.warning("LLM returned non-JSON, wrapping as error")
        return {"error": "LLM returned invalid JSON", "raw": str(raw)[:500]}


async def call_llm_answer(question: str, results: str) -> str:
    """Generate a natural-language answer from graph query results (cached).

    Used by the NL query route (query.py).
    """
    system = (
        "You are a research knowledge graph assistant. "
        "Given a user question and JSON query results from a Neo4j graph, "
        "write a clear, concise answer. Be direct. Cite specific paper IDs when relevant."
    )
    user = f"Question: {question}\n\nGraph query results:\n{results}\n\nAnswer:"

    cache_key = make_cache_key("answer:", question, results)
    cached = await cache_get(cache_key)
    if cached:
        logger.debug("LLM answer cache hit")
        return cached

    answer = await _raw_call_llm(system, user)
    await cache_set(cache_key, answer, ttl=3600)
    return answer
