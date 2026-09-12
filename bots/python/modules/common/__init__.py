"""Модуль common: базовые команды /start, /help, /cancel и эхо-ответ.

Подключение:
    from modules.common import router as common_router
    dp.include_router(common_router)

Важно: подключай ПОСЛЕ специализированных роутеров (admin и т.п.),
т.к. эхо-хендлер ловит любые сообщения.
"""
from modules.common.router import router

__all__ = ["router"]
