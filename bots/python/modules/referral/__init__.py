"""Модуль referral: реферальная система через deep-link /start.

Подключение (ДО common_router, чтобы перехватывать /start с payload):
    from modules.referral import router as referral_router
    dp.include_router(referral_router)

Ссылка приглашения: https://t.me/<bot>?start=<твой_external_id>
Команда /ref — показать свою ссылку и число приглашённых.
"""
from modules.referral.router import router

__all__ = ["router"]
