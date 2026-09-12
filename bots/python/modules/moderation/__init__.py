"""Модуль moderation: модерация групп (бан/кик/мут/варн + антифлуд).

Подключение:
    from modules.moderation import router as moderation_router
    dp.include_router(moderation_router)

Требуется: бот — админ группы. Права проверяются по факту (админы чата).
Команды ответом на сообщение: /ban /kick /mute /unmute /warn.
"""
from modules.moderation.router import router

__all__ = ["router"]
