"""Shared exceptions and helpers for the agent pipeline.

Extracted to a separate module so submodules can import these
without triggering a circular import through agents/__init__.py.
"""

import re

from sqlalchemy import update

from db.models import PipelineJobs
from dependencies import _session_factory

_FENCE_RE = re.compile(r"```(?:json)?\s*\n?(.*?)\n?\s*```", re.DOTALL)


def _strip_fences(text: str) -> str:
    """Strip ```json ... ``` fences from LLM responses."""
    m = _FENCE_RE.search(text)
    return m.group(1).strip() if m else text.strip()


# ── Exception types ──────────────────────────────────────────────────────────


class PipelineAgentError(Exception):
    pass


class LLMUnavailableError(PipelineAgentError):
    pass


class DatabaseError(PipelineAgentError):
    pass


class ExternalAPIError(PipelineAgentError):
    pass


async def _set_job_failed(job_id: str, error_message: str):
    """Set a pipeline job status to failed with an error message."""
    async with _session_factory() as session:
        await session.execute(
            update(PipelineJobs)
            .where(PipelineJobs.id == job_id)
            .values(status="failed", error_message=error_message)
        )
        await session.commit()
