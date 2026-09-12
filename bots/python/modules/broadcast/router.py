"""Роутер рассылки: диалог ввода текста, подтверждение, запуск."""
from __future__ import annotations

from aiogram import Bot, F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from core.config import settings
from core.database.models import Platform, User
from core.database.repositories import UserRepository
from core.i18n import t
from modules.admin.filters import IsAdmin
from modules.admin.keyboards import broadcast_confirm_kb
from modules.broadcast.service import run_broadcast
from modules.broadcast.states import BroadcastStates
from sqlalchemy.ext.asyncio import AsyncSession

router = Router(name="broadcast")
router.message.filter(IsAdmin())
router.callback_query.filter(IsAdmin())


def _loc(user: User) -> str:
    return user.language_code or settings.default_locale


async def _ask_text(target: Message, locale: str, state: FSMContext) -> None:
    await state.set_state(BroadcastStates.waiting_text)
    await target.answer(t("broadcast.ask_text", locale=locale))


@router.message(Command("broadcast"))
async def cmd_broadcast(message: Message, state: FSMContext, db_user: User) -> None:
    await _ask_text(message, _loc(db_user), state)


@router.callback_query(F.data == "admin:broadcast")
async def cb_broadcast(call: CallbackQuery, state: FSMContext, db_user: User) -> None:
    await state.set_state(BroadcastStates.waiting_text)
    await call.message.answer(t("broadcast.ask_text", locale=_loc(db_user)))
    await call.answer()


@router.message(BroadcastStates.waiting_text, F.text)
async def got_text(
    message: Message, state: FSMContext, session: AsyncSession, db_user: User
) -> None:
    await state.update_data(text=message.text)
    await state.set_state(BroadcastStates.waiting_confirm)

    count = len(await UserRepository(session).all_active_ids(Platform.TELEGRAM))
    preview = (
        f"{t('broadcast.confirm', locale=_loc(db_user), count=count)}\n\n"
        f"<b>Превью:</b>\n{message.text}"
    )
    await message.answer(preview, reply_markup=broadcast_confirm_kb())


@router.callback_query(BroadcastStates.waiting_confirm, F.data == "admin:bc_send")
async def do_send(
    call: CallbackQuery, state: FSMContext, bot: Bot, db_user: User
) -> None:
    data = await state.get_data()
    text = data.get("text", "")
    await state.clear()

    await call.message.edit_text(t("broadcast.started", locale=_loc(db_user)))
    await call.answer()

    sent, failed = await run_broadcast(bot, admin_id=call.from_user.id, text=text)
    await call.message.answer(
        t("broadcast.done", locale=_loc(db_user), sent=sent, failed=failed)
    )
