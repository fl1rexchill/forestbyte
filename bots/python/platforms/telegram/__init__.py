"""Платформа Telegram (aiogram 3.x)."""
from platforms.telegram.bot import create_bot, create_dispatcher
from platforms.telegram.runner import run_polling

__all__ = ["create_bot", "create_dispatcher", "run_polling"]
