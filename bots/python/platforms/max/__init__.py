"""Платформа MAX (мессенджер max.ru, Bot API).

Документация: https://dev.max.ru/docs-api. Модель работы похожа на Telegram:
long polling (GET /updates, только для разработки) или webhook (POST /subscriptions,
рекомендуется всегда). Базовый URL https://platform-api2.max.ru, токен —
в заголовке `Authorization: <token>`.

Переиспользование ядра:
  - модели/репозитории общие (core.database), platform="max";
  - runner сам пишет входящие в MessageLog → модуль statistics считает и MAX;
  - рассылать — через client.send_text(chat_id, ...) или user_id=....

Файлы:
  - client.py  — HTTP-клиент: send_text/send_keyboard, get_updates, answer_callback, subscribe
  - webhook.py — проверка X-Max-Bot-Api-Secret, парсинг Update → MaxUpdate, aiohttp-app
  - runner.py  — run_polling / run_webhook, учёт пользователей, роутинг в обработчик
"""
from platforms.max.client import (
    MaxClient,
    MaxUploadError,
    callback_button,
    inline_keyboard,
    link_button,
    message_button,
)
from platforms.max.runner import MaxContext, build_app, build_webhook, run_polling, run_webhook
from platforms.max.webhook import (
    MaxUpdate,
    MaxWebhook,
    create_webhook_app,
    parse_update,
    parse_updates,
    webhook_app,
)

__all__ = [
    "MaxClient",
    "MaxContext",
    "MaxUpdate",
    "MaxUploadError",
    "MaxWebhook",
    "build_app",
    "build_webhook",
    "callback_button",
    "create_webhook_app",
    "inline_keyboard",
    "link_button",
    "message_button",
    "parse_update",
    "parse_updates",
    "run_polling",
    "run_webhook",
    "webhook_app",
]
