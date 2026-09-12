"""Сервис рассылки: отправляет текст всем активным пользователям.

- соблюдает лимит скорости (settings.broadcast_rate сообщений/сек);
- корректно обрабатывает RetryAfter (flood control) и Forbidden (бот заблокирован);
- заблокировавших помечает is_active=False, чтобы не слать им впредь;
- фиксирует результат в BroadcastJob.

Сервис управляет своими сессиями БД сам (рассылка длится долго — нельзя держать
одну сессию открытой всё время).
"""
from __future__ import annotations

import asyncio

from aiogram import Bot
from aiogram.exceptions import (
    TelegramBadRequest,
    TelegramForbiddenError,
    TelegramRetryAfter,
)

from core.config import settings
from core.database.base import get_session
from core.database.models import Platform
from core.database.repositories import BroadcastRepository, UserRepository
from core.logger import get_logger

log = get_logger(__name__)


async def run_broadcast(
    bot: Bot,
    *,
    admin_id: int,
    text: str,
    platform: str = Platform.TELEGRAM,
) -> tuple[int, int]:
    """Выполнить рассылку. Возвращает (sent, failed)."""
    # 1. Собираем получателей и создаём job
    async with get_session() as session:
        user_repo = UserRepository(session)
        recipient_ids = await user_repo.all_active_ids(platform)
        job = await BroadcastRepository(session).create(
            created_by=admin_id, platform=platform, text=text, total=len(recipient_ids)
        )
        job_id = job.id

    sent = 0
    failed = 0
    blocked_external_ids: list[int] = []
    delay = 1.0 / max(1, settings.broadcast_rate)

    # 2. Отправляем
    for external_id in recipient_ids:
        try:
            await bot.send_message(external_id, text)
            sent += 1
        except TelegramRetryAfter as e:
            # Flood control — ждём и повторяем этого получателя
            log.warning("Flood control, sleeping %s s", e.retry_after)
            await asyncio.sleep(e.retry_after)
            try:
                await bot.send_message(external_id, text)
                sent += 1
            except Exception:  # noqa: BLE001
                failed += 1
        except TelegramForbiddenError:
            # Пользователь заблокировал бота
            failed += 1
            blocked_external_ids.append(external_id)
        except TelegramBadRequest:
            # Чат не найден / удалён и т.п.
            failed += 1
            blocked_external_ids.append(external_id)
        except Exception as e:  # noqa: BLE001
            failed += 1
            log.error("Broadcast send error to %s: %s", external_id, e)

        await asyncio.sleep(delay)

    # 3. Помечаем заблокировавших неактивными и закрываем job
    async with get_session() as session:
        user_repo = UserRepository(session)
        for ext_id in blocked_external_ids:
            user = await user_repo.get(platform, ext_id)
            if user:
                await user_repo.mark_inactive(user.id)
        await BroadcastRepository(session).finish(job_id, sent=sent, failed=failed)

    log.info("Broadcast #%s done: sent=%s failed=%s", job_id, sent, failed)
    return sent, failed
