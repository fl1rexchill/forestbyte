"""HTTP-клиент MAX Bot API (мессенджер MAX, max.ru).

Сверено с официальной документацией (2026-09): https://dev.max.ru/docs-api
и официальными клиентами github.com/max-messenger (max-bot-api-client-ts / -go):
  - базовый URL: https://platform-api2.max.ru (platform-api.max.ru — устаревший);
  - авторизация: заголовок `Authorization: <token>` (без "Bearer"); токен в query
    больше не поддерживается;
  - отправка: POST /messages?chat_id=... | ?user_id=...  body: {text, attachments, format, notify}
  - long polling: GET /updates?marker=&timeout=&limit=&types=  → {updates: [], marker}
  - webhook: POST /subscriptions {url, update_types, secret}; DELETE /subscriptions?url=
  - ответ на нажатие кнопки: POST /answers?callback_id=...  body: {message?, notification?}
  - файлы: POST /uploads?type=image|video|audio|file → {url, token?}; сам файл — multipart
    (поле data) на полученный url. Вложение: для image/file payload — ответ загрузки,
    для video/audio — {"token": token из первого шага}. Сразу после загрузки возможна ошибка
    attachment.not.ready — отправка повторяется с растущей паузой.
    https://dev.max.ru/docs-api/methods/POST/uploads
  - лимиты: 30 rps на API, не более 2 сообщений в секунду в один чат, текст до 4000 символов.
"""
from __future__ import annotations

import asyncio
import json
from collections.abc import Sequence
from pathlib import Path
from typing import Any

import aiohttp

from core.config import settings
from core.logger import get_logger

log = get_logger(__name__)

BASE_URL = "https://platform-api2.max.ru"

TEXT_MAX_LEN = 4000          # text — до 4000 символов
KEYBOARD_MAX_ROWS = 30       # до 30 рядов
KEYBOARD_MAX_BUTTONS = 210   # до 210 кнопок всего
KEYBOARD_MAX_IN_ROW = 7      # до 7 в ряду (до 3 для link/open_app/request_*)
_WIDE_BUTTONS = {"link", "open_app", "request_geo_location", "request_contact"}

UPLOAD_TYPES = ("image", "video", "audio", "file")
NOT_READY_CODE = "attachment.not.ready"
# Паузы (сек) между повторами отправки, пока загруженное вложение обрабатывается
SEND_RETRY_DELAYS: tuple[float, ...] = (0.5, 1.0, 2.0, 4.0)

Button = dict[str, Any]
FileSource = bytes | str | Path


class MaxUploadError(RuntimeError):
    """Файл не загрузился: нет url/token в ответе или ошибка хоста загрузки."""


# --------------------------------------------------------------------------- кнопки


def callback_button(text: str, payload: str) -> Button:
    """Кнопка, нажатие которой приходит событием message_callback."""
    return {"type": "callback", "text": text, "payload": payload}


def link_button(text: str, url: str) -> Button:
    """Кнопка-ссылка (URL до 2048 символов)."""
    return {"type": "link", "text": text, "url": url}


def message_button(text: str) -> Button:
    """Кнопка, отправляющая боту свой текст как обычное сообщение."""
    return {"type": "message", "text": text}


def inline_keyboard(buttons: Sequence[Sequence[Button]]) -> dict[str, Any]:
    """Вложение inline_keyboard из рядов кнопок."""
    rows = [list(row) for row in buttons]
    total = sum(len(r) for r in rows)
    if len(rows) > KEYBOARD_MAX_ROWS or total > KEYBOARD_MAX_BUTTONS:
        log.warning("MAX: клавиатура превышает лимиты (%s рядов, %s кнопок)", len(rows), total)
    for row in rows:
        limit = 3 if any(b.get("type") in _WIDE_BUTTONS for b in row) else KEYBOARD_MAX_IN_ROW
        if len(row) > limit:
            log.warning("MAX: в ряду %s кнопок, допустимо %s", len(row), limit)
    return {"type": "inline_keyboard", "payload": {"buttons": rows}}


# --------------------------------------------------------------------------- клиент


class MaxClient:
    """Тонкий клиент MAX Bot API. Методы возвращают JSON-ответ как dict.

    Ошибки API не бросаются исключением — логируются и возвращаются вызывающему
    (обычно {"code": ..., "message": ...}). Сетевые ошибки aiohttp пробрасываются.
    Исключение — upload(): без url/token вложение не собрать, поэтому MaxUploadError.
    """

    def __init__(
        self,
        token: str | None = None,
        *,
        base_url: str = BASE_URL,
        session: aiohttp.ClientSession | None = None,
    ) -> None:
        self.token = token or settings.max_bot_token
        self.base_url = base_url.rstrip("/")
        # Внешняя сессия (переиспользование соединений / моки в тестах)
        self._session = session
        if not self.token:
            log.warning("MAX_BOT_TOKEN не задан — MAX-клиент не сможет слать сообщения")

    async def _request(
        self,
        http_method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
        timeout: float | None = None,
    ) -> dict[str, Any]:
        url = f"{self.base_url}/{path.lstrip('/')}"
        headers = {"Authorization": self.token or ""}
        # None не отправляем; bool → "true"/"false" (aiohttp не принимает bool в query)
        query = {
            k: (str(v).lower() if isinstance(v, bool) else v)
            for k, v in (params or {}).items()
            if v is not None
        }
        client_timeout = aiohttp.ClientTimeout(total=timeout) if timeout else None

        async def _do(http: aiohttp.ClientSession) -> dict[str, Any]:
            async with http.request(
                http_method,
                url,
                params=query or None,
                json=json,
                headers=headers,
                timeout=client_timeout,
            ) as resp:
                data = await resp.json(content_type=None)
                if resp.status >= 400:
                    log.error("MAX API error %s on %s %s: %s", resp.status, http_method, path, data)
                return data if isinstance(data, dict) else {"data": data}

        if self._session is not None:
            return await _do(self._session)
        async with aiohttp.ClientSession() as http:
            return await _do(http)

    async def _upload_multipart(self, url: str, content: bytes, filename: str) -> tuple[int, Any]:
        """Multipart-загрузка на хост из /uploads. Токен бота туда не передаём."""
        form = aiohttp.FormData()
        form.add_field("data", content, filename=filename)

        async def _do(http: aiohttp.ClientSession) -> tuple[int, Any]:
            async with http.request("POST", url, data=form) as resp:
                raw = await resp.text()
                try:
                    return resp.status, json.loads(raw)
                except ValueError:
                    return resp.status, raw  # video/audio могут ответить не JSON (retval)

        if self._session is not None:
            return await _do(self._session)
        async with aiohttp.ClientSession() as http:
            return await _do(http)

    # ------------------------------------------------------------------ бот

    async def get_me(self) -> dict[str, Any]:
        """Информация о боте: {user_id, first_name, username, is_bot, ...}."""
        return await self._request("GET", "me")

    # ------------------------------------------------------------------ сообщения

    async def send_message(
        self,
        chat_id: int | str | None = None,
        text: str | None = None,
        *,
        user_id: int | None = None,
        attachments: list[dict[str, Any]] | None = None,
        format: str | None = None,  # "markdown" | "html"
        notify: bool | None = None,
        disable_link_preview: bool | None = None,
    ) -> dict[str, Any]:
        """Общий метод POST /messages. Нужен chat_id (чат/канал/диалог) или user_id.

        Успешный ответ: {"message": {...Message}}. Если вложение ещё обрабатывается
        (attachment.not.ready), отправка повторяется с паузами SEND_RETRY_DELAYS.
        """
        if chat_id is None and user_id is None:
            raise ValueError("MAX: нужен chat_id или user_id")
        if text and len(text) > TEXT_MAX_LEN:
            log.warning("MAX: текст длиннее %s символов, API может отклонить", TEXT_MAX_LEN)
        body: dict[str, Any] = {"text": text}
        if attachments is not None:
            body["attachments"] = attachments
        if format is not None:
            body["format"] = format
        if notify is not None:
            body["notify"] = notify
        params = {
            "chat_id": chat_id,
            "user_id": user_id,
            "disable_link_preview": disable_link_preview,
        }
        data = await self._request("POST", "messages", params=params, json=body)
        if attachments:
            for delay in SEND_RETRY_DELAYS:
                if data.get("code") != NOT_READY_CODE:
                    break
                log.info("MAX: вложение ещё обрабатывается, повтор через %s c", delay)
                await asyncio.sleep(delay)
                data = await self._request("POST", "messages", params=params, json=body)
        return data

    async def send_text(
        self, chat_id: int | str | None, text: str, *, user_id: int | None = None
    ) -> dict[str, Any]:
        """Отправить текстовое сообщение в чат (chat_id) или пользователю (user_id)."""
        return await self.send_message(chat_id, text, user_id=user_id)

    async def send_keyboard(
        self,
        chat_id: int | str | None,
        text: str,
        buttons: Sequence[Sequence[Button]],
        *,
        user_id: int | None = None,
    ) -> dict[str, Any]:
        """Отправить сообщение с inline-клавиатурой.

        buttons — ряды кнопок: [[callback_button("Да", "yes"), callback_button("Нет", "no")]]
        """
        return await self.send_message(
            chat_id, text, user_id=user_id, attachments=[inline_keyboard(buttons)]
        )

    async def answer_callback(
        self,
        callback_id: str,
        *,
        notification: str | None = None,
        message: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Ответить на нажатие callback-кнопки: всплывающее уведомление и/или новое сообщение.

        message — NewMessageBody ({"text": ..., "attachments": [...]}) заменит исходное.
        """
        # TODO-VERIFY: поле "notification" есть в официальном Go-клиенте
        # (model.CallbackAnswer) и описано в тексте метода, но в таблице «Тело запроса»
        # на https://dev.max.ru/docs-api/methods/POST/answers указано только "message".
        body: dict[str, Any] = {}
        if message is not None:
            body["message"] = message
        if notification is not None:
            body["notification"] = notification
        return await self._request(
            "POST", "answers", params={"callback_id": callback_id}, json=body
        )

    # ------------------------------------------------------------------ файлы

    async def get_upload_url(self, upload_type: str) -> dict[str, Any]:
        """POST /uploads?type=... → {"url": ..., "token"?: ...} (token приходит для video/audio)."""
        if upload_type not in UPLOAD_TYPES:
            raise ValueError(f"MAX: тип загрузки должен быть одним из {UPLOAD_TYPES}")
        return await self._request("POST", "uploads", params={"type": upload_type})

    async def upload(
        self, upload_type: str, file: FileSource, *, filename: str | None = None
    ) -> dict[str, Any]:
        """Загрузить файл и вернуть готовое вложение {"type": ..., "payload": {...}}.

        file — байты или путь. Вложение можно переиспользовать в нескольких сообщениях
        (документация советует загружать частые файлы заранее).
        """
        if isinstance(file, (str, Path)):
            path = Path(file)
            content = await asyncio.to_thread(path.read_bytes)
            filename = filename or path.name
        else:
            content = file

        target = await self.get_upload_url(upload_type)
        url = target.get("url")
        if not url:
            raise MaxUploadError(f"MAX /uploads не вернул url: {target}")

        status, result = await self._upload_multipart(url, content, filename or upload_type)
        if status >= 400:
            raise MaxUploadError(f"MAX upload HTTP {status}: {result}")

        if upload_type in ("video", "audio"):
            token = target.get("token")
            if not token:
                raise MaxUploadError(f"MAX /uploads не вернул token для {upload_type}: {target}")
            payload: dict[str, Any] = {"token": token}
        else:
            if not isinstance(result, dict) or not result:
                raise MaxUploadError(f"MAX upload: неожиданный ответ {result!r}")
            payload = result
        return {"type": upload_type, "payload": payload}

    async def send_file(
        self,
        chat_id: int | str | None,
        file: FileSource,
        upload_type: str = "file",
        *,
        text: str | None = None,
        user_id: int | None = None,
        filename: str | None = None,
    ) -> dict[str, Any]:
        """Загрузить файл и отправить его одним сообщением (с подписью text)."""
        attachment = await self.upload(upload_type, file, filename=filename)
        return await self.send_message(chat_id, text, user_id=user_id, attachments=[attachment])

    # ------------------------------------------------------------------ обновления

    async def get_updates(
        self,
        marker: int | None = None,
        *,
        timeout: int = 30,
        limit: int = 100,
        types: Sequence[str] | None = None,
    ) -> dict[str, Any]:
        """Long polling: {"updates": [...Update], "marker": int}.

        marker=None → только последнее обновление; дальше передавай marker из ответа.
        Не работает при активной webhook-подписке. Для продакшена MAX рекомендует webhook.
        """
        params = {
            "marker": marker,
            "timeout": timeout,  # 0..90 сек
            "limit": limit,      # 1..1000
            "types": ",".join(types) if types else None,
        }
        # HTTP-таймаут с запасом поверх серверного long-poll таймаута
        return await self._request("GET", "updates", params=params, timeout=timeout + 15)

    async def subscribe(
        self,
        url: str,
        *,
        update_types: Sequence[str] | None = None,
        secret: str | None = None,
    ) -> dict[str, Any]:
        """Подписать бота на webhook (только HTTPS, порт 443, доверенный сертификат).

        secret (5–256 символов, [A-Za-z0-9_-]) вернётся в заголовке X-Max-Bot-Api-Secret.
        """
        body: dict[str, Any] = {"url": url}
        if update_types:
            body["update_types"] = list(update_types)
        if secret:
            body["secret"] = secret
        return await self._request("POST", "subscriptions", json=body)

    async def unsubscribe(self, url: str) -> dict[str, Any]:
        """Отписать webhook (после этого снова работает long polling)."""
        return await self._request("DELETE", "subscriptions", params={"url": url})

    async def get_subscriptions(self) -> dict[str, Any]:
        """Список активных webhook-подписок: {"subscriptions": [...]}."""
        return await self._request("GET", "subscriptions")
