import logging
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from agents import run_extraction, run_gap_finder, run_ingestion, run_synthesis
from api.deps import get_optional_user
from db.models import PipelineJobs
from api.schemas import PipelineRunRequest, PipelineRunResponse, PipelineStatusResponse
from dependencies import get_db, limiter, settings

router = APIRouter(prefix="/pipeline", tags=["pipeline"])


async def _update_job(db: AsyncSession, job_id: str, **kwargs):
    from sqlalchemy import update

    await db.execute(
        update(PipelineJobs).where(PipelineJobs.id == job_id).values(**kwargs)
    )
    await db.commit()


async def run_pipeline_background(job_id: str, req: PipelineRunRequest):
    from dependencies import _session_factory

    async with _session_factory() as db:
        try:
            await _update_job(db, job_id, status="ingesting")
            paper_ids = await run_ingestion(
                job_id,
                req.query,
                req.year_from,
                req.year_to,
                req.max_papers,
                req.sources,
            )
            await _update_job(
                db, job_id, status="extracting", papers_found=len(paper_ids)
            )
            entity_ids = await run_extraction(job_id, paper_ids)
            await _update_job(
                db, job_id, status="synthesizing", papers_processed=len(paper_ids)
            )
            rel_count = await run_synthesis(job_id, paper_ids)
            await _update_job(
                db, job_id, status="gap_finding", relationships_created=rel_count
            )
            await run_gap_finder(job_id)
            await _update_job(
                db,
                job_id,
                status="done",
                progress=100,
                completed_at=datetime.now(timezone.utc),
            )
        except Exception as e:
            logging.getLogger(__name__).error("Pipeline failed: %s", e)
            await _update_job(
                db,
                job_id,
                status="failed",
                error_message=str(e),
                completed_at=datetime.now(timezone.utc),
            )


@router.post("/run", response_model=PipelineRunResponse, status_code=202)
@limiter.limit("30/minute")
async def run_pipeline(
    request: Request,
    req: PipelineRunRequest,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    year_from = req.year_from or now.year - 1
    year_to = req.year_to or now.year

    job = PipelineJobs(
        query=req.query,
        status="pending",
        started_at=now,
        user_id=current_user.id if current_user else None,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    run_req = req.model_copy(update={"year_from": year_from, "year_to": year_to})
    background_tasks.add_task(run_pipeline_background, str(job.id), run_req)

    return PipelineRunResponse(
        job_id=str(job.id),
        status="pending",
        message="Pipeline started. Poll /pipeline/status/{job_id} for updates.",
    )


@router.get("/status/{job_id}", response_model=PipelineStatusResponse)
@limiter.limit("60/minute")
async def pipeline_status(
    request: Request, job_id: str, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(PipelineJobs).where(PipelineJobs.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Redact internal error details in production; truncate in dev
    error_msg = job.error_message
    if error_msg:
        if settings.ENV == "production":
            error_msg = "Pipeline failed. Check server logs for details."
        elif len(error_msg) > 200:
            error_msg = error_msg[:200] + "..."

    return PipelineStatusResponse(
        job_id=str(job.id),
        status=job.status,
        progress=job.progress,
        papers_found=job.papers_found,
        papers_processed=job.papers_processed,
        relationships_created=job.relationships_created,
        started_at=job.started_at.isoformat(),
        completed_at=job.completed_at.isoformat() if job.completed_at else None,
        error_message=error_msg,
    )
