"""Платформа Instagram (Instagram API with Instagram Login, Graph API v26.0).

У Instagram НЕТ простого Bot API как у Telegram. Работа идёт через Instagram Platform:
  - нужен профессиональный (бизнес/creator) аккаунт Instagram;
  - нужно Meta-приложение (developers.facebook.com) с разрешениями
    instagram_business_basic, instagram_business_manage_messages;
  - входящие сообщения приходят ВЕБХУКОМ (HTTPS-эндпоинт), ответ — POST в Graph API.

Ключевые эндпоинты:
  - Verify webhook: GET  /webhook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
  - Events:         POST /webhook  (заголовок X-Hub-Signature-256, тело entry[].messaging[])
  - Send message:   POST https://graph.instagram.com/v26.0/me/messages
                    Authorization: Bearer IG_ACCESS_TOKEN
                    body: {"recipient":{"id":IGSID},"message":{"text":"..."}}

Как переиспользовать общее ядро:
  - те же модели/репозитории (core.database), platform="instagram";
  - runner сам пишет входящие в MessageLog → модуль statistics считает и Instagram;
  - рассылать — через client.send_text вместо bot.send_message.

Файлы:
  - client.py  — HTTP-клиент Graph API (send_text/image/quick_replies, mark_seen, профиль)
  - webhook.py — верификация, проверка подписи, парсинг в IncomingMessage, aiohttp-app
  - runner.py  — запуск сервера, учёт пользователей, роутинг в обработчик
"""
from platforms.instagram.client import InstagramClient
from platforms.instagram.runner import InstagramContext, build_app, build_webhook, run_webhook
from platforms.instagram.webhook import (
    IncomingMessage,
    InstagramWebhook,
    create_webhook_app,
    parse_events,
    verify_challenge,
    verify_signature,
    webhook_app,
)

__all__ = [
    "IncomingMessage",
    "InstagramClient",
    "InstagramContext",
    "InstagramWebhook",
    "build_app",
    "build_webhook",
    "create_webhook_app",
    "parse_events",
    "run_webhook",
    "verify_challenge",
    "verify_signature",
    "webhook_app",
]
