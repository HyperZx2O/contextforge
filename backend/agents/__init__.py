"""Agent pipeline — re-exports real implementations from submodules.

Exception classes are defined here first to avoid circular imports,
since the submodule agents import them from this package.
"""

import json
import logging
import re


def _strip_markdown_fences(text: str) -> str:
    """Strip ```json ... ``` or ``` ... ``` fences from LLM responses."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*\n?", "", text)
    text = re.sub(r"\n?```\s*$", "", text)
    return text.strip()


# ── Exception types (must be defined before submodule imports) ────────────────


class PipelineAgentError(Exception):
    pass


class LLMUnavailableError(PipelineAgentError):
    pass


class DatabaseError(PipelineAgentError):
    pass


class ExternalAPIError(PipelineAgentError):
    pass


# ── Re-export real agent functions (imports AFTER exception classes) ──────────

from agents.ingestion import run_ingestion  # noqa: E402
from agents.extractor import run_extraction  # noqa: E402
from agents.synthesis import run_synthesis  # noqa: E402
from agents.gap_finder import run_gap_finder  # noqa: E402
from llm.router import call_llm as _raw_call_llm  # noqa: E402
from utils.cache import cache_get, cache_set, make_cache_key  # noqa: E402

logger = logging.getLogger(__name__)


async def call_llm(system_prompt: str, user_prompt: str) -> dict:
    """Call LLM with Redis caching. Returns parsed JSON dict.

    Used by the NL-to-Cypher route (query.py).
    Redis failures are silently ignored — falls through to LLM call.
    """
    cache_key = make_cache_key("llm:", system_prompt, user_prompt)
    try:
        cached = await cache_get(cache_key)
        if cached:
            logger.debug("LLM cache hit for key=%s", cache_key[:12])
            try:
                return json.loads(cached)
            except (json.JSONDecodeError, TypeError):
                pass  # stale/bad cache, re-fetch
    except Exception:
        logger.debug("Redis read failed, skipping cache")

    raw = await _raw_call_llm(system_prompt, user_prompt)
    try:
        await cache_set(cache_key, raw, ttl=7200)
    except Exception:
        logger.debug("Redis write failed, skipping cache")

    cleaned = _strip_markdown_fences(raw)
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
    try:
        cached = await cache_get(cache_key)
        if cached:
            logger.debug("LLM answer cache hit")
            return cached
    except Exception:
        logger.debug("Redis read failed, skipping cache")

    answer = await _raw_call_llm(system, user)
    try:
        await cache_set(cache_key, answer, ttl=3600)
    except Exception:
        logger.debug("Redis write failed, skipping cache")
    return answer
