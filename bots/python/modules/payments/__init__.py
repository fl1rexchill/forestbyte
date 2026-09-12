"""Модуль payments: приём оплаты (Telegram Stars и платёжные провайдеры).

Подключение (ДО common_router, чтобы successful_payment не съел эхо):
    from modules.payments import router as payments_router
    dp.include_router(payments_router)

Демо-команда /donate (50 звёзд). Хелперы отправки счетов — в service.py.

Провайдерские оплаты: получи provider_token у @BotFather (раздел Payments),
положи в свой код/настройки и используй send_provider_invoice.
"""
from modules.payments.router import router
from modules.payments.service import send_provider_invoice, send_stars_invoice

__all__ = ["router", "send_stars_invoice", "send_provider_invoice"]
