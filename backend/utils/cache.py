"""Redis-backed key-value cache for LLM output and deduplication lookups."""

import hashlib

import redis.asyncio as aioredis

_redis = None


async def _get_redis():
    global _redis
    if _redis is None:
        from config import settings
        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


async def cache_get(key: str) -> str | None:
    """Get a value from Redis cache.

    Args:
        key: Cache key.

    Returns:
        Cached value as string, or None on miss.
    """
    r = await _get_redis()
    return await r.get(key)


async def cache_set(key: str, value: str, ttl: int = 3600):
    """Set a value in Redis cache with a TTL.

    Args:
        key: Cache key.
        value: Value to store.
        ttl: Time-to-live in seconds (default 3600).
    """
    r = await _get_redis()
    await r.set(key, value, ex=ttl)


def make_cache_key(*parts: str) -> str:
    """Generate a SHA-256 cache key from concatenated string parts.

    Args:
        *parts: Strings to concatenate and hash.

    Returns:
        64-char hex SHA-256 hash.
    """
    raw = "".join(parts)
    return hashlib.sha256(raw.encode()).hexdigest()


async def close_cache():
    """Close the Redis connection and reset the global reference."""
    global _redis
    if _redis is not None:
        await _redis.close()
        _redis = None
