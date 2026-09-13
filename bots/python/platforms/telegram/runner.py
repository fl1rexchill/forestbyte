"""Раннер long-polling: инициализация БД, запуск, корректная остановка.

Webhook-вариант вынесен в комментарий ниже — для продакшена за HTTPS.
"""
from __future__ import annotations

from aiogram import Bot, Dispatcher

from core.database.base import dispose_db, init_db
from core.logger import get_logger

log = get_logger(__name__)


async def run_polling(bot: Bot, dp: Dispatcher) -> None:
    """Запустить бота в режиме long-polling до Ctrl+C."""
    await init_db()
    try:
        me = await bot.get_me()
        log.info("Starting @%s (id=%s) in polling mode", me.username, me.id)
        # drop_pending_updates — пропустить накопившиеся апдейты при рестарте
        await dp.start_polling(bot, drop_pending_updates=True)
    finally:
        await bot.session.close()
        await dispose_db()
        log.info("Bot stopped")


# ---------------------------------------------------------------------------
# WEBHOOK (продакшен). Требует публичный HTTPS и aiohttp-сервер.
# from aiohttp import web
# from aiogram.webhook.aiohttp_server import SimpleRequestHandler, setup_application
#
# async def run_webhook(bot, dp, *, base_url, secret_token, path="/webhook",
#                       host="0.0.0.0", port=8080):
#     # secret_token (1–256 символов A-Z a-z 0-9 _ -) Telegram присылает в заголовке
#     # X-Telegram-Bot-Api-Secret-Token; SimpleRequestHandler отклоняет запросы без него.
#     await init_db()
#     await bot.set_webhook(
#         f"{base_url}{path}", drop_pending_updates=True, secret_token=secret_token
#     )
#     app = web.Application()
#     SimpleRequestHandler(dispatcher=dp, bot=bot, secret_token=secret_token).register(
#         app, path=path
#     )
#     setup_application(app, dp, bot=bot)
#     web.run_app(app, host=host, port=port)
# ---------------------------------------------------------------------------
