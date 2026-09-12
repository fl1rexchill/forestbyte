"""Роутер админ-панели: вход /admin, навигация, раздел «Пользователи».

Разделы «Статистика» и «Рассылка» обрабатываются своими модулями
(statistics / broadcast) через callback_data admin:stats и admin:broadcast —
так модули остаются независимыми.
"""
from __future__ import annotations

from aiogram import F, Router
from aiogram.enums import ChatType
from aiogram.filters import Command
from aiogram.types import CallbackQuery, Message

from core.config import settings
from core.database.models import Platform, User
from core.database.repositories import UserRepository
from core.i18n import t
from modules.admin.filters import IsAdmin
from modules.admin.keyboards import admin_panel_kb, back_kb
from sqlalchemy.ext.asyncio import AsyncSession

router = Router(name="admin")
# Весь роутер доступен только админам и только в личке
# (в группах команду /ban обрабатывает модуль moderation)
router.message.filter(IsAdmin(), F.chat.type == ChatType.PRIVATE)
router.callback_query.filter(IsAdmin())


def _loc(user: User) -> str:
    return user.language_code or settings.default_locale


@router.message(Command("admin"))
async def cmd_admin(message: Message, db_user: User) -> None:
    await message.answer(
        t("admin.panel", locale=_loc(db_user)),
        reply_markup=admin_panel_kb(_loc(db_user)),
    )


@router.callback_query(F.data == "admin:home")
async def cb_home(call: CallbackQuery, db_user: User) -> None:
    await call.message.edit_text(
        t("admin.panel", locale=_loc(db_user)),
        reply_markup=admin_panel_kb(_loc(db_user)),
    )
    await call.answer()


@router.callback_query(F.data == "admin:users")
async def cb_users(call: CallbackQuery, session: AsyncSession, db_user: User) -> None:
    users = UserRepository(session)
    total = await users.count(Platform.TELEGRAM)
    active_ids = await users.all_active_ids(Platform.TELEGRAM)
    text = (
        f"👥 <b>Пользователи</b>\n\n"
        f"Всего: <b>{total}</b>\n"
        f"Активных (не заблокировали бота): <b>{len(active_ids)}</b>\n\n"
        f"Бан/разбан: <code>/ban &lt;id&gt;</code> · <code>/unban &lt;id&gt;</code>"
    )
    await call.message.edit_text(text, reply_markup=back_kb(_loc(db_user)))
    await call.answer()


@router.message(Command("ban"))
async def cmd_ban(message: Message, session: AsyncSession) -> None:
    await _set_ban(message, session, banned=True)


@router.message(Command("unban"))
async def cmd_unban(message: Message, session: AsyncSession) -> None:
    await _set_ban(message, session, banned=False)


async def _set_ban(message: Message, session: AsyncSession, banned: bool) -> None:
    parts = (message.text or "").split()
    if len(parts) < 2 or not parts[1].lstrip("-").isdigit():
        await message.answer("Использование: /ban &lt;user_id&gt;")
        return
    target = int(parts[1])
    ok = await UserRepository(session).set_banned(Platform.TELEGRAM, target, banned)
    if ok:
        await message.answer(f"{'🚫 Забанен' if banned else '✅ Разбанен'}: <code>{target}</code>")
    else:
        await message.answer(f"Пользователь <code>{target}</code> не найден.")
