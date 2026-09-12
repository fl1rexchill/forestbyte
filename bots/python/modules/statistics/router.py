"""Роутер статистики: /stats и кнопка admin:stats."""
from __future__ import annotations

from aiogram import F, Router
from aiogram.filters import Command
from aiogram.types import CallbackQuery, Message

from core.config import settings
from core.database.models import User
from modules.admin.filters import IsAdmin
from modules.admin.keyboards import back_kb
from modules.statistics.service import build_stats_text
from sqlalchemy.ext.asyncio import AsyncSession

router = Router(name="statistics")
router.message.filter(IsAdmin())
router.callback_query.filter(IsAdmin())


def _loc(user: User) -> str:
    return user.language_code or settings.default_locale


@router.message(Command("stats"))
async def cmd_stats(message: Message, session: AsyncSession, db_user: User) -> None:
    text = await build_stats_text(session, locale=_loc(db_user))
    await message.answer(text)


@router.callback_query(F.data == "admin:stats")
async def cb_stats(call: CallbackQuery, session: AsyncSession, db_user: User) -> None:
    text = await build_stats_text(session, locale=_loc(db_user))
    await call.message.edit_text(text, reply_markup=back_kb(_loc(db_user)))
    await call.answer()
