"""Auth utilities - JWT tokens (HS256) and password hashing (PBKDF2).

Uses only Python standard library. No external dependencies.
"""

import base64
import hashlib
import hmac
import json
import os
import secrets
from datetime import datetime, timedelta, timezone

from config import settings

# Secret key for JWT signing. Must be set via JWT_SECRET in production;
# main.py refuses to start there without it.
DEV_JWT_SECRET = "dev-secret-change-in-production"
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES
REFRESH_TOKEN_EXPIRE_DAYS = settings.REFRESH_TOKEN_EXPIRE_DAYS


def get_jwt_secret() -> str:
    return settings.JWT_SECRET or DEV_JWT_SECRET


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(s: str) -> bytes:
    padding = 4 - len(s) % 4
    if padding != 4:
        s += "=" * padding
    return base64.urlsafe_b64decode(s)


def create_access_token(user_id: str, email: str) -> str:
    """Create a short-lived JWT access token."""
    header = {"alg": JWT_ALGORITHM, "typ": "JWT"}
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)).timestamp()),
        "type": "access",
    }
    header_b64 = _b64url_encode(json.dumps(header).encode())
    payload_b64 = _b64url_encode(json.dumps(payload).encode())
    signing_input = f"{header_b64}.{payload_b64}"
    signature = hmac.new(
        get_jwt_secret().encode(), signing_input.encode(), hashlib.sha256
    ).digest()
    sig_b64 = _b64url_encode(signature)
    return f"{signing_input}.{sig_b64}"


def create_refresh_token() -> str:
    """Create a random refresh token (opaque, not JWT)."""
    return secrets.token_urlsafe(48)


def hash_token(token: str) -> str:
    """Hash a token for storage (SHA-256)."""
    return hashlib.sha256(token.encode()).hexdigest()


def verify_access_token(token: str) -> dict | None:
    """Verify and decode a JWT access token. Returns payload or None."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts
        signing_input = f"{header_b64}.{payload_b64}"
        expected_sig = hmac.new(
            get_jwt_secret().encode(), signing_input.encode(), hashlib.sha256
        ).digest()
        actual_sig = _b64url_decode(sig_b64)
        if not hmac.compare_digest(expected_sig, actual_sig):
            return None
        payload = json.loads(_b64url_decode(payload_b64))
        if payload.get("type") != "access":
            return None
        if payload.get("exp", 0) < datetime.now(timezone.utc).timestamp():
            return None
        return payload
    except Exception:
        return None


GOOGLE_ISSUERS = ("accounts.google.com", "https://accounts.google.com")


def verify_google_id_token(credential: str, client_id: str) -> dict | None:
    """Verify a Google Identity Services ID token.

    Checks the RS256 signature against Google's published keys, plus audience,
    issuer and expiry. Returns the claims, or None if anything is off.
    """
    if not credential or not client_id:
        return None
    try:
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token as google_id_token

        claims = google_id_token.verify_oauth2_token(
            credential, google_requests.Request(), client_id
        )
    except Exception:
        return None

    if claims.get("iss") not in GOOGLE_ISSUERS:
        return None
    # An unverified address must not be trusted for account linking.
    if not claims.get("email_verified") or not claims.get("email"):
        return None
    return claims


def hash_password(password: str) -> str:
    """Hash a password using PBKDF2-HMAC-SHA256."""
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100000)
    return salt.hex() + ":" + key.hex()


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against a stored hash."""
    try:
        salt_hex, key_hex = password_hash.split(":")
        salt = bytes.fromhex(salt_hex)
        key = bytes.fromhex(key_hex)
        new_key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100000)
        return hmac.compare_digest(key, new_key)
    except Exception:
        return False
