"""Роутер капчи для новых участников группы.

Логика:
  1) новый участник входит → бот ограничивает ему отправку сообщений;
  2) публикует кнопку «Я человек» (нажать может только этот участник);
  3) при нажатии — ограничение снимается;
  4) если за TIMEOUT не нажал — участника кикают, сообщение удаляют.

⚠️ Бот должен быть админом группы с правами «ограничивать» и «банить».
Состояние ожидания хранится в памяти процесса (для одного инстанса).
"""
from __future__ import annotations

import asyncio
import html

from aiogram import Bot, F, Router
from aiogram.types import CallbackQuery, ChatPermissions, Message

from core.logger import get_logger

log = get_logger(__name__)
router = Router(name="captcha")

TIMEOUT = 60  # секунд на прохождение

# (chat_id, user_id) -> задача-таймер кика
_pending: dict[tuple[int, int], asyncio.Task] = {}

_MUTED = ChatPermissions(can_send_messages=False)
_UNMUTED = ChatPermissions(
    can_send_messages=True,
    can_send_polls=True,
    can_send_other_messages=True,
    can_add_web_page_previews=True,
)


async def _kick_later(bot: Bot, chat_id: int, user_id: int, message_id: int) -> None:
    await asyncio.sleep(TIMEOUT)
    if (chat_id, user_id) in _pending:
        try:
            await bot.ban_chat_member(chat_id, user_id)
            await bot.unban_chat_member(chat_id, user_id)  # kick = ban+unban
            await bot.delete_message(chat_id, message_id)
        except Exception as e:  # noqa: BLE001
            log.warning("Captcha kick failed: %s", e)
        _pending.pop((chat_id, user_id), None)


@router.message(F.new_chat_members)
async def on_join(message: Message, bot: Bot) -> None:
    for member in message.new_chat_members:
        if member.is_bot:
            continue
        chat_id, user_id = message.chat.id, member.id
        try:
            await bot.restrict_chat_member(chat_id, user_id, permissions=_MUTED)
        except Exception as e:  # noqa: BLE001
            log.warning("Captcha restrict failed (бот не админ?): %s", e)
            continue

        from aiogram.utils.keyboard import InlineKeyboardBuilder

        kb = InlineKeyboardBuilder()
        kb.button(text="✅ Я человек", callback_data=f"captcha:{chat_id}:{user_id}")
        sent = await message.answer(
            f"👋 {html.escape(member.full_name)}, подтвердите, что вы не бот, за {TIMEOUT} сек.",
            reply_markup=kb.as_markup(),
        )
        _pending[(chat_id, user_id)] = asyncio.create_task(
            _kick_later(bot, chat_id, user_id, sent.message_id)
        )


@router.callback_query(F.data.startswith("captcha:"))
async def on_pass(call: CallbackQuery, bot: Bot) -> None:
    _, chat_id_s, user_id_s = call.data.split(":")
    chat_id, user_id = int(chat_id_s), int(user_id_s)

    if call.from_user.id != user_id:
        await call.answer("Эта кнопка не для вас.", show_alert=True)
        return

    task = _pending.pop((chat_id, user_id), None)
    if task:
        task.cancel()

    try:
        await bot.restrict_chat_member(chat_id, user_id, permissions=_UNMUTED)
    except Exception as e:  # noqa: BLE001
        log.warning("Captcha unrestrict failed: %s", e)

    await call.message.edit_text("✅ Проверка пройдена, добро пожаловать!")
    await call.answer()
