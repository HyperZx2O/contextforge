import logging
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from agents import run_extraction, run_gap_finder, run_ingestion, run_synthesis
from api.deps import require_api_key
from db.models import PipelineJob
from api.schemas import PipelineRunRequest, PipelineRunResponse, PipelineStatusResponse
from config import settings
from dependencies import get_db, limiter

router = APIRouter(prefix="/pipeline", tags=["pipeline"])


async def _update_job(db: AsyncSession, job_id: str, **kwargs):
    result = await db.execute(select(PipelineJob).where(PipelineJob.id == job_id))
    job = result.scalar_one_or_none()
    if job:
        for k, v in kwargs.items():
            setattr(job, k, v)
        await db.commit()


async def run_pipeline_background(job_id: str, req: PipelineRunRequest):
    from dependencies import _session_factory
    async with _session_factory() as db:
        try:
            await _update_job(db, job_id, status="ingesting")
            paper_ids = await run_ingestion(
                job_id, req.query, req.year_from, req.year_to,
                req.max_papers, req.sources,
            )
            await _update_job(db, job_id, status="extracting",
                              papers_found=len(paper_ids))
            entity_ids = await run_extraction(job_id, paper_ids)
            await _update_job(db, job_id, status="synthesizing",
                              papers_processed=len(entity_ids))
            rel_count = await run_synthesis(job_id, paper_ids)
            await _update_job(db, job_id, status="gap_finding",
                              relationships_created=rel_count)
            await run_gap_finder(job_id)
            await _update_job(db, job_id, status="done", progress=100,
                              completed_at=datetime.utcnow())
        except Exception as e:
            logging.getLogger(__name__).error("Pipeline failed: %s", e)
            await _update_job(db, job_id, status="failed",
                              error_message=str(e),
                              completed_at=datetime.utcnow())


@router.post("/run", response_model=PipelineRunResponse, status_code=202)
@limiter.limit("30/minute")
async def run_pipeline(
    request: Request,
    req: PipelineRunRequest,
    background_tasks: BackgroundTasks,
    _auth: None = Depends(require_api_key),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.utcnow()
    year_from = req.year_from or now.year - 1
    year_to = req.year_to or now.year

    job = PipelineJob(
        query=req.query,
        status="pending",
        started_at=now,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    run_req = req.model_copy(update={"year_from": year_from, "year_to": year_to})
    background_tasks.add_task(run_pipeline_background, job.id, run_req)

    return PipelineRunResponse(
        job_id=str(job.id),
        status="pending",
        message="Pipeline started. Poll /pipeline/status/{job_id} for updates.",
    )


@router.get("/status/{job_id}", response_model=PipelineStatusResponse)
async def pipeline_status(job_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PipelineJob).where(PipelineJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return PipelineStatusResponse(
        job_id=str(job.id),
        status=job.status,
        progress=job.progress,
        papers_found=job.papers_found,
        papers_processed=job.papers_processed,
        relationships_created=job.relationships_created,
        started_at=job.started_at.isoformat(),
        completed_at=job.completed_at.isoformat() if job.completed_at else None,
        error_message=job.error_message,
    )
