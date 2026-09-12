"""Модуль admin: панель администратора и управление.

Подключение:
    from modules.admin import router as admin_router
    dp.include_router(admin_router)

Доступ определяется по ADMIN_IDS в .env (см. core.config.settings.admin_ids).
Открыть панель: команда /admin.
"""
from modules.admin.filters import IsAdmin
from modules.admin.router import router

__all__ = ["router", "IsAdmin"]
