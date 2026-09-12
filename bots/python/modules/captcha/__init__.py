"""Модуль captcha: антибот-проверка новых участников группы.

Подключение:
    from modules.captcha import router as captcha_router
    dp.include_router(captcha_router)

Требуется: бот — админ группы с правами ограничивать/банить участников.
Настройка времени — TIMEOUT в router.py.
"""
from modules.captcha.router import router

__all__ = ["router"]
