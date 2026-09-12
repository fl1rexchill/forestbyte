"""Модуль broadcast: массовые рассылки с троттлингом и отчётом.

Подключение:
    from modules.broadcast import router as broadcast_router
    dp.include_router(broadcast_router)

Запуск: команда /broadcast или кнопка «Рассылка» в админ-панели (admin:broadcast).
Учитывает лимиты Telegram (BROADCAST_RATE в .env), помечает заблокировавших бота
как неактивных, ведёт запись BroadcastJob в БД.
"""
from modules.broadcast.router import router

__all__ = ["router"]
