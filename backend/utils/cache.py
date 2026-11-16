"""In-memory key-value cache for LLM output and deduplication lookups.

A plain dict is sufficient for a single-process server. Upgrade to Redis if
multi-process caching or persistence is needed.
"""

import hashlib
import time

_cache: dict[str, tuple[str, float]] = {}


async def cache_get(key: str) -> str | None:
    entry = _cache.get(key)
    if entry is None:
        return None
    value, expiry = entry
    if time.monotonic() > expiry:
        del _cache[key]
        return None
    return value


async def cache_set(key: str, value: str, ttl: int = 3600):
    _cache[key] = (value, time.monotonic() + ttl)


def make_cache_key(*parts: str) -> str:
    raw = "".join(parts)
    return hashlib.sha256(raw.encode()).hexdigest()
