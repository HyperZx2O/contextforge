"""OpenRouter LLM client — sends chat completions to openrouter.ai, raises OpenRouterError on timeout/5xx."""

import logging

import httpx

from llm import OpenRouterError

logger = logging.getLogger(__name__)


def _settings():
    from config import settings
    return settings


async def call_openrouter(system: str, user: str) -> str:
    """Send a chat completion request to OpenRouter API.

    Args:
        system: System prompt.
        user: User prompt.

    Returns:
        LLM response text.

    Side effects:
        Calls openrouter.ai/api/v1/chat/completions.

    Raises:
        OpenRouterError: On timeout or server error (5xx).
    """
    s = _settings()
    payload = {
        "model": s.OPENROUTER_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.0,
        "max_tokens": 1024,
    }
    headers = {
        "Authorization": f"Bearer {s.OPENROUTER_API_KEY}",
        "HTTP-Referer": "http://localhost",
    }

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                json=payload,
                headers=headers,
                timeout=s.LLM_TIMEOUT_SECONDS,
            )
        except httpx.TimeoutException as exc:
            raise OpenRouterError(f"OpenRouter timeout: {exc}") from exc

        if resp.status_code >= 500:
            raise OpenRouterError(
                f"OpenRouter server error {resp.status_code}: {resp.text[:200]}"
            )

        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]
