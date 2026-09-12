"""Фабрики Bot и Dispatcher для Telegram.

Держим создание объектов aiogram в одном месте, чтобы шаблоны/раннеры не дублировали
настройку (parse_mode, storage и т.д.).
"""
from __future__ import annotations

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage

from core.config import settings


def create_bot(token: str | None = None) -> Bot:
    """Создать Bot с HTML-разметкой по умолчанию."""
    return Bot(
        token=token or settings.bot_token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )


def create_dispatcher() -> Dispatcher:
    """Создать Dispatcher.

    MemoryStorage подходит для одного процесса. Для нескольких воркеров/перезапусков
    без потери FSM используй RedisStorage (aiogram.fsm.storage.redis).
    """
    return Dispatcher(storage=MemoryStorage())
