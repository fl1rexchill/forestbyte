"""Роутер поддержки: создание тикетов пользователем и ответы админов."""
from __future__ import annotations

import html

from aiogram import Bot, F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import Message

from core.config import settings
from core.database.models import User
from core.database.repositories import UserRepository
from core.database.models import Platform
from modules.admin.filters import IsAdmin
from modules.support.models import Ticket, TicketMessage
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = Router(name="support")


class SupportStates(StatesGroup):
    waiting_message = State()


# ---------------------- Сторона пользователя ----------------------

@router.message(Command("support"))
async def cmd_support(message: Message, state: FSMContext) -> None:
    await state.set_state(SupportStates.waiting_message)
    await message.answer("✍️ Опишите ваш вопрос одним сообщением. /cancel — отмена.")


# Команды (/cancel и т.п.) не считаем текстом обращения — их обработают другие роутеры
@router.message(SupportStates.waiting_message, F.text, ~F.text.startswith("/"))
async def got_support_message(
    message: Message, state: FSMContext, session: AsyncSession, db_user: User, bot: Bot
) -> None:
    await state.clear()

    ticket = Ticket(user_id=db_user.id, status="open")
    session.add(ticket)
    await session.flush()
    session.add(
        TicketMessage(ticket_id=ticket.id, from_admin=False, text=message.text)
    )

    await message.answer(
        f"✅ Обращение №{ticket.id} принято. Мы ответим здесь же."
    )

    # Рассылаем админам
    for admin_id in settings.admin_ids:
        try:
            await bot.send_message(
                admin_id,
                f"🆕 <b>Тикет №{ticket.id}</b> от {html.escape(db_user.full_name)} "
                f"(<code>{db_user.external_id}</code>):\n\n{message.html_text}\n\n"
                f"Ответ: <code>/reply {ticket.id} текст</code>",
            )
        except Exception:  # noqa: BLE001
            pass


# ---------------------- Сторона админа ----------------------

@router.message(Command("reply"), IsAdmin())
async def cmd_reply(message: Message, session: AsyncSession, bot: Bot) -> None:
    parts = (message.text or "").split(maxsplit=2)
    if len(parts) < 3 or not parts[1].isdigit():
        await message.answer("Использование: /reply &lt;ticket_id&gt; &lt;текст&gt;")
        return

    ticket_id, text = int(parts[1]), parts[2]
    ticket = await session.get(Ticket, ticket_id)
    if not ticket:
        await message.answer(f"Тикет №{ticket_id} не найден.")
        return

    # external_id автора тикета
    author = await session.get(User, ticket.user_id)
    if not author:
        await message.answer("Автор тикета не найден.")
        return

    session.add(TicketMessage(ticket_id=ticket.id, from_admin=True, text=text))
    try:
        await bot.send_message(
            author.external_id,
            f"💬 <b>Ответ поддержки (тикет №{ticket.id}):</b>\n\n{text}",
        )
        await message.answer(f"✅ Отправлено пользователю по тикету №{ticket.id}.")
    except Exception as e:  # noqa: BLE001
        await message.answer(f"⚠️ Не удалось доставить: {e}")


@router.message(Command("close"), IsAdmin())
async def cmd_close(message: Message, session: AsyncSession) -> None:
    parts = (message.text or "").split()
    if len(parts) < 2 or not parts[1].isdigit():
        await message.answer("Использование: /close &lt;ticket_id&gt;")
        return
    ticket = await session.get(Ticket, int(parts[1]))
    if not ticket:
        await message.answer("Тикет не найден.")
        return
    ticket.status = "closed"
    await message.answer(f"✅ Тикет №{ticket.id} закрыт.")


@router.message(Command("tickets"), IsAdmin())
async def cmd_tickets(message: Message, session: AsyncSession) -> None:
    open_tickets = await session.scalars(
        select(Ticket).where(Ticket.status == "open").order_by(Ticket.id.desc()).limit(20)
    )
    rows = list(open_tickets)
    if not rows:
        await message.answer("Открытых тикетов нет.")
        return
    text = "📋 <b>Открытые тикеты:</b>\n" + "\n".join(
        f"• №{t.id} (user id {t.user_id})" for t in rows
    )
    await message.answer(text)
