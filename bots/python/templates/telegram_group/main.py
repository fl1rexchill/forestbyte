"""Групповой Telegram-бот: капча новых участников + модерация.

Предназначен для работы в группах/супергруппах. Бот должен быть админом
с правами ограничивать и банить участников.

Запуск:
    cd bots/python
    cp .env.example .env      # BOT_TOKEN обязателен
    pip install -r requirements.txt
    python templates/telegram_group/main.py
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

PYTHON_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PYTHON_ROOT))

from core.logger import get_logger  # noqa: E402
from modules.captcha import router as captcha_router  # noqa: E402
from modules.moderation import router as moderation_router  # noqa: E402
from modules.users import UserMiddleware  # noqa: E402
from platforms.telegram import create_bot, create_dispatcher, run_polling  # noqa: E402

log = get_logger("telegram_group")


async def main() -> None:
    bot = create_bot()
    dp = create_dispatcher()

    dp.message.middleware(UserMiddleware())
    dp.callback_query.middleware(UserMiddleware())

    dp.include_router(captcha_router)
    dp.include_router(moderation_router)  # антифлуд ловит остальные сообщения группы

    await run_polling(bot, dp)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        log.info("Shutdown requested")
