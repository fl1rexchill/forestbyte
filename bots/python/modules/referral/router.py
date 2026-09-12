"""Роутер реферальной системы.

- /start <inviter_id>  → фиксируем пригласившего для НОВОГО пользователя, уведомляем его;
- /ref                → показываем пользователю его ссылку и статистику.

Важно: этот роутер подключается ДО common, чтобы ловить /start с payload.
Обычный /start (без payload) обрабатывает common.
"""
from __future__ import annotations

from aiogram import Bot, Router
from aiogram.filters import Command, CommandObject, CommandStart
from aiogram.types import Message

from core.config import settings
from core.database.models import Platform, User
from core.database.repositories import UserRepository
from core.i18n import t
from sqlalchemy.ext.asyncio import AsyncSession

router = Router(name="referral")


def _loc(user: User) -> str:
    return user.language_code or settings.default_locale


@router.message(CommandStart(deep_link=True))
async def start_with_ref(
    message: Message,
    command: CommandObject,
    session: AsyncSession,
    db_user: User,
    bot: Bot,
) -> None:
    payload = (command.args or "").strip()
    users = UserRepository(session)

    # payload должен быть числовым external_id пригласившего
    if payload.lstrip("-").isdigit():
        inviter_id = int(payload)
        if await users.set_referrer(db_user, inviter_id):
            # Уведомляем пригласившего (не критично, если не дойдёт)
            try:
                total = await users.count_referrals(Platform.TELEGRAM, inviter_id)
                await bot.send_message(
                    inviter_id,
                    f"🎉 По вашей ссылке присоединился {db_user.full_name}!\n"
                    f"Всего приглашено: <b>{total}</b>",
                )
            except Exception:  # noqa: BLE001
                pass

    await message.answer(
        t("start.hello", locale=_loc(db_user), name=db_user.first_name or "друг")
    )


@router.message(Command("ref", "referral"))
async def cmd_ref(message: Message, session: AsyncSession, db_user: User, bot: Bot) -> None:
    me = await bot.get_me()
    link = f"https://t.me/{me.username}?start={db_user.external_id}"
    count = await UserRepository(session).count_referrals(
        Platform.TELEGRAM, db_user.external_id
    )
    await message.answer(
        f"🔗 <b>Ваша реферальная ссылка:</b>\n<code>{link}</code>\n\n"
        f"👥 Приглашено: <b>{count}</b>\n\n"
        f"Делитесь ссылкой — приглашённые засчитаются автоматически."
    )
