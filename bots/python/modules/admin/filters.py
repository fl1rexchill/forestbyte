"""Фильтр доступа админа. Используется в роутерах admin/stats/broadcast."""
from __future__ import annotations

from aiogram.filters import BaseFilter
from aiogram.types import CallbackQuery, Message, TelegramObject

from core.config import settings


class IsAdmin(BaseFilter):
    """Пропускает только пользователей из ADMIN_IDS."""

    async def __call__(self, event: TelegramObject) -> bool:
        user = getattr(event, "from_user", None)
        if user is None:
            return False
        return settings.is_admin(user.id)
