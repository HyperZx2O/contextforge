"""Saved runs routes - save, list, load, delete user runs."""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from neo4j import AsyncSession as Neo4jSession

from api.deps import get_current_user, get_optional_user
from db.models import SavedRuns, Users
from dependencies import get_db, get_neo4j, limiter

router = APIRouter(prefix="/runs", tags=["runs"])
log = logging.getLogger(__name__)


class SaveRunRequest(BaseModel):
    label: str | None = Field(None, max_length=200)
    is_public: bool = False


class RunResponse(BaseModel):
    id: str
    query: str
    label: str | None
    is_public: bool
    node_count: int
    edge_count: int
    gap_count: int
    created_at: str
    updated_at: str


@router.post("", status_code=201)
@limiter.limit("20/minute")
async def save_run(
    request: Request,
    req: SaveRunRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
    neo4j=Depends(get_neo4j),
):
    # Count nodes/edges/gaps for this user
    try:
        node_res = await neo4j.run(
            "MATCH (n) WHERE n.owner_id = $uid OR n.owner_id IS NULL RETURN count(n) AS c",
            uid=str(current_user.id),
        )
        node_rec = [r async for r in node_res]
        node_count = node_rec[0]["c"] if node_rec else 0

        edge_res = await neo4j.run("MATCH ()-[r]->() RETURN count(r) AS c")
        edge_rec = [r async for r in edge_res]
        edge_count = edge_rec[0]["c"] if edge_rec else 0

        gap_res = await neo4j.run("MATCH (g:Gap) RETURN count(g) AS c")
        gap_rec = [r async for r in gap_res]
        gap_count = gap_rec[0]["c"] if gap_rec else 0
    except Exception:
        node_count = edge_count = gap_count = 0

    run = SavedRuns(
        user_id=current_user.id,
        query=req.label or "Untitled run",
        label=req.label,
        is_public=1 if req.is_public else 0,
        node_count=node_count,
        edge_count=edge_count,
        gap_count=gap_count,
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    return {
        "id": str(run.id),
        "query": run.query,
        "label": run.label,
        "is_public": bool(run.is_public),
        "node_count": run.node_count,
        "edge_count": run.edge_count,
        "gap_count": run.gap_count,
        "created_at": run.created_at.isoformat(),
        "updated_at": run.updated_at.isoformat(),
    }


@router.get("")
@limiter.limit("30/minute")
async def list_runs(
    request: Request, current_user=Depends(get_current_user), db=Depends(get_db)
):
    result = await db.execute(
        select(SavedRuns)
        .where(SavedRuns.user_id == current_user.id)
        .order_by(SavedRuns.created_at.desc())
    )
    runs = result.scalars().all()
    return {
        "runs": [
            {
                "id": str(r.id),
                "query": r.query,
                "label": r.label,
                "is_public": bool(r.is_public),
                "node_count": r.node_count,
                "edge_count": r.edge_count,
                "gap_count": r.gap_count,
                "created_at": r.created_at.isoformat(),
                "updated_at": r.updated_at.isoformat(),
            }
            for r in runs
        ]
    }


@router.get("/{run_id}")
@limiter.limit("30/minute")
async def get_run(
    request: Request,
    run_id: str,
    current_user=Depends(get_optional_user),
    db=Depends(get_db),
    neo4j=Depends(get_neo4j),
):
    import uuid as _uuid

    try:
        rid = _uuid.UUID(run_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid run ID")

    result = await db.execute(select(SavedRuns).where(SavedRuns.id == rid))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if not run.is_public and (
        not current_user or str(current_user.id) != str(run.user_id)
    ):
        raise HTTPException(status_code=403, detail="Access denied")

    # Fetch graph data
    try:
        node_res = await neo4j.run(
            "MATCH (n) WHERE n.owner_id = $uid OR n.owner_id IS NULL RETURN n",
            uid=str(run.user_id),
        )
        nodes = [r["n"] for r in [rec async for rec in node_res]]
        edge_res = await neo4j.run("MATCH (a)-[r]->(b) RETURN a, r, b")
        edges = [r for r in [rec async for rec in edge_res]]
    except Exception:
        nodes = []
        edges = []

    return {
        "id": str(run.id),
        "query": run.query,
        "label": run.label,
        "is_public": bool(run.is_public),
        "node_count": run.node_count,
        "edge_count": run.edge_count,
        "gap_count": run.gap_count,
        "created_at": run.created_at.isoformat(),
        "nodes": nodes,
        "edges": edges,
    }


@router.patch("/{run_id}")
@limiter.limit("20/minute")
async def update_run(
    request: Request,
    run_id: str,
    req: SaveRunRequest,
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
        raise HTTPException(status_code=404, detail="Run not found")

    if req.label is not None:
        run.label = req.label
    run.is_public = 1 if req.is_public else 0
    run.updated_at = datetime.now(timezone.utc)
    await db.commit()

    return {"id": str(run.id), "label": run.label, "is_public": bool(run.is_public)}


@router.delete("/{run_id}")
@limiter.limit("20/minute")
async def delete_run(
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
        raise HTTPException(status_code=404, detail="Run not found")

    await db.delete(run)
    await db.commit()
    return {"message": "Run deleted"}
