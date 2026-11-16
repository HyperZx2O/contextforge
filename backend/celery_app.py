"""Optional Celery app for production job queue.

Requires Redis (set REDIS_URL env var). Falls back to FastAPI BackgroundTasks
if Redis is unavailable.
"""

import os

try:
    from celery import Celery

    redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    celery_app = Celery("contextforge", broker=redis_url, backend=redis_url)
    celery_app.conf.task_serializer = "json"
    celery_app.conf.result_serializer = "json"
    celery_app.conf.accept_content = ["json"]
    celery_app.conf.task_track_started = True
    celery_app.conf.task_acks_late = True
    celery_app.conf.worker_prefetch_multiplier = 1

    @celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
    def run_pipeline_task(
        self,
        job_id: str,
        query: str,
        year_from: int,
        year_to: int,
        max_papers: int,
        sources: list[str],
    ):
        from agents import run_extraction, run_gap_finder, run_ingestion, run_synthesis
        from api.routes.pipeline import _update_job
        from dependencies import _session_factory
        from datetime import datetime, timezone
        import asyncio

        async def _run():
            async with _session_factory() as db:
                try:
                    await _update_job(db, job_id, status="ingesting")
                    paper_ids = await run_ingestion(
                        job_id, query, year_from, year_to, max_papers, sources
                    )
                    await _update_job(
                        db, job_id, status="extracting", papers_found=len(paper_ids)
                    )
                    entity_ids = await run_extraction(job_id, paper_ids)
                    await _update_job(
                        db,
                        job_id,
                        status="synthesizing",
                        papers_processed=len(paper_ids),
                    )
                    rel_count = await run_synthesis(job_id, paper_ids)
                    await _update_job(
                        db,
                        job_id,
                        status="gap_finding",
                        relationships_created=rel_count,
                    )
                    await run_gap_finder(job_id)
                    await _update_job(
                        db,
                        job_id,
                        status="done",
                        progress=100,
                        completed_at=datetime.now(timezone.utc),
                    )
                except Exception as exc:
                    await _update_job(
                        db,
                        job_id,
                        status="failed",
                        error_message=str(exc),
                        completed_at=datetime.now(timezone.utc),
                    )
                    raise self.retry(exc=exc)

        asyncio.run(_run())

    CELERY_AVAILABLE = True
except ImportError:
    celery_app = None
    CELERY_AVAILABLE = False
    run_pipeline_task = None
