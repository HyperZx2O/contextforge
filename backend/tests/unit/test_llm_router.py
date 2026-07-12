import pytest
from unittest.mock import AsyncMock, patch

from agents import LLMUnavailableError
from llm import GroqError, OpenRouterError


@pytest.mark.asyncio
async def test_groq_success_skips_openrouter():
    with (
        patch("llm.router.call_groq", new_callable=AsyncMock) as mock_groq,
        patch("llm.router.call_openrouter", new_callable=AsyncMock) as mock_openrouter,
    ):
        mock_groq.return_value = '{"relationship_type": "EXTENDS"}'

        from llm.router import call_llm
        result = await call_llm("system", "user")

    assert result == '{"relationship_type": "EXTENDS"}'
    mock_groq.assert_called_once()
    mock_openrouter.assert_not_called()


@pytest.mark.asyncio
async def test_groq_fails_falls_back_to_openrouter():
    with (
        patch("llm.router.call_groq", new_callable=AsyncMock) as mock_groq,
        patch("llm.router.call_openrouter", new_callable=AsyncMock) as mock_openrouter,
    ):
        mock_groq.side_effect = GroqError("Groq timeout")
        mock_openrouter.return_value = '{"relationship_type": "CONTRADICTS"}'

        from llm.router import call_llm
        result = await call_llm("system", "user")

    assert result == '{"relationship_type": "CONTRADICTS"}'
    mock_groq.assert_called_once()
    mock_openrouter.assert_called_once()


@pytest.mark.asyncio
async def test_both_providers_fail_raises_llm_unavailable():
    with (
        patch("llm.router.call_groq", new_callable=AsyncMock) as mock_groq,
        patch("llm.router.call_openrouter", new_callable=AsyncMock) as mock_openrouter,
    ):
        mock_groq.side_effect = GroqError("Groq down")
        mock_openrouter.side_effect = OpenRouterError("OpenRouter down")

        from llm.router import call_llm
        with pytest.raises(LLMUnavailableError):
            await call_llm("system", "user")
