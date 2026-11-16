"""Auth dependencies for FastAPI routes."""

import uuid

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select

from auth import verify_access_token
from db.models import _USE_PG, Users
from dependencies import get_db


def _subject_id(payload: dict) -> str | uuid.UUID | None:
    """Token subject as the type the Users.id column expects."""
    sub = payload.get("sub")
    if not sub:
        return None
    if not _USE_PG:
        return sub
    try:
        return uuid.UUID(sub)
    except (TypeError, ValueError):
        return None


async def get_current_user(request: Request, db=Depends(get_db)):
    """Extract and validate the current user from the JWT access token.

    Returns the Users ORM object, or raises 401.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=401, detail="Missing or invalid authorization header"
        )

    token = auth_header[7:]
    payload = verify_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired access token")

    user_id = _subject_id(payload)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid access token")

    result = await db.execute(select(Users).where(Users.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or disabled")

    return user


async def get_optional_user(request: Request, db=Depends(get_db)):
    """Like get_current_user but returns None instead of raising 401."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header[7:]
    payload = verify_access_token(token)
    if not payload:
        return None
    user_id = _subject_id(payload)
    if user_id is None:
        return None
    result = await db.execute(select(Users).where(Users.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        return None
    return user
