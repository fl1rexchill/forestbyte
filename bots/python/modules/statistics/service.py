"""Формирование текста статистики. Отделено от хендлеров для переиспользования."""
from __future__ import annotations

from core.database.models import Platform
from core.database.repositories import StatsRepository
from core.i18n import t
from sqlalchemy.ext.asyncio import AsyncSession


async def build_stats_text(
    session: AsyncSession, platform: str = Platform.TELEGRAM, locale: str = "ru"
) -> str:
    data = await StatsRepository(session).summary(platform)
    return (
        f"{t('stats.title', locale=locale)}\n\n"
        f"👥 Всего пользователей: <b>{data['total']}</b>\n\n"
        f"🆕 <b>Новые:</b>\n"
        f"  • за день: {data['new_day']}\n"
        f"  • за неделю: {data['new_week']}\n"
        f"  • за месяц: {data['new_month']}\n\n"
        f"⚡️ <b>Активные:</b>\n"
        f"  • за день (DAU): {data['active_day']}\n"
        f"  • за неделю (WAU): {data['active_week']}\n"
        f"  • за месяц (MAU): {data['active_month']}\n\n"
        f"💬 Сообщений за сутки: <b>{data['messages_day']}</b>"
    )
