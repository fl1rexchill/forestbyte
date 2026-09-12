"""Роутер планировщика (только админы): создать/список/отменить отложенные посты."""
from __future__ import annotations

from datetime import datetime, timezone

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message
from sqlalchemy import select

from modules.admin.filters import IsAdmin
from modules.scheduler.models import ScheduledPost
from sqlalchemy.ext.asyncio import AsyncSession

router = Router(name="scheduler")
router.message.filter(IsAdmin())

DATE_FMT = "%Y-%m-%d %H:%M"


@router.message(Command("schedule"))
async def cmd_schedule(message: Message, session: AsyncSession) -> None:
    """/schedule 2026-09-10 15:30 | текст рассылки всем (время в UTC)."""
    raw = (message.text or "").split(maxsplit=1)
    if len(raw) < 2 or "|" not in raw[1]:
        await message.answer(
            "Формат: <code>/schedule ГГГГ-ММ-ДД ЧЧ:ММ | текст</code>\n"
            "Время в UTC. Текст уйдёт всем активным пользователям."
        )
        return

    when_str, text = (p.strip() for p in raw[1].split("|", 1))
    try:
        run_at = datetime.strptime(when_str, DATE_FMT).replace(tzinfo=timezone.utc)
    except ValueError:
        await message.answer("Не удалось разобрать дату. Пример: 2026-09-10 15:30")
        return

    if run_at <= datetime.now(timezone.utc):
        await message.answer("⏰ Время уже прошло. Укажите будущий момент (UTC).")
        return

    post = ScheduledPost(
        created_by=message.from_user.id, text=text, target="all", run_at=run_at
    )
    session.add(post)
    await session.flush()
    await message.answer(
        f"✅ Запланировано №{post.id} на {when_str} UTC (получателей: все активные)."
    )


@router.message(Command("scheduled"))
async def cmd_list(message: Message, session: AsyncSession) -> None:
    rows = list(
        await session.scalars(
            select(ScheduledPost)
            .where(ScheduledPost.status == "pending")
            .order_by(ScheduledPost.run_at)
        )
    )
    if not rows:
        await message.answer("Нет запланированных задач.")
        return
    text = "🗓 <b>Запланировано:</b>\n" + "\n".join(
        f"• №{p.id} — {p.run_at:%Y-%m-%d %H:%M} UTC — {p.text[:30]}…" for p in rows
    )
    await message.answer(text)


@router.message(Command("unschedule"))
async def cmd_unschedule(message: Message, session: AsyncSession) -> None:
    parts = (message.text or "").split()
    if len(parts) < 2 or not parts[1].isdigit():
        await message.answer("Использование: /unschedule &lt;id&gt;")
        return
    post = await session.get(ScheduledPost, int(parts[1]))
    if not post or post.status != "pending":
        await message.answer("Задача не найдена или уже выполнена.")
        return
    post.status = "cancelled"
    await message.answer(f"✅ Задача №{post.id} отменена.")
