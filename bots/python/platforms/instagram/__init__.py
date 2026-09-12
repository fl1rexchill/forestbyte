"""Платформа Instagram (🟡 каркас — требует доработки под конкретный Meta App).

Instagram-ботов НЕТ официального простого Bot API как у Telegram. Работа идёт через
Messenger Platform / Instagram Graph API:
  - нужен бизнес- или creator-аккаунт Instagram, привязанный к Facebook-странице;
  - нужно Meta-приложение (developers.facebook.com) с разрешениями
    instagram_manage_messages, pages_manage_metadata;
  - входящие сообщения приходят ВЕБХУКОМ (HTTPS-эндпоинт), ответ — POST в Graph API.

Ключевые эндпоинты:
  - Verify webhook: GET /webhook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
  - Events:         POST /webhook  (тело messaging.*)
  - Send message:   POST https://graph.facebook.com/v21.0/me/messages
                    ?access_token=IG_ACCESS_TOKEN
                    body: {"recipient":{"id":IGSID},"message":{"text":"..."}}

Как переиспользовать общее ядро:
  - те же модели/репозитории (core.database), platform="instagram";
  - те же модули статистики/рассылок работают, если писать входящие в MessageLog
    и слать через client.send_text вместо bot.send_message.

Файлы:
  - client.py  — тонкий HTTP-клиент Graph API (send_text и т.п.)
  - webhook.py — aiohttp-сервер: верификация + приём событий (TODO)
"""
from platforms.instagram.client import InstagramClient

__all__ = ["InstagramClient"]
