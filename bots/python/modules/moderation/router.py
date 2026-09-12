"""Роутер модерации групп.

Команды (ответом на сообщение нарушителя, только для админов чата):
  /ban            — забанить
  /kick           — исключить (ban+unban)
  /mute [минуты]  — заглушить (по умолчанию 60 мин)
  /unmute         — снять заглушку
  /warn           — предупреждение; после MAX_WARNS — авто-мут на час

Плюс антифлуд: слишком частые сообщения → авто-мут на 5 минут + удаление.

⚠️ Бот должен быть админом группы. Права проверяются по факту (getChatMember),
а не по ADMIN_IDS — модерируют админы конкретного чата.
Счётчики warns/flood — в памяти процесса (для одного инстанса).
"""
from __future__ import annotations

import time
from collections import defaultdict, deque

from aiogram import Bot, F, Router
from aiogram.enums import ChatType
from aiogram.filters import Command, CommandObject
from aiogram.types import ChatPermissions, Message

from core.logger import get_logger

log = get_logger(__name__)
router = Router(name="moderation")
# Работаем только в группах
router.message.filter(F.chat.type.in_({ChatType.GROUP, ChatType.SUPERGROUP}))

MAX_WARNS = 3
FLOOD_LIMIT = 6          # сообщений
FLOOD_WINDOW = 5.0       # за столько секунд

_warns: dict[tuple[int, int], int] = defaultdict(int)
_flood: dict[tuple[int, int], deque] = defaultdict(lambda: deque(maxlen=FLOOD_LIMIT))

_MUTED = ChatPermissions(can_send_messages=False)
_UNMUTED = ChatPermissions(
    can_send_messages=True,
    can_send_polls=True,
    can_send_other_messages=True,
    can_add_web_page_previews=True,
)


async def _is_admin(bot: Bot, chat_id: int, user_id: int) -> bool:
    try:
        member = await bot.get_chat_member(chat_id, user_id)
        return member.status in ("administrator", "creator")
    except Exception:  # noqa: BLE001
        return False


async def _require_reply_admin(message: Message, bot: Bot) -> Message | None:
    """Проверяет, что вызвал админ и есть reply. Возвращает reply или None."""
    if not await _is_admin(bot, message.chat.id, message.from_user.id):
        await message.reply("⛔️ Только для админов чата.")
        return None
    if not message.reply_to_message:
        await message.reply("Ответьте этой командой на сообщение нарушителя.")
        return None
    return message.reply_to_message


@router.message(Command("ban"))
async def cmd_ban(message: Message, bot: Bot) -> None:
    target = await _require_reply_admin(message, bot)
    if not target:
        return
    await bot.ban_chat_member(message.chat.id, target.from_user.id)
    await message.answer(f"🚫 {target.from_user.full_name} забанен.")


@router.message(Command("kick"))
async def cmd_kick(message: Message, bot: Bot) -> None:
    target = await _require_reply_admin(message, bot)
    if not target:
        return
    await bot.ban_chat_member(message.chat.id, target.from_user.id)
    await bot.unban_chat_member(message.chat.id, target.from_user.id)
    await message.answer(f"👢 {target.from_user.full_name} исключён.")


@router.message(Command("mute"))
async def cmd_mute(message: Message, command: CommandObject, bot: Bot) -> None:
    target = await _require_reply_admin(message, bot)
    if not target:
        return
    minutes = int(command.args) if command.args and command.args.isdigit() else 60
    until = int(time.time()) + minutes * 60
    await bot.restrict_chat_member(
        message.chat.id, target.from_user.id, permissions=_MUTED, until_date=until
    )
    await message.answer(f"🔇 {target.from_user.full_name} заглушён на {minutes} мин.")


@router.message(Command("unmute"))
async def cmd_unmute(message: Message, bot: Bot) -> None:
    target = await _require_reply_admin(message, bot)
    if not target:
        return
    await bot.restrict_chat_member(
        message.chat.id, target.from_user.id, permissions=_UNMUTED
    )
    await message.answer(f"🔊 {target.from_user.full_name} снова может писать.")


@router.message(Command("warn"))
async def cmd_warn(message: Message, bot: Bot) -> None:
    target = await _require_reply_admin(message, bot)
    if not target:
        return
    key = (message.chat.id, target.from_user.id)
    _warns[key] += 1
    count = _warns[key]
    if count >= MAX_WARNS:
        until = int(time.time()) + 3600
        await bot.restrict_chat_member(
            message.chat.id, target.from_user.id, permissions=_MUTED, until_date=until
        )
        _warns[key] = 0
        await message.answer(
            f"⚠️ {target.from_user.full_name}: {MAX_WARNS}/{MAX_WARNS} — мут на час."
        )
    else:
        await message.answer(
            f"⚠️ Предупреждение {count}/{MAX_WARNS} для {target.from_user.full_name}."
        )


@router.message(F.text | F.caption)
async def antiflood(message: Message, bot: Bot) -> None:
    """Антифлуд. Стоит последним в роутере — считает все сообщения группы."""
    if message.from_user is None:
        return
    key = (message.chat.id, message.from_user.id)
    now = time.monotonic()
    dq = _flood[key]
    dq.append(now)
    if len(dq) == FLOOD_LIMIT and (now - dq[0]) < FLOOD_WINDOW:
        # Не глушим админов
        if await _is_admin(bot, message.chat.id, message.from_user.id):
            return
        until = int(time.time()) + 300
        try:
            await bot.restrict_chat_member(
                message.chat.id, message.from_user.id, permissions=_MUTED, until_date=until
            )
            await message.answer(
                f"🔇 {message.from_user.full_name} заглушён на 5 мин за флуд."
            )
        except Exception as e:  # noqa: BLE001
            log.warning("Antiflood mute failed: %s", e)
        dq.clear()
