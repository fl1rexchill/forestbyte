"""Фоновый цикл планировщика: раз в N секунд шлёт наступившие задачи.

Регистрируется на старте бота через setup(dp). Использует те же рассылки/БД.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from aiogram import Bot, Dispatcher
from sqlalchemy import select

from core.database.base import get_session
from core.database.models import Platform
from core.database.repositories import UserRepository
from core.logger import get_logger
from modules.scheduler.models import ScheduledPost

log = get_logger(__name__)

CHECK_INTERVAL = 30  # секунд


async def _deliver(bot: Bot, post: ScheduledPost) -> None:
    """Отправить одну задачу по её target."""
    if post.target == "all":
        async with get_session() as session:
            ids = await UserRepository(session).all_active_ids(Platform.TELEGRAM)
        for uid in ids:
            try:
                await bot.send_message(uid, post.text)
            except Exception:  # noqa: BLE001
                pass
            await asyncio.sleep(0.04)
    else:
        try:
            await bot.send_message(int(post.target), post.text)
        except Exception as e:  # noqa: BLE001
            log.error("Scheduled post %s delivery failed: %s", post.id, e)


async def scheduler_loop(bot: Bot) -> None:
    """Бесконечный цикл проверки и отправки наступивших задач."""
    log.info("Scheduler loop started (interval=%ss)", CHECK_INTERVAL)
    while True:
        try:
            now = datetime.now(timezone.utc)
            async with get_session() as session:
                due = list(
                    await session.scalars(
                        select(ScheduledPost).where(
                            ScheduledPost.status == "pending",
                            ScheduledPost.run_at <= now,
                        )
                    )
                )
                for post in due:
                    post.status = "done"  # помечаем до отправки, чтобы не дублировать
            for post in due:
                await _deliver(bot, post)
                log.info("Scheduled post %s delivered", post.id)
        except asyncio.CancelledError:
            log.info("Scheduler loop cancelled")
            raise
        except Exception as e:  # noqa: BLE001
            log.error("Scheduler loop error: %s", e)
        await asyncio.sleep(CHECK_INTERVAL)


def setup(dp: Dispatcher) -> None:
    """Подключить планировщик к жизненному циклу бота."""

    @dp.startup()
    async def _start(bot: Bot, **_: object) -> None:
        dp["_scheduler_task"] = asyncio.create_task(scheduler_loop(bot))

    @dp.shutdown()
    async def _stop(**_: object) -> None:
        task = dp.get("_scheduler_task")
        if task:
            task.cancel()
