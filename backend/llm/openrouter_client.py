"""OpenRouter LLM client — sends chat completions to openrouter.ai, raises OpenRouterError on timeout/5xx."""

import atexit
import logging

import httpx

from config import settings
from llm import OpenRouterError

logger = logging.getLogger(__name__)

_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient()
    return _client


def _close_client():
    global _client
    if _client and not _client.is_closed:
        import asyncio

        try:
            loop = asyncio.get_running_loop()
            loop.create_task(_client.aclose())
        except RuntimeError:
            pass
        _client = None


atexit.register(_close_client)


async def call_openrouter(
    system: str, user: str, response_format: dict | None = None
) -> str:
    """Send a chat completion request to OpenRouter API."""
    s = settings
    payload = {
        "model": s.OPENROUTER_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.0,
        "max_tokens": 1024,
    }
    if response_format:
        payload["response_format"] = response_format
    headers = {
        "Authorization": f"Bearer {s.OPENROUTER_API_KEY}",
        "HTTP-Referer": s.APP_URL,
    }

    client = _get_client()
    try:
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            json=payload,
            headers=headers,
            timeout=s.LLM_TIMEOUT_SECONDS,
        )
    except httpx.TimeoutException as exc:
        raise OpenRouterError(f"OpenRouter timeout: {exc}") from exc

    if resp.status_code >= 400:
        raise OpenRouterError(f"OpenRouter error {resp.status_code}: {resp.text[:200]}")

    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]
