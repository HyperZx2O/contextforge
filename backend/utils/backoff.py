"""Exponential backoff decorator for async functions with configurable retry limits."""

import asyncio
import functools
import random


def retry(max_attempts: int = 3, base_delay: float = 1.0, exceptions: tuple = (Exception,)):
    """Decorator factory — retries an async function with exponential backoff.

    Args:
        max_attempts: Maximum number of attempts (including the first call).
        base_delay: Base delay in seconds; doubles each retry with jitter.
        exceptions: Tuple of exception types to catch and retry on.

    Returns:
        Decorated async function.
    """
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            last_exc = None
            for attempt in range(max_attempts):
                try:
                    return await func(*args, **kwargs)
                except exceptions as exc:
                    last_exc = exc
                    if attempt < max_attempts - 1:
                        delay = base_delay * (2 ** attempt) + random.uniform(0, 0.5)
                        await asyncio.sleep(delay)
            raise last_exc

        return wrapper

    return decorator
