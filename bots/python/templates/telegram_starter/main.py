"""Минимальный Telegram-бот: регистрация пользователей + /start, /help, эхо.

Точка старта для простых ботов. Добавляй модули по мере надобности:
    dp.include_router(admin_router)  # и т.д.

Запуск:
    cd bots/python
    cp .env.example .env   # заполнить BOT_TOKEN
    pip install -r requirements.txt
    python templates/telegram_starter/main.py
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

PYTHON_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PYTHON_ROOT))

from core.logger import get_logger  # noqa: E402
from modules.common import router as common_router  # noqa: E402
from modules.users import UserMiddleware  # noqa: E402
from platforms.telegram import create_bot, create_dispatcher, run_polling  # noqa: E402

log = get_logger("telegram_starter")


async def main() -> None:
    bot = create_bot()
    dp = create_dispatcher()

    dp.message.middleware(UserMiddleware())
    dp.callback_query.middleware(UserMiddleware())
    dp.include_router(common_router)

    await run_polling(bot, dp)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        log.info("Shutdown requested")
