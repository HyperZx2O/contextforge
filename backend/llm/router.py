"""LLM router — tries Groq first, falls back to OpenRouter, raises LLMUnavailableError if both fail."""

import logging

from agents import LLMUnavailableError
from llm import GroqError, OpenRouterError
from llm.groq_client import call_groq
from llm.openrouter_client import call_openrouter

logger = logging.getLogger(__name__)


async def call_llm(system: str, user: str) -> str:
    """Route LLM call: try Groq first, fall back to OpenRouter.

    Args:
        system: System prompt.
        user: User prompt.

    Returns:
        LLM response text.

    Side effects:
        Calls Groq API, then OpenRouter API on Groq failure.

    Raises:
        LLMUnavailableError: If both providers fail.
    """
    try:
        return await call_groq(system, user)
    except GroqError as exc:
        logger.warning("Groq failed (%s), falling back to OpenRouter", exc)
    try:
        return await call_openrouter(system, user)
    except OpenRouterError as exc:
        raise LLMUnavailableError(f"Both LLM providers failed. OpenRouter: {exc}") from exc
