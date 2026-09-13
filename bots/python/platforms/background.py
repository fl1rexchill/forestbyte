"""Фоновая обработка входящих событий платформ (Instagram, MAX).

Вебхук отвечает платформе 200 сразу, а события обрабатываются воркерами:
  - N воркеров, у каждого своя очередь;
  - события одного ключа (отправителя) всегда попадают к одному воркеру → порядок сохраняется,
    а разные собеседники обрабатываются параллельно;
  - ошибка обработчика логируется и не останавливает воркер;
  - stop() дожидается обработки всего, что уже принято (корректная остановка).

Состояние живёт в памяти процесса: при аварийном падении принятые, но не обработанные
события теряются (платформа уже получила 200). Для гарантированной доставки нужна
внешняя очередь — см. docs/DEPLOYMENT.md.
"""
from __future__ import annotations

import asyncio
import zlib
from collections.abc import Awaitable, Callable
from typing import Generic, TypeVar

from sqlalchemy.pool import SingletonThreadPool, StaticPool

from core.database.base import engine
from core.logger import get_logger

log = get_logger(__name__)

T = TypeVar("T")


def shares_db_connection() -> bool:
    """True, если все сессии БД идут через одно соединение (SQLite :memory: → StaticPool).

    На таком пуле параллельные сессии не изолированы: закрытая сессия возвращает соединение
    в пул с ROLLBACK и стирает чужие незакоммиченные INSERT, а чужой commit() потом проходит
    без ошибки — запись теряется молча. Поэтому диспетчеры платформ в этом случае держат
    сессии по одной. У файловой SQLite и PostgreSQL у каждой сессии своё соединение.
    """
    return isinstance(engine.pool, (StaticPool, SingletonThreadPool))


class KeyedWorkerPool(Generic[T]):
    """Пул воркеров с привязкой ключа к воркеру (порядок внутри ключа сохраняется)."""

    def __init__(
        self, handler: Callable[[T], Awaitable[None]], *, workers: int = 4, name: str = "events"
    ) -> None:
        if workers < 1:
            raise ValueError("workers должно быть >= 1")
        self._handler = handler
        self._size = workers
        self._name = name
        self._queues: list[asyncio.Queue[T]] = []
        self._tasks: list[asyncio.Task[None]] = []

    @property
    def running(self) -> bool:
        return bool(self._tasks)

    async def start(self) -> None:
        if self._tasks:
            return
        self._queues = [asyncio.Queue() for _ in range(self._size)]
        self._tasks = [
            asyncio.create_task(self._worker(queue), name=f"{self._name}-worker-{i}")
            for i, queue in enumerate(self._queues)
        ]

    def submit(self, key: str, item: T) -> None:
        """Поставить событие в очередь воркера, закреплённого за ключом."""
        if not self._tasks:
            raise RuntimeError(f"{self._name}: пул не запущен (вызовите start())")
        index = zlib.crc32(key.encode("utf-8")) % self._size
        self._queues[index].put_nowait(item)

    async def drain(self) -> None:
        """Дождаться обработки всего, что уже в очередях."""
        for queue in self._queues:
            await queue.join()

    async def stop(self) -> None:
        """Обработать принятое и остановить воркеры."""
        if not self._tasks:
            return
        await self.drain()
        for task in self._tasks:
            task.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks = []
        self._queues = []

    async def _worker(self, queue: asyncio.Queue[T]) -> None:
        while True:
            item = await queue.get()
            try:
                await self._handler(item)
            except Exception:  # noqa: BLE001 — одно событие не должно останавливать воркер
                log.exception("%s: ошибка обработчика", self._name)
            finally:
                queue.task_done()
