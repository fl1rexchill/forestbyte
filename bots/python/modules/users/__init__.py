"""Модуль users: регистрация и учёт пользователей.

Подключение (в bot bootstrap):
    from modules.users import UserMiddleware
    dp.message.middleware(UserMiddleware())
    dp.callback_query.middleware(UserMiddleware())

После этого в любой хендлер приходят аргументы:
    session: AsyncSession  — открытая сессия БД (commit авто)
    db_user: User          — ORM-объект пользователя
"""
from modules.users.middleware import UserMiddleware

__all__ = ["UserMiddleware"]
