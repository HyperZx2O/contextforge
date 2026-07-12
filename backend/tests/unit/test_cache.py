import pytest

from utils.cache import cache_get, cache_set, make_cache_key


@pytest.mark.asyncio
@pytest.mark.skipif(
    not __import__("shutil").which("redis-server"),
    reason="Redis not available",
)
async def test_cache_set_and_get():
    await cache_set("test_key_123", "hello", ttl=60)
    val = await cache_get("test_key_123")
    assert val == "hello"


@pytest.mark.asyncio
@pytest.mark.skipif(
    not __import__("shutil").which("redis-server"),
    reason="Redis not available",
)
async def test_cache_miss():
    val = await cache_get("nonexistent_key_xyz")
    assert val is None


def test_make_cache_key():
    k1 = make_cache_key("arxiv_001", "arxiv_002")
    k2 = make_cache_key("arxiv_001", "arxiv_002")
    k3 = make_cache_key("arxiv_002", "arxiv_001")
    assert k1 == k2
    assert k1 != k3
    assert len(k1) == 64
