"""Templates, preferences, bookmarks, and annotations routes."""

import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from datetime import datetime, timezone

from api.deps import get_current_user
from db.models import SavedTemplates, UserPreferences, Bookmarks, Annotations
from dependencies import get_db, limiter

router = APIRouter(tags=["user-data"])
log = logging.getLogger(__name__)


# --- Templates ---


class TemplateRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    label: str = Field(..., min_length=1, max_length=200)
    year_from: int | None = None
    year_to: int | None = None
    max_papers: int = 30
    sources: list[str] = ["arxiv", "github", "news"]


@router.post("/templates", status_code=201)
@limiter.limit("20/minute")
async def create_template(
    request: Request,
    req: TemplateRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    t = SavedTemplates(
        user_id=current_user.id,
        query=req.query,
        label=req.label,
        year_from=req.year_from,
        year_to=req.year_to,
        max_papers=req.max_papers,
        sources=req.sources,
    )
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return {"id": str(t.id), "query": t.query, "label": t.label}


@router.get("/templates")
@limiter.limit("30/minute")
async def list_templates(
    request: Request, current_user=Depends(get_current_user), db=Depends(get_db)
):
    result = await db.execute(
        select(SavedTemplates)
        .where(SavedTemplates.user_id == current_user.id)
        .order_by(SavedTemplates.created_at.desc())
    )
    templates = result.scalars().all()
    return {
        "templates": [
            {
                "id": str(t.id),
                "query": t.query,
                "label": t.label,
                "year_from": t.year_from,
                "year_to": t.year_to,
                "max_papers": t.max_papers,
                "sources": t.sources,
            }
            for t in templates
        ]
    }


@router.delete("/templates/{template_id}")
@limiter.limit("20/minute")
async def delete_template(
    request: Request,
    template_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    import uuid as _uuid

    try:
        tid = _uuid.UUID(template_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID")
    result = await db.execute(
        select(SavedTemplates).where(
            SavedTemplates.id == tid, SavedTemplates.user_id == current_user.id
        )
    )
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    await db.delete(t)
    await db.commit()
    return {"message": "Deleted"}


# --- Preferences ---


class PreferencesRequest(BaseModel):
    view_mode: str | None = None
    active_filters: list[str] | None = None
    theme: str | None = None


@router.get("/preferences")
@limiter.limit("30/minute")
async def get_preferences(
    request: Request, current_user=Depends(get_current_user), db=Depends(get_db)
):
    result = await db.execute(
        select(UserPreferences).where(UserPreferences.user_id == current_user.id)
    )
    prefs = result.scalar_one_or_none()
    if not prefs:
        prefs = UserPreferences(user_id=current_user.id)
        db.add(prefs)
        await db.commit()
        await db.refresh(prefs)
    return {
        "view_mode": prefs.view_mode,
        "active_filters": prefs.active_filters or [],
        "theme": prefs.theme,
    }


@router.put("/preferences")
@limiter.limit("20/minute")
async def update_preferences(
    request: Request,
    req: PreferencesRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    result = await db.execute(
        select(UserPreferences).where(UserPreferences.user_id == current_user.id)
    )
    prefs = result.scalar_one_or_none()
    if not prefs:
        prefs = UserPreferences(user_id=current_user.id)
        db.add(prefs)
    if req.view_mode is not None:
        prefs.view_mode = req.view_mode
    if req.active_filters is not None:
        prefs.active_filters = req.active_filters
    if req.theme is not None:
        prefs.theme = req.theme
    prefs.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {
        "view_mode": prefs.view_mode,
        "active_filters": prefs.active_filters or [],
        "theme": prefs.theme,
    }


# --- Bookmarks ---


class BookmarkRequest(BaseModel):
    node_id: str
    edge_source: str | None = None
    edge_target: str | None = None
    edge_type: str | None = None
    note: str | None = None


@router.post("/bookmarks", status_code=201)
@limiter.limit("30/minute")
async def create_bookmark(
    request: Request,
    req: BookmarkRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    bm = Bookmarks(
        user_id=current_user.id,
        node_id=req.node_id,
        edge_source=req.edge_source,
        edge_target=req.edge_target,
        edge_type=req.edge_type,
        note=req.note,
    )
    db.add(bm)
    await db.commit()
    await db.refresh(bm)
    return {
        "id": str(bm.id),
        "node_id": bm.node_id,
        "note": bm.note,
        "created_at": bm.created_at.isoformat(),
    }


@router.get("/bookmarks")
@limiter.limit("30/minute")
async def list_bookmarks(
    request: Request, current_user=Depends(get_current_user), db=Depends(get_db)
):
    result = await db.execute(
        select(Bookmarks)
        .where(Bookmarks.user_id == current_user.id)
        .order_by(Bookmarks.created_at.desc())
    )
    bms = result.scalars().all()
    return {
        "bookmarks": [
            {
                "id": str(b.id),
                "node_id": b.node_id,
                "edge_source": b.edge_source,
                "edge_target": b.edge_target,
                "edge_type": b.edge_type,
                "note": b.note,
                "created_at": b.created_at.isoformat(),
            }
            for b in bms
        ]
    }


@router.delete("/bookmarks/{bookmark_id}")
@limiter.limit("20/minute")
async def delete_bookmark(
    request: Request,
    bookmark_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    import uuid as _uuid

    try:
        bid = _uuid.UUID(bookmark_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID")
    result = await db.execute(
        select(Bookmarks).where(
            Bookmarks.id == bid, Bookmarks.user_id == current_user.id
        )
    )
    bm = result.scalar_one_or_none()
    if not bm:
        raise HTTPException(status_code=404, detail="Bookmark not found")
    await db.delete(bm)
    await db.commit()
    return {"message": "Deleted"}


# --- Annotations ---


class AnnotationRequest(BaseModel):
    node_id: str | None = None
    edge_source: str | None = None
    edge_target: str | None = None
    edge_type: str | None = None
    text: str = Field(..., min_length=1, max_length=2000)


@router.post("/annotations", status_code=201)
@limiter.limit("30/minute")
async def create_annotation(
    request: Request,
    req: AnnotationRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    ann = Annotations(
        user_id=current_user.id,
        node_id=req.node_id,
        edge_source=req.edge_source,
        edge_target=req.edge_target,
        edge_type=req.edge_type,
        text=req.text,
    )
    db.add(ann)
    await db.commit()
    await db.refresh(ann)
    return {
        "id": str(ann.id),
        "text": ann.text,
        "created_at": ann.created_at.isoformat(),
    }


@router.get("/annotations")
@limiter.limit("30/minute")
async def list_annotations(
    request: Request,
    node_id: str | None = None,
    edge_source: str | None = None,
    edge_target: str | None = None,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    query = select(Annotations).where(Annotations.user_id == current_user.id)
    if node_id:
        query = query.where(Annotations.node_id == node_id)
    if edge_source:
        query = query.where(Annotations.edge_source == edge_source)
    if edge_target:
        query = query.where(Annotations.edge_target == edge_target)
    result = await db.execute(query.order_by(Annotations.created_at.desc()))
    anns = result.scalars().all()
    return {
        "annotations": [
            {
                "id": str(a.id),
                "node_id": a.node_id,
                "edge_source": a.edge_source,
                "edge_target": a.edge_target,
                "edge_type": a.edge_type,
                "text": a.text,
                "created_at": a.created_at.isoformat(),
                "updated_at": a.updated_at.isoformat(),
            }
            for a in anns
        ]
    }


@router.patch("/annotations/{annotation_id}")
@limiter.limit("20/minute")
async def update_annotation(
    request: Request,
    annotation_id: str,
    req: AnnotationRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    import uuid as _uuid

    try:
        aid = _uuid.UUID(annotation_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID")
    result = await db.execute(
        select(Annotations).where(
            Annotations.id == aid, Annotations.user_id == current_user.id
        )
    )
    ann = result.scalar_one_or_none()
    if not ann:
        raise HTTPException(status_code=404, detail="Annotation not found")
    ann.text = req.text
    ann.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"id": str(ann.id), "text": ann.text}


@router.delete("/annotations/{annotation_id}")
@limiter.limit("20/minute")
async def delete_annotation(
    request: Request,
    annotation_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    import uuid as _uuid

    try:
        aid = _uuid.UUID(annotation_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID")
    result = await db.execute(
        select(Annotations).where(
            Annotations.id == aid, Annotations.user_id == current_user.id
        )
    )
    ann = result.scalar_one_or_none()
    if not ann:
        raise HTTPException(status_code=404, detail="Annotation not found")
    await db.delete(ann)
    await db.commit()
    return {"message": "Deleted"}

# --- Export log ---

class ExportRequest(BaseModel):
    kind: str = Field(..., min_length=1, max_length=50)
    target: str | None = Field(None, max_length=500)


@router.post("/exports", status_code=201)
@limiter.limit("60/minute")
async def log_export(request: Request, req: ExportRequest, current_user=Depends(get_current_user), db=Depends(get_db)):
    from db.models import ExportLog
    entry = ExportLog(user_id=current_user.id, kind=req.kind, target=req.target)
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return {"id": str(entry.id), "kind": entry.kind, "target": entry.target, "created_at": entry.created_at.isoformat()}


@router.get("/exports")
@limiter.limit("30/minute")
async def list_exports(request: Request, current_user=Depends(get_current_user), db=Depends(get_db)):
    from db.models import ExportLog
    result = await db.execute(
        select(ExportLog).where(ExportLog.user_id == current_user.id).order_by(ExportLog.created_at.desc()).limit(100)
    )
    entries = result.scalars().all()
    return {"exports": [{"id": str(e.id), "kind": e.kind, "target": e.target, "created_at": e.created_at.isoformat()} for e in entries]}
