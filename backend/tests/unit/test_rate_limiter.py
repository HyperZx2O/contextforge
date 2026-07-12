import asyncio
import time

import pytest

from utils.rate_limiter import TokenBucket


@pytest.mark.asyncio
async def test_rate_limiter_blocks():
    bucket = TokenBucket(rate=3.0)
    start = time.monotonic()
    for _ in range(4):
        await bucket.acquire()
    elapsed = time.monotonic() - start
    assert elapsed >= 0.9, f"Expected >= 0.9s for 4 calls at 3/sec, got {elapsed:.3f}s"


@pytest.mark.asyncio
async def test_rate_limiter_allows_burst():
    bucket = TokenBucket(rate=10.0)
    start = time.monotonic()
    for _ in range(3):
        await bucket.acquire()
    elapsed = time.monotonic() - start
    assert elapsed < 0.5, f"Expected < 0.5s for 3 calls at 10/sec, got {elapsed:.3f}s"
