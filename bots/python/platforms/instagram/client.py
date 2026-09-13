"""HTTP-клиент Instagram API with Instagram Login (Messaging).

Сверено с официальной документацией Meta (2026-09):
  - версия Graph API: v26.0 (актуальная на момент написания, введена 29.07.2026);
    v21.0 доступна до 21.01.2027 — https://developers.facebook.com/docs/graph-api/changelog/
  - хост: graph.instagram.com (Business Login for Instagram);
  - отправка: POST /<IG_ID>/messages или /me/messages,
    заголовок Authorization: Bearer <INSTAGRAM_USER_ACCESS_TOKEN>
    https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/

Вариант через Facebook Login / Messenger Platform (graph.facebook.com + Page token)
поддерживается параметром `api_base`, но отдельно не проверялся.
"""
from __future__ import annotations

from collections.abc import Sequence
from typing import Any

import aiohttp

from core.config import settings
from core.logger import get_logger

log = get_logger(__name__)

GRAPH_API_VERSION = "v26.0"
GRAPH_HOST = "https://graph.instagram.com"
GRAPH_API = f"{GRAPH_HOST}/{GRAPH_API_VERSION}"

# Лимиты из документации
TEXT_MAX_BYTES = 1000        # текст сообщения: UTF-8, не более 1000 байт
QUICK_REPLIES_MAX = 13       # не более 13 кнопок быстрых ответов
QUICK_REPLY_TITLE_MAX = 20   # заголовок кнопки обрезается после 20 символов

# Поля User Profile API (GET /<IGSID>?fields=...)
DEFAULT_PROFILE_FIELDS = (
    "name",
    "username",
    "profile_pic",
    "follower_count",
    "is_user_follow_business",
    "is_business_follow_user",
)

# Быстрый ответ: (title, payload) или готовый dict
# (например {"content_type": "user_email", "title": "...", "payload": "..."})
QuickReply = tuple[str, str] | dict[str, str]


class InstagramClient:
    """Тонкий клиент Graph API. Все методы возвращают JSON-ответ как dict.

    Ошибки API не бросаются исключением — логируются, ответ (с ключом "error")
    возвращается вызывающему, как и в исходном send_text.
    """

    def __init__(
        self,
        access_token: str | None = None,
        *,
        ig_user_id: str = "me",
        api_base: str = GRAPH_API,
        session: aiohttp.ClientSession | None = None,
    ) -> None:
        self.access_token = access_token or settings.ig_access_token
        # ID профессионального аккаунта (<IG_ID>) или "me" — оба варианта в документации
        self.ig_user_id = ig_user_id
        self.api_base = api_base.rstrip("/")
        # Внешняя сессия (переиспользование соединений / моки в тестах).
        # Если не передана — на каждый запрос создаётся своя.
        self._session = session
        if not self.access_token:
            log.warning("IG_ACCESS_TOKEN не задан — Instagram-клиент не сможет слать сообщения")

    # ------------------------------------------------------------------ low-level

    async def _request(
        self,
        method: str,
        path: str,
        *,
        json: dict[str, Any] | None = None,
        params: dict[str, str] | None = None,
        bearer: bool = True,
    ) -> dict[str, Any]:
        url = f"{self.api_base}/{path.lstrip('/')}"
        headers: dict[str, str] = {}
        params = dict(params or {})
        if bearer:
            headers["Authorization"] = f"Bearer {self.access_token or ''}"
        else:
            params["access_token"] = self.access_token or ""

        async def _do(http: aiohttp.ClientSession) -> dict[str, Any]:
            async with http.request(
                method, url, json=json, params=params or None, headers=headers
            ) as resp:
                data = await resp.json(content_type=None)
                if resp.status >= 400:
                    log.error("IG API error %s on %s %s: %s", resp.status, method, path, data)
                return data if isinstance(data, dict) else {"data": data}

        if self._session is not None:
            return await _do(self._session)
        async with aiohttp.ClientSession() as http:
            return await _do(http)

    async def _send(self, payload: dict[str, Any]) -> dict[str, Any]:
        return await self._request("POST", f"{self.ig_user_id}/messages", json=payload)

    # ------------------------------------------------------------------ messages

    async def send_text(self, recipient_id: str, text: str) -> dict[str, Any]:
        """Отправить текст пользователю (recipient_id = IGSID).

        Успешный ответ: {"recipient_id": "...", "message_id": "..."}.
        """
        if len(text.encode("utf-8")) > TEXT_MAX_BYTES:
            log.warning("IG: текст длиннее %s байт, API может отклонить", TEXT_MAX_BYTES)
        payload = {"recipient": {"id": recipient_id}, "message": {"text": text}}
        return await self._send(payload)

    async def send_image(self, recipient_id: str, image_url: str) -> dict[str, Any]:
        """Отправить картинку по URL (png/jpeg, до 8 МБ).

        Формат: message.attachments[] = {"type": "image", "payload": {"url": ...}}.
        """
        # TODO-VERIFY: в примере «одна картинка» документация показывает "attachments" как
        # объект, а в примере «коллекция» — как массив (до 10 шт.). Используем массив из
        # одного элемента. Проверить на реальном аккаунте; альтернатива — "attachment": {...}
        # (так в примере для audio/video/file). Страница: .../messaging-api/ → "Send Images".
        payload = {
            "recipient": {"id": recipient_id},
            "message": {
                "attachments": [{"type": "image", "payload": {"url": image_url}}],
            },
        }
        return await self._send(payload)

    async def send_quick_replies(
        self, recipient_id: str, text: str, replies: Sequence[QuickReply]
    ) -> dict[str, Any]:
        """Отправить текст с кнопками быстрых ответов (до 13 шт., заголовок до 20 символов).

        replies: [("Да", "YES"), ("Нет", "NO")] или dict с content_type
        (text / user_phone_number / user_email). Нажатие придёт вебхуком
        messages с message.quick_reply.payload.
        """
        if len(replies) > QUICK_REPLIES_MAX:
            log.warning("IG: кнопок больше %s — лишние отброшены", QUICK_REPLIES_MAX)
        items: list[dict[str, str]] = []
        for reply in list(replies)[:QUICK_REPLIES_MAX]:
            if isinstance(reply, dict):
                items.append(reply)
            else:
                title, payload = reply
                items.append(
                    {
                        "content_type": "text",
                        "title": title[:QUICK_REPLY_TITLE_MAX],
                        "payload": payload,
                    }
                )
        body = {
            "recipient": {"id": recipient_id},
            "message": {"text": text, "quick_replies": items},
        }
        return await self._send(body)

    async def mark_seen(self, recipient_id: str) -> dict[str, Any]:
        """Отметить последнее сообщение пользователя прочитанным (sender_action=mark_seen).

        Запрос содержит только recipient и sender_action — так требует документация.
        """
        # TODO-VERIFY: на странице Sender actions (Instagram API with Instagram Login)
        # пример для mark_seen ошибочно содержит "typing_on" и хост graph.facebook.com
        # с access_token в query. Используем graph.instagram.com + Bearer, как для остальных
        # /messages. Страница: .../messaging-api/sender-actions/
        payload = {"recipient": {"id": recipient_id}, "sender_action": "mark_seen"}
        return await self._send(payload)

    # ------------------------------------------------------------------ users

    async def get_user_profile(
        self, igsid: str, fields: Sequence[str] = DEFAULT_PROFILE_FIELDS
    ) -> dict[str, Any]:
        """Профиль пользователя по IGSID (User Profile API).

        Доступно только после того, как пользователь сам написал аккаунту (user consent).
        Поля: name, username, profile_pic, follower_count, is_verified_user,
        is_user_follow_business, is_business_follow_user.
        """
        # Документация User Profile API показывает access_token в query-параметре
        return await self._request(
            "GET", igsid, params={"fields": ",".join(fields)}, bearer=False
        )
