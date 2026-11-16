"""Graph versions routes - versioned graph configurations per saved run."""

import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select

from api.deps import get_current_user
from db.models import GraphVersions, SavedRuns
from dependencies import get_db, limiter

router = APIRouter(prefix="/versions", tags=["versions"])
log = logging.getLogger(__name__)


class VersionRequest(BaseModel):
    version_name: str = Field(..., min_length=1, max_length=100)
    filter_settings: dict | None = None
    layout_state: dict | None = None


class VersionResponse(BaseModel):
    id: str
    run_id: str
    version_name: str
    filter_settings: dict | None
    layout_state: dict | None
    node_count: int
    edge_count: int
    gap_count: int
    created_at: str


@router.post("", status_code=201)
@limiter.limit("20/minute")
async def create_version(
    request: Request,
    run_id: str,
    req: VersionRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    import uuid as _uuid

    try:
        rid = _uuid.UUID(run_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid run ID")

    result = await db.execute(
        select(SavedRuns).where(
            SavedRuns.id == rid, SavedRuns.user_id == current_user.id
        )
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found or access denied")

    version = GraphVersions(
        run_id=run.id,
        version_name=req.version_name,
        filter_settings=req.filter_settings,
        layout_state=req.layout_state,
    )
    db.add(version)
    await db.commit()
    await db.refresh(version)

    return VersionResponse(
        id=str(version.id),
        run_id=str(version.run_id),
        version_name=version.version_name,
        filter_settings=version.filter_settings,
        layout_state=version.layout_state,
        node_count=version.node_count,
        edge_count=version.edge_count,
        gap_count=version.gap_count,
        created_at=version.created_at.isoformat(),
    )


@router.get("/{run_id}")
@limiter.limit("30/minute")
async def list_versions(
    request: Request,
    run_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    import uuid as _uuid

    try:
        rid = _uuid.UUID(run_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid run ID")

    result = await db.execute(
        select(SavedRuns).where(
            SavedRuns.id == rid, SavedRuns.user_id == current_user.id
        )
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found or access denied")

    result = await db.execute(
        select(GraphVersions)
        .where(GraphVersions.run_id == run.id)
        .order_by(GraphVersions.created_at.desc())
    )
    versions = result.scalars().all()

    return {
        "versions": [
            {
                "id": str(v.id),
                "run_id": str(v.run_id),
                "version_name": v.version_name,
                "filter_settings": v.filter_settings,
                "layout_state": v.layout_state,
                "node_count": v.node_count,
                "edge_count": v.edge_count,
                "gap_count": v.gap_count,
                "created_at": v.created_at.isoformat(),
            }
            for v in versions
        ]
    }


@router.get("/{run_id}/{version_id}")
@limiter.limit("30/minute")
async def get_version(
    request: Request,
    run_id: str,
    version_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    import uuid as _uuid

    try:
        rid = _uuid.UUID(run_id)
        vid = _uuid.UUID(version_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID")

    result = await db.execute(
        select(SavedRuns).where(
            SavedRuns.id == rid, SavedRuns.user_id == current_user.id
        )
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found or access denied")

    result = await db.execute(
        select(GraphVersions).where(
            GraphVersions.id == vid, GraphVersions.run_id == run.id
        )
    )
    version = result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    return {
        "id": str(version.id),
        "run_id": str(version.run_id),
        "version_name": version.version_name,
        "filter_settings": version.filter_settings,
        "layout_state": version.layout_state,
        "node_count": version.node_count,
        "edge_count": version.edge_count,
        "gap_count": version.gap_count,
        "created_at": version.created_at.isoformat(),
    }


@router.patch("/{run_id}/{version_id}")
@limiter.limit("20/minute")
async def update_version(
    request: Request,
    run_id: str,
    version_id: str,
    req: VersionRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    import uuid as _uuid

    try:
        rid = _uuid.UUID(run_id)
        vid = _uuid.UUID(version_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID")

    result = await db.execute(
        select(SavedRuns).where(
            SavedRuns.id == rid, SavedRuns.user_id == current_user.id
        )
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found or access denied")

    result = await db.execute(
        select(GraphVersions).where(
            GraphVersions.id == vid, GraphVersions.run_id == run.id
        )
    )
    version = result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    if req.version_name is not None:
        version.version_name = req.version_name
    if req.filter_settings is not None:
        version.filter_settings = req.filter_settings
    if req.layout_state is not None:
        version.layout_state = req.layout_state

    await db.commit()

    return {
        "id": str(version.id),
        "version_name": version.version_name,
        "filter_settings": version.filter_settings,
        "layout_state": version.layout_state,
    }


@router.delete("/{run_id}/{version_id}")
@limiter.limit("20/minute")
async def delete_version(
    request: Request,
    run_id: str,
    version_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    import uuid as _uuid

    try:
        rid = _uuid.UUID(run_id)
        vid = _uuid.UUID(version_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID")

    result = await db.execute(
        select(SavedRuns).where(
            SavedRuns.id == rid, SavedRuns.user_id == current_user.id
        )
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found or access denied")

    result = await db.execute(
        select(GraphVersions).where(
            GraphVersions.id == vid, GraphVersions.run_id == run.id
        )
    )
    version = result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    await db.delete(version)
    await db.commit()
    return {"message": "Version deleted"}
