"""Роутер магазина: каталог, корзина, оформление + оплата в Stars.

Корзина хранится в FSM-данных пользователя ({product_id: qty}).
Оплаченные заказы имеют payload "order:<id>" — их ловит собственный
successful_payment этого модуля (подключай shop ДО payments).
"""
from __future__ import annotations

import html

from aiogram import Bot, F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message
from sqlalchemy import select

from core.config import settings
from core.database.models import User
from modules.admin.filters import IsAdmin
from modules.payments.models import Payment
from modules.payments.service import send_stars_invoice
from modules.shop.keyboards import cart_kb, product_kb
from modules.shop.models import Order, OrderItem, Product
from sqlalchemy.ext.asyncio import AsyncSession

router = Router(name="shop")


# ------------------------- helpers -------------------------

async def _get_cart(state: FSMContext) -> dict[str, int]:
    data = await state.get_data()
    return dict(data.get("cart", {}))


async def _set_cart(state: FSMContext, cart: dict[str, int]) -> None:
    await state.update_data(cart=cart)


# ------------------------- сторона покупателя -------------------------

@router.message(Command("shop"))
async def cmd_shop(message: Message, session: AsyncSession) -> None:
    products = list(
        await session.scalars(
            select(Product).where(Product.is_active.is_(True)).order_by(Product.id)
        )
    )
    if not products:
        await message.answer("🛍 Каталог пока пуст.")
        return
    await message.answer("🛍 <b>Каталог</b>. Нажмите «В корзину» у нужных товаров, затем /cart.")
    for p in products:
        # Тексты товаров вводит админ — экранируем для parse_mode=HTML
        text = (
            f"<b>{html.escape(p.title)}</b>\n{html.escape(p.description)}\n\n"
            f"Цена: <b>{p.price_stars} ⭐️</b>"
        )
        await message.answer(text, reply_markup=product_kb(p))


@router.callback_query(F.data.startswith("shop:add:"))
async def cb_add(call: CallbackQuery, state: FSMContext) -> None:
    pid = call.data.split(":")[2]
    cart = await _get_cart(state)
    cart[pid] = cart.get(pid, 0) + 1
    await _set_cart(state, cart)
    await call.answer("Добавлено в корзину ✅")


@router.message(Command("cart"))
async def cmd_cart(message: Message, state: FSMContext, session: AsyncSession) -> None:
    cart = await _get_cart(state)
    if not cart:
        await message.answer("🛒 Корзина пуста. Откройте /shop.")
        return

    lines, total = [], 0
    for pid, qty in cart.items():
        product = await session.get(Product, int(pid))
        if not product:
            continue
        subtotal = product.price_stars * qty
        total += subtotal
        lines.append(f"• {html.escape(product.title)} × {qty} = {subtotal} ⭐️")

    text = "🛒 <b>Ваша корзина:</b>\n" + "\n".join(lines) + f"\n\nИтого: <b>{total} ⭐️</b>"
    await message.answer(text, reply_markup=cart_kb())


@router.callback_query(F.data == "shop:clear")
async def cb_clear(call: CallbackQuery, state: FSMContext) -> None:
    await _set_cart(state, {})
    await call.message.edit_text("🗑 Корзина очищена.")
    await call.answer()


@router.callback_query(F.data == "shop:checkout")
async def cb_checkout(
    call: CallbackQuery, state: FSMContext, session: AsyncSession, db_user: User, bot: Bot
) -> None:
    cart = await _get_cart(state)
    if not cart:
        await call.answer("Корзина пуста", show_alert=True)
        return

    order = Order(user_id=db_user.id, status="pending")
    session.add(order)
    await session.flush()

    total = 0
    for pid, qty in cart.items():
        product = await session.get(Product, int(pid))
        if not product:
            continue
        total += product.price_stars * qty
        session.add(
            OrderItem(
                order_id=order.id,
                product_id=product.id,
                title=product.title,
                price_stars=product.price_stars,
                qty=qty,
            )
        )
    order.total_stars = total

    await _set_cart(state, {})
    await call.answer()
    await send_stars_invoice(
        bot,
        call.message.chat.id,
        title=f"Заказ №{order.id}",
        description=f"Оплата заказа №{order.id}",
        payload=f"order:{order.id}",
        stars=max(1, total),
    )


@router.message(F.successful_payment, F.successful_payment.invoice_payload.startswith("order:"))
async def on_order_paid(message: Message, session: AsyncSession, db_user: User, bot: Bot) -> None:
    sp = message.successful_payment
    order_id = int(sp.invoice_payload.split(":")[1])
    order = await session.get(Order, order_id)
    if order:
        order.status = "paid"
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
    await message.answer(f"✅ Заказ №{order_id} оплачён. Спасибо за покупку!")
    for admin_id in settings.admin_ids:
        try:
            await bot.send_message(admin_id, f"💰 Оплачен заказ №{order_id} на {sp.total_amount} {sp.currency}")
        except Exception:  # noqa: BLE001
            pass


# ------------------------- сторона админа -------------------------

@router.message(Command("addproduct"), IsAdmin())
async def cmd_addproduct(message: Message, session: AsyncSession) -> None:
    """/addproduct Название | 100 | Описание (цена в звёздах)."""
    raw = (message.text or "").split(maxsplit=1)
    if len(raw) < 2 or raw[1].count("|") < 1:
        await message.answer("Формат: <code>/addproduct Название | цена | Описание</code>")
        return
    parts = [p.strip() for p in raw[1].split("|")]
    title = parts[0]
    if len(parts) < 2 or not parts[1].isdigit():
        await message.answer("Цена должна быть целым числом звёзд.")
        return
    price = int(parts[1])
    description = parts[2] if len(parts) > 2 else ""
    product = Product(title=title, price_stars=price, description=description)
    session.add(product)
    await session.flush()
    await message.answer(f"✅ Товар №{product.id} «{html.escape(title)}» добавлен ({price} ⭐️).")


@router.message(Command("products"), IsAdmin())
async def cmd_products(message: Message, session: AsyncSession) -> None:
    rows = list(await session.scalars(select(Product).order_by(Product.id)))
    if not rows:
        await message.answer("Товаров нет.")
        return
    text = "📦 <b>Товары:</b>\n" + "\n".join(
        f"• №{p.id} {'🟢' if p.is_active else '🔴'} {html.escape(p.title)} — {p.price_stars} ⭐️"
        for p in rows
    )
    await message.answer(text + "\n\nСкрыть: <code>/delproduct id</code>")


@router.message(Command("delproduct"), IsAdmin())
async def cmd_delproduct(message: Message, session: AsyncSession) -> None:
    parts = (message.text or "").split()
    if len(parts) < 2 or not parts[1].isdigit():
        await message.answer("Использование: /delproduct &lt;id&gt;")
        return
    product = await session.get(Product, int(parts[1]))
    if not product:
        await message.answer("Товар не найден.")
        return
    product.is_active = False
    await message.answer(f"✅ Товар №{product.id} скрыт.")
