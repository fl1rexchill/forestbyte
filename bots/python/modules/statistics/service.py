"""Формирование текста статистики. Отделено от хендлеров для переиспользования.

По умолчанию считает все платформы (telegram/instagram/max) и, если активных платформ
больше одной, добавляет разбивку. platform=... — статистика одной платформы.
"""
from __future__ import annotations

from core.database.models import Platform
from core.database.repositories import StatsRepository
from core.i18n import t
from sqlalchemy.ext.asyncio import AsyncSession


def _render(data: dict[str, int], locale: str) -> str:
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


async def build_stats_text(
    session: AsyncSession, platform: str | None = None, locale: str = "ru"
) -> str:
    repo = StatsRepository(session)
    if platform is not None:
        return _render(await repo.summary(platform), locale)

    # Пользователь привязан к одной платформе, поэтому суммы по платформам —
    # это число разных пользователей
    per_platform = {p.value: await repo.summary(p) for p in Platform}
    keys = next(iter(per_platform.values())).keys()
    total = {key: sum(summary[key] for summary in per_platform.values()) for key in keys}
    text = _render(total, locale)

    used = {name: summary for name, summary in per_platform.items() if summary["total"]}
    if len(used) > 1:
        lines = "\n".join(
            f"  • {name}: всего {s['total']}, DAU {s['active_day']}" for name, s in used.items()
        )
        text += f"\n\n🌐 <b>По платформам:</b>\n{lines}"
    return text
