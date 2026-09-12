"""Роутер платежей: демо-донат в Stars, подтверждение оплаты, запись в БД.

Обязательные части любого платёжного бота:
  1) ответ на PreCheckoutQuery в течение 10 сек (иначе оплата отменится);
  2) обработка сообщения об успешной оплате (successful_payment).
"""
from __future__ import annotations

from aiogram import Bot, F, Router
from aiogram.filters import Command
from aiogram.types import Message, PreCheckoutQuery

from core.database.models import User
from modules.payments.models import Payment
from modules.payments.service import send_stars_invoice
from sqlalchemy.ext.asyncio import AsyncSession

router = Router(name="payments")


@router.message(Command("donate"))
async def cmd_donate(message: Message, bot: Bot) -> None:
    """Демо: донат 50 звёзд. В реальном боте сумму/товар подставляй динамически."""
    await send_stars_invoice(
        bot,
        message.chat.id,
        title="Поддержать бота",
        description="Спасибо за поддержку! 50 ⭐️",
        payload="donate:50",
        stars=50,
    )


@router.pre_checkout_query()
async def pre_checkout(query: PreCheckoutQuery) -> None:
    # Здесь можно проверить наличие товара/цену. Ответить нужно всегда.
    await query.answer(ok=True)


@router.message(F.successful_payment)
async def on_success(message: Message, session: AsyncSession, db_user: User) -> None:
    sp = message.successful_payment
    session.add(
        Payment(
            user_id=db_user.id,
            amount=sp.total_amount,
            currency=sp.currency,
            payload=sp.invoice_payload,
            telegram_charge_id=sp.telegram_payment_charge_id,
            status="paid",
        )
    )
    await message.answer(
        f"✅ Оплата получена: {sp.total_amount} {sp.currency}. Спасибо!"
    )
