"""Платформа MAX (🟡 каркас — мессенджер max.ru, Bot API).

MAX предоставляет Bot API (получение токена у бот-платформы MAX). Модель работы
похожа на Telegram: long-polling или webhook, отправка сообщений через REST.

⚠️ Точные URL/поля MAX Bot API сверяй с актуальной официальной документацией —
здесь каркас по типовой схеме бот-API. Базовый REST обычно вида:
  - getUpdates / setWebhook
  - sendMessage (chat_id/user_id + text)

Переиспользование ядра:
  - модели/репозитории общие (core.database), platform="max";
  - модули статистики/рассылок применимы: пиши входящие в MessageLog,
    рассылай через client.send_text.

Файлы:
  - client.py — HTTP-клиент REST API (send_text, get_updates) (TODO: сверить эндпоинты)
"""
from platforms.max.client import MaxClient

__all__ = ["MaxClient"]
