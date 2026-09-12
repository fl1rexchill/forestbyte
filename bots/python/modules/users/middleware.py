"""UserMiddleware — регистрирует/обновляет пользователя на каждом апдейте.

- открывает сессию БД на время обработки апдейта (commit при успехе);
- get_or_create пользователя, обновляет профиль и last_seen;
- логирует входящее сообщение (для статистики);
- блокирует забаненных;
- прокидывает в хендлер `session` и `db_user`.
"""
from __future__ import annotations

from typing import Any, Awaitable, Callable

from aiogram import BaseMiddleware
from aiogram.types import CallbackQuery, Message, TelegramObject

from core.config import settings
from core.database.base import get_session
from core.database.models import Platform
from core.database.repositories import MessageRepository, UserRepository
from core.i18n import t


class UserMiddleware(BaseMiddleware):
    def __init__(self, platform: str = Platform.TELEGRAM) -> None:
        self.platform = platform

    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        tg_user = data.get("event_from_user")
        if tg_user is None:
            return await handler(event, data)

        async with get_session() as session:
            users = UserRepository(session)
            db_user, _created = await users.get_or_create(
                platform=self.platform,
                external_id=tg_user.id,
                username=tg_user.username,
                first_name=tg_user.first_name,
                last_name=tg_user.last_name,
                language_code=tg_user.language_code,
                is_admin=settings.is_admin(tg_user.id),
            )

            # Забаненным — стоп (кроме админов)
            if db_user.is_banned and not settings.is_admin(tg_user.id):
                locale = db_user.language_code or settings.default_locale
                if isinstance(event, Message):
                    await event.answer(t("common.banned", locale=locale))
                elif isinstance(event, CallbackQuery):
                    await event.answer(t("common.banned", locale=locale), show_alert=True)
                return None

            # Лог сообщения для статистики
            if isinstance(event, Message):
                await MessageRepository(session).log(
                    user_id=db_user.id,
                    platform=self.platform,
                    text=event.text or event.caption,
                    content_type=event.content_type,
                )

            data["session"] = session
            data["db_user"] = db_user
            return await handler(event, data)
