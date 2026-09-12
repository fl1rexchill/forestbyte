"""Помощники для выставления счетов (invoices).

Поддерживает два режима:
  - Telegram Stars: currency="XTR", provider_token="" (пустой), amount = число звёзд;
  - Провайдер (ЮKassa/Stripe и т.п.): currency="RUB"/"USD", provider_token из BotFather,
    amount в минимальных единицах (копейки/центы).
"""
from __future__ import annotations

from aiogram import Bot
from aiogram.types import LabeledPrice


async def send_stars_invoice(
    bot: Bot,
    chat_id: int,
    *,
    title: str,
    description: str,
    payload: str,
    stars: int,
) -> None:
    """Счёт в Telegram Stars (XTR). provider_token не нужен."""
    await bot.send_invoice(
        chat_id=chat_id,
        title=title,
        description=description,
        payload=payload,
        provider_token="",  # для Stars — пустая строка
        currency="XTR",
        prices=[LabeledPrice(label=title, amount=stars)],
    )


async def send_provider_invoice(
    bot: Bot,
    chat_id: int,
    *,
    title: str,
    description: str,
    payload: str,
    provider_token: str,
    currency: str,
    amount_minor: int,
) -> None:
    """Счёт через платёжного провайдера (валюта RUB/USD и т.д.).

    amount_minor — сумма в минимальных единицах (например, 19900 = 199.00 RUB).
    """
    await bot.send_invoice(
        chat_id=chat_id,
        title=title,
        description=description,
        payload=payload,
        provider_token=provider_token,
        currency=currency,
        prices=[LabeledPrice(label=title, amount=amount_minor)],
    )
