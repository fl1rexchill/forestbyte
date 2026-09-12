"""Инлайн-клавиатуры админ-панели. callback_data с префиксом admin:*"""
from __future__ import annotations

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup
from aiogram.utils.keyboard import InlineKeyboardBuilder

from core.i18n import t


def admin_panel_kb(locale: str = "ru") -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.button(text=t("admin.stats_btn", locale=locale), callback_data="admin:stats")
    kb.button(text=t("admin.broadcast_btn", locale=locale), callback_data="admin:broadcast")
    kb.button(text=t("admin.users_btn", locale=locale), callback_data="admin:users")
    kb.adjust(1)
    return kb.as_markup()


def back_kb(locale: str = "ru") -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text="⬅️ Назад", callback_data="admin:home")]]
    )


def broadcast_confirm_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="✅ Отправить", callback_data="admin:bc_send"),
                InlineKeyboardButton(text="❌ Отмена", callback_data="admin:home"),
            ]
        ]
    )
