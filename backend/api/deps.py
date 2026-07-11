from fastapi import Header, HTTPException

from config import settings


async def require_api_key(x_api_key: str | None = Header(default=None)):
    """API-key auth dependency. When API_KEY is empty (dev mode), all requests pass."""
    if not settings.API_KEY:
        return
    if x_api_key != settings.API_KEY:
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHORIZED", "message": "Invalid or missing API key"},
        )
