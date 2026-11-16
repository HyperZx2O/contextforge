"""SSE streaming endpoint and health check for the pipeline."""

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import asyncio
import json

router = APIRouter(prefix="/pipeline", tags=["pipeline-stream"])


async def _event_generator(job_id: str):
    """Generate SSE events for pipeline progress."""
    from dependencies import _session_factory
    from db.models import PipelineJobs
    from sqlalchemy import select

    last_status = None
    while True:
        async with _session_factory() as db:
            result = await db.execute(
                select(PipelineJobs).where(PipelineJobs.id == job_id)
            )
            job = result.scalar_one_or_none()
            if not job:
                yield f"data: {json.dumps({'error': 'Job not found'})}\n\n"
                break
            status = {
                "job_id": str(job.id),
                "status": job.status,
                "progress": job.progress,
                "papers_found": job.papers_found,
                "papers_processed": job.papers_processed,
                "relationships_created": job.relationships_created,
            }
            if status != last_status:
                yield f"data: {json.dumps(status)}\n\n"
                last_status = status
            if job.status in ("done", "failed"):
                yield f"data: {json.dumps({**status, 'complete': True})}\n\n"
                break
        await asyncio.sleep(1)


@router.get("/stream/{job_id}")
async def stream_pipeline(job_id: str):
    return StreamingResponse(
        _event_generator(job_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
