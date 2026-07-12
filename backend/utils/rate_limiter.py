"""Async token-bucket rate limiter for external API calls (e.g. arXiv at 3 req/sec)."""

import asyncio
import time


class TokenBucket:
    """Async token-bucket rate limiter. Blocks callers until a token is available.

    Args:
        rate: Tokens per second (default 3.0).
    """
    def __init__(self, rate: float = 3.0):
        self.rate = rate
        self.interval = 1.0 / rate
        self._last = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self):
        """Block until a token is available. Thread-safe via asyncio.Lock."""
        async with self._lock:
            now = time.monotonic()
            wait = self._last + self.interval - now
            if wait > 0:
                await asyncio.sleep(wait)
            self._last = time.monotonic()


default_limiter = TokenBucket(rate=3.0)
