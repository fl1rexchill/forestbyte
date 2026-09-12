"""Базовые хендлеры: /start, /help, /cancel, эхо."""
from __future__ import annotations

from aiogram import F, Router
from aiogram.filters import Command, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.types import Message

from core.config import settings
from core.database.models import User
from core.i18n import t

router = Router(name="common")


def _locale(user: User) -> str:
    return user.language_code or settings.default_locale


@router.message(CommandStart())
async def cmd_start(message: Message, db_user: User) -> None:
    # created флаг тут не пробрасываем — простое приветствие
    await message.answer(
        t("start.hello", locale=_locale(db_user), name=db_user.first_name or "друг")
    )


@router.message(Command("help"))
async def cmd_help(message: Message, db_user: User) -> None:
    await message.answer(t("help.text", locale=_locale(db_user)))


@router.message(Command("cancel"))
async def cmd_cancel(message: Message, state: FSMContext, db_user: User) -> None:
    current = await state.get_state()
    if current is not None:
        await state.clear()
    await message.answer(t("common.cancelled", locale=_locale(db_user)))


# Эхо — ловит всё, что не поймали другие роутеры. Подключай последним.
@router.message(F.text)
async def echo(message: Message) -> None:
    await message.answer(message.text)
