"""Модуль scheduler: отложенные посты/рассылки по времени (UTC).

Подключение:
    from modules.scheduler import router as scheduler_router, setup as setup_scheduler
    dp.include_router(scheduler_router)
    setup_scheduler(dp)              # запускает фоновый цикл на старте бота

Команды (админ): /schedule, /scheduled, /unschedule.
"""
from modules.scheduler.router import router
from modules.scheduler.service import setup

__all__ = ["router", "setup"]
