"""Groq LLM client — sends chat completions to api.groq.com, raises GroqError on timeout/5xx."""

import logging

import httpx

from llm import GroqError

logger = logging.getLogger(__name__)


def _settings():
    from config import settings
    return settings


async def call_groq(system: str, user: str) -> str:
    """Send a chat completion request to Groq API.

    Args:
        system: System prompt.
        user: User prompt.

    Returns:
        LLM response text.

    Side effects:
        Calls api.groq.com/openai/v1/chat/completions.

    Raises:
        GroqError: On timeout or server error (5xx).
    """
    s = _settings()
    payload = {
        "model": s.GROQ_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.0,
        "max_tokens": 1024,
    }
    headers = {"Authorization": f"Bearer {s.GROQ_API_KEY}"}

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                json=payload,
                headers=headers,
                timeout=s.LLM_TIMEOUT_SECONDS,
            )
        except httpx.TimeoutException as exc:
            raise GroqError(f"Groq timeout: {exc}") from exc

        if resp.status_code >= 500:
            raise GroqError(f"Groq server error {resp.status_code}: {resp.text[:200]}")

        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]
