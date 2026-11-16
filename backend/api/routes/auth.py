"""Auth routes - register, login, refresh, logout."""

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import select

from auth import (
    REFRESH_TOKEN_EXPIRE_DAYS,
    create_access_token,
    create_refresh_token,
    hash_password,
    hash_token,
    verify_google_id_token,
    verify_password,
)
from config import settings
from db.models import RefreshTokens, Users
from dependencies import get_db, limiter

router = APIRouter(prefix="/auth", tags=["auth"])
log = logging.getLogger(__name__)


class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    display_name: str | None = Field(None, max_length=100)


class LoginRequest(BaseModel):
    email: str
    password: str


class GoogleLoginRequest(BaseModel):
    # The ID token (JWT) returned by Google Identity Services on the client.
    credential: str = Field(..., min_length=20, max_length=8192)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


REFRESH_COOKIE_PATH = "/auth"


def _cookie_flags() -> tuple[bool, str]:
    """Secure/SameSite settings for the refresh cookie.

    Production serves the frontend from a different site than the API, so the
    cookie needs SameSite=None to be sent at all; local development is plain
    http, where a Secure cookie would never be stored.
    """
    if settings.REFRESH_COOKIE_SECURE is None:
        secure = settings.ENV == "production"
    else:
        secure = settings.REFRESH_COOKIE_SECURE
    samesite = settings.REFRESH_COOKIE_SAMESITE or ("none" if secure else "lax")
    return secure, samesite


def _set_refresh_cookie(response: Response, token: str):
    secure, samesite = _cookie_flags()
    response.set_cookie(
        key="refresh_token",
        value=token,
        httponly=True,
        secure=secure,
        samesite=samesite,
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path=REFRESH_COOKIE_PATH,
    )


def _clear_refresh_cookie(response: Response):
    secure, samesite = _cookie_flags()
    response.delete_cookie(
        "refresh_token", path=REFRESH_COOKIE_PATH, secure=secure, samesite=samesite
    )


# Marker stored in password_hash for accounts that have no local password
# (Google sign-in). It can never match verify_password().
UNUSABLE_PASSWORD = "!"


def _normalize_email(email: str) -> str:
    return email.strip().lower()


async def _open_session(db, user: Users) -> tuple[str, str]:
    """Issue an access token plus a stored refresh token for a user."""
    access_token = create_access_token(str(user.id), user.email)
    refresh_token = create_refresh_token()
    db.add(
        RefreshTokens(
            user_id=user.id,
            token_hash=hash_token(refresh_token),
            expires_at=datetime.now(timezone.utc)
            + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        )
    )
    await db.commit()
    return access_token, refresh_token


def _user_payload(user: Users) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "display_name": user.display_name,
    }


def _as_utc(value: datetime) -> datetime:
    """SQLite drops timezone info; treat naive timestamps as UTC."""
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)

@router.post("/register", response_model=TokenResponse, status_code=201)
@limiter.limit("5/minute")
async def register(
    request: Request, req: RegisterRequest, response: Response, db=Depends(get_db)
):
    email = _normalize_email(req.email)

    result = await db.execute(select(Users).where(Users.email == email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = Users(
        email=email,
        password_hash=hash_password(req.password),
        display_name=req.display_name or email.split("@")[0],
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Create tokens
    access_token = create_access_token(str(user.id), user.email)
    refresh_token = create_refresh_token()
    db.add(
        RefreshTokens(
            user_id=user.id,
            token_hash=hash_token(refresh_token),
            expires_at=datetime.now(timezone.utc)
            + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        )
    )
    await db.commit()

    _set_refresh_cookie(response, refresh_token)

    return TokenResponse(
        access_token=access_token,
        user={
            "id": str(user.id),
            "email": user.email,
            "display_name": user.display_name,
        },
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(
    request: Request, req: LoginRequest, response: Response, db=Depends(get_db)
):
    result = await db.execute(
        select(Users).where(Users.email == _normalize_email(req.email))
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    access_token = create_access_token(str(user.id), user.email)
    refresh_token = create_refresh_token()
    db.add(
        RefreshTokens(
            user_id=user.id,
            token_hash=hash_token(refresh_token),
            expires_at=datetime.now(timezone.utc)
            + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        )
    )
    await db.commit()

    _set_refresh_cookie(response, refresh_token)

    return TokenResponse(
        access_token=access_token,
        user={
            "id": str(user.id),
            "email": user.email,
            "display_name": user.display_name,
        },
    )


@router.post("/google", response_model=TokenResponse)
@limiter.limit("10/minute")
async def google_login(
    request: Request,
    req: GoogleLoginRequest,
    response: Response,
    db=Depends(get_db),
):
    """Exchange a Google ID token for our own access/refresh session."""
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=503, detail="Google sign-in is not configured"
        )

    claims = verify_google_id_token(req.credential, settings.GOOGLE_CLIENT_ID)
    if not claims:
        raise HTTPException(status_code=401, detail="Invalid Google credential")
    # A Google address is only trusted for account linking when verified.
    if not claims.get("email_verified") or not claims.get("email"):
        raise HTTPException(status_code=401, detail="Google email is not verified")

    email = _normalize_email(claims["email"])
    result = await db.execute(select(Users).where(Users.email == email))
    user = result.scalar_one_or_none()

    if user is None:
        # First sign-in from Google: create the local row everything else FKs to.
        user = Users(
            email=email,
            password_hash=UNUSABLE_PASSWORD,
            display_name=(claims.get("name") or email.split("@")[0])[:100],
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    elif not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    access_token, refresh_token = await _open_session(db, user)
    _set_refresh_cookie(response, refresh_token)

    return TokenResponse(access_token=access_token, user=_user_payload(user))


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("20/minute")
async def refresh(request: Request, response: Response, db=Depends(get_db)):
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")

    token_hash = hash_token(refresh_token)
    result = await db.execute(
        select(RefreshTokens).where(
            RefreshTokens.token_hash == token_hash,
            RefreshTokens.revoked == 0,
        )
    )
    stored = result.scalar_one_or_none()

    if not stored or _as_utc(stored.expires_at) < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    # Revoke old token
    stored.revoked = 1
    await db.commit()

    # Get user
    result = await db.execute(select(Users).where(Users.id == stored.user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or disabled")

    # Issue new tokens
    access_token = create_access_token(str(user.id), user.email)
    new_refresh = create_refresh_token()
    db.add(
        RefreshTokens(
            user_id=user.id,
            token_hash=hash_token(new_refresh),
            expires_at=datetime.now(timezone.utc)
            + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        )
    )
    await db.commit()

    _set_refresh_cookie(response, new_refresh)

    return TokenResponse(
        access_token=access_token,
        user={
            "id": str(user.id),
            "email": user.email,
            "display_name": user.display_name,
        },
    )


@router.post("/logout")
async def logout(request: Request, response: Response, db=Depends(get_db)):
    refresh_token = request.cookies.get("refresh_token")
    if refresh_token:
        token_hash = hash_token(refresh_token)
        result = await db.execute(
            select(RefreshTokens).where(RefreshTokens.token_hash == token_hash)
        )
        stored = result.scalar_one_or_none()
        if stored:
            stored.revoked = 1
            await db.commit()

    _clear_refresh_cookie(response)
    return {"message": "Logged out"}
