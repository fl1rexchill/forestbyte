"""Полный Telegram-бот: users + admin + statistics + broadcast + common.

Запуск:
    cd bots/python
    cp .env.example .env   # заполнить BOT_TOKEN и ADMIN_IDS
    pip install -r requirements.txt
    python templates/telegram_full/main.py
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

# Делаем корень стека (bots/python) импортируемым при прямом запуске файла
PYTHON_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PYTHON_ROOT))

from core.logger import get_logger  # noqa: E402
from modules.admin import router as admin_router  # noqa: E402
from modules.broadcast import router as broadcast_router  # noqa: E402
from modules.common import router as common_router  # noqa: E402
from modules.payments import router as payments_router  # noqa: E402
from modules.referral import router as referral_router  # noqa: E402
from modules.scheduler import router as scheduler_router  # noqa: E402
from modules.scheduler import setup as setup_scheduler  # noqa: E402
from modules.shop import router as shop_router  # noqa: E402
from modules.statistics import router as stats_router  # noqa: E402
from modules.support import router as support_router  # noqa: E402
from modules.users import UserMiddleware  # noqa: E402
from platforms.telegram import create_bot, create_dispatcher, run_polling  # noqa: E402

log = get_logger("telegram_full")


def build() -> tuple:
    bot = create_bot()
    dp = create_dispatcher()

    # Middleware регистрации пользователей — на сообщения и колбэки
    dp.message.middleware(UserMiddleware())
    dp.callback_query.middleware(UserMiddleware())

    # Порядок важен: специализированные роутеры раньше, common (с эхо) — последним
    dp.include_router(admin_router)
    dp.include_router(stats_router)
    dp.include_router(broadcast_router)
    dp.include_router(scheduler_router)
    dp.include_router(shop_router)       # ДО payments: ловит оплату заказов (order:*)
    dp.include_router(payments_router)
    dp.include_router(referral_router)   # ловит /start с payload
    dp.include_router(support_router)
    dp.include_router(common_router)     # /start без payload, /help, эхо — последним

    # Фоновый цикл планировщика
    setup_scheduler(dp)

    return bot, dp


async def main() -> None:
    bot, dp = build()
    await run_polling(bot, dp)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        log.info("Shutdown requested")
