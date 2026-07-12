import pytest

from utils.backoff import retry


class FakeError(Exception):
    pass


@pytest.mark.asyncio
async def test_retry_succeeds_after_failures():
    call_count = 0

    @retry(max_attempts=3, base_delay=0.01, exceptions=(FakeError,))
    async def flaky():
        nonlocal call_count
        call_count += 1
        if call_count < 3:
            raise FakeError("fail")
        return "ok"

    result = await flaky()
    assert result == "ok"
    assert call_count == 3


@pytest.mark.asyncio
async def test_retry_exhausts_attempts():
    call_count = 0

    @retry(max_attempts=3, base_delay=0.01, exceptions=(FakeError,))
    async def always_fail():
        nonlocal call_count
        call_count += 1
        raise FakeError("fail")

    with pytest.raises(FakeError):
        await always_fail()
    assert call_count == 3


@pytest.mark.asyncio
async def test_retry_does_not_catch_unlisted():
    @retry(max_attempts=3, base_delay=0.01, exceptions=(FakeError,))
    async def wrong_error():
        raise ValueError("different")

    with pytest.raises(ValueError):
        await wrong_error()
