"""Модуль statistics: метрики бота (всего/новые/активные за день-неделю-месяц).

Подключение:
    from modules.statistics import router as stats_router
    dp.include_router(stats_router)

Команда /stats (для админов) и кнопка «Статистика» в админ-панели (admin:stats).
"""
from modules.statistics.router import router

__all__ = ["router"]
