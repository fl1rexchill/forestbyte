"""platforms/background.KeyedWorkerPool: порядок внутри ключа, изоляция ошибок, drain/stop."""
from __future__ import annotations

import asyncio
import random

import pytest

from platforms.background import KeyedWorkerPool


async def test_order_per_key_and_parallel_keys():
    seen: list[tuple[str, int]] = []

    async def handler(item: tuple[str, int]) -> None:
        await asyncio.sleep(random.uniform(0, 0.003))
        seen.append(item)

    pool: KeyedWorkerPool[tuple[str, int]] = KeyedWorkerPool(handler, workers=3)
    await pool.start()
    for n in range(10):
        for key in ("a", "b", "c"):
            pool.submit(key, (key, n))
    await pool.stop()

    assert len(seen) == 30
    for key in ("a", "b", "c"):
        assert [n for k, n in seen if k == key] == list(range(10))


async def test_error_does_not_stop_worker():
    done: list[int] = []

    async def handler(n: int) -> None:
        if n == 1:
            raise RuntimeError("boom")
        done.append(n)

    pool: KeyedWorkerPool[int] = KeyedWorkerPool(handler, workers=1)
    await pool.start()
    for n in range(4):
        pool.submit("k", n)
    await pool.drain()
    assert done == [0, 2, 3]
    await pool.stop()
    assert not pool.running


async def test_submit_requires_start():
    async def handler(_: int) -> None:
        pass

    pool: KeyedWorkerPool[int] = KeyedWorkerPool(handler)
    with pytest.raises(RuntimeError):
        pool.submit("k", 1)
    with pytest.raises(ValueError):
        KeyedWorkerPool(handler, workers=0)
