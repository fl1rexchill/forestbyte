"""Приём событий MAX: проверка секрета вебхука и нормализация объекта Update.

Сверено с официальной документацией (2026-09):
  - https://dev.max.ru/docs-api/methods/POST/subscriptions
  - https://dev.max.ru/docs-api/objects/Update
  - типы из github.com/max-messenger/max-bot-api-client-ts (types/subcription.ts, message.ts)

Webhook: MAX шлёт HTTPS POST с объектом Update. Если при подписке задан secret —
он приходит в заголовке X-Max-Bot-Api-Secret. Ответ 200 нужно вернуть за 30 секунд,
иначе до 10 повторов (60с × 2.5ⁿ); без успеха 8 часов — бот автоматически отписывается.
GET-верификации (как у Meta) у MAX нет.

200 отдаётся сразу, события обрабатываются в фоне (platforms.background.KeyedWorkerPool):
события одного пользователя — по порядку, разных — параллельно.
"""
from __future__ import annotations

import hmac
import json
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

from aiohttp import web

from core.database.models import Platform
from core.logger import get_logger
from platforms.background import KeyedWorkerPool

log = get_logger(__name__)

SECRET_HEADER = "X-Max-Bot-Api-Secret"

# Типы Update, которые превращаются в MaxUpdate (остальные пропускаются)
HANDLED_TYPES = ("message_created", "message_callback", "bot_started")


@dataclass(slots=True)
class MaxUpdate:
    """Нормализованное событие MAX (сообщение, нажатие кнопки, старт бота)."""

    update_type: str             # message_created | message_callback | bot_started
    timestamp: int               # Unix ms
    chat_id: int | None          # куда отвечать (диалог/чат/канал)
    user_id: int | None          # автор события (None для постов в канале)
    content_type: str            # text | callback | bot_started | <тип вложения>
    text: str | None = None      # body.text
    mid: str | None = None       # body.mid
    payload: str | None = None   # callback.payload / bot_started.payload (deep-link)
    callback_id: str | None = None
    chat_type: str | None = None  # dialog | chat | channel
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    is_bot: bool = False
    user_locale: str | None = None
    attachments: list[dict[str, Any]] = field(default_factory=list)  # [{"type", "payload"}]
    platform: str = Platform.MAX
    raw: dict[str, Any] = field(default_factory=dict, repr=False)

    @property
    def dedup_key(self) -> str | None:
        """Ключ для отсечения повторной доставки."""
        if self.callback_id:
            return f"cb:{self.callback_id}"
        if self.mid:
            return f"msg:{self.mid}"
        return None

    @property
    def order_key(self) -> str:
        """Ключ очереди: события одного пользователя (или чата) обрабатываются по порядку."""
        return str(self.user_id if self.user_id is not None else self.chat_id)


UpdateHandler = Callable[[MaxUpdate], Awaitable[None]]


# --------------------------------------------------------------------------- проверки


def verify_secret(header_value: str | None, secret: str | None) -> bool:
    """Проверка X-Max-Bot-Api-Secret. Без настроенного секрета проверка не выполняется."""
    if not secret:
        return True
    return bool(header_value) and hmac.compare_digest(header_value or "", secret)


# --------------------------------------------------------------------------- парсинг


def _user_fields(user: dict[str, Any] | None) -> dict[str, Any]:
    user = user or {}
    return {
        "user_id": user.get("user_id"),
        "username": user.get("username"),
        "first_name": user.get("first_name") or user.get("name"),
        "last_name": user.get("last_name"),
        "is_bot": bool(user.get("is_bot")),
    }


def parse_update(update: dict[str, Any]) -> MaxUpdate | None:
    """Разобрать один объект Update. None — тип не поддерживается / не распознан."""
    update_type = update.get("update_type")
    timestamp = int(update.get("timestamp") or 0)
    # TODO-VERIFY: формат user_locale (например "ru" или "ru-RU") в документации не указан,
    # в TS-клиенте enum UserLocale пустой.
    locale = update.get("user_locale")

    if update_type == "message_created":
        message = update.get("message") or {}
        body = message.get("body") or {}
        recipient = message.get("recipient") or {}
        attachments = [
            {"type": a.get("type"), "payload": a.get("payload")}
            for a in body.get("attachments") or []
        ]
        text = body.get("text")
        content_type = "text" if text or not attachments else str(attachments[0]["type"])
        return MaxUpdate(
            update_type=update_type,
            timestamp=timestamp,
            chat_id=recipient.get("chat_id"),
            chat_type=recipient.get("chat_type"),
            content_type=content_type,
            text=text,
            mid=body.get("mid"),
            attachments=attachments,
            user_locale=locale,
            raw=update,
            **_user_fields(message.get("sender")),
        )

    if update_type == "message_callback":
        callback = update.get("callback") or {}
        message = update.get("message") or {}
        recipient = message.get("recipient") or {}
        return MaxUpdate(
            update_type=update_type,
            timestamp=timestamp,
            chat_id=recipient.get("chat_id"),
            chat_type=recipient.get("chat_type"),
            content_type="callback",
            mid=(message.get("body") or {}).get("mid"),
            payload=callback.get("payload"),
            callback_id=callback.get("callback_id"),
            user_locale=locale,
            raw=update,
            **_user_fields(callback.get("user")),
        )

    if update_type == "bot_started":
        return MaxUpdate(
            update_type=update_type,
            timestamp=timestamp,
            chat_id=update.get("chat_id"),
            chat_type="dialog",
            content_type="bot_started",
            payload=update.get("payload"),
            user_locale=locale,
            raw=update,
            **_user_fields(update.get("user")),
        )

    return None


def parse_updates(data: dict[str, Any] | list[Any]) -> list[MaxUpdate]:
    """Разобрать тело webhook (один Update) или ответ GET /updates ({"updates": [...]})."""
    if isinstance(data, dict) and "updates" in data:
        items = data.get("updates") or []
    elif isinstance(data, list):
        items = data
    else:
        items = [data]
    result = []
    for item in items:
        if isinstance(item, dict):
            parsed = parse_update(item)
            if parsed is not None:
                result.append(parsed)
    return result


# --------------------------------------------------------------------------- эндпоинт


class MaxWebhook:
    """Логика эндпоинта без HTTP-сервера: проверка секрета, парсинг, фоновая обработка.

    handle_post возвращает (status, body) — его вызывает aiohttp-приложение (webhook_app)
    или любой свой сервер; в тестах — напрямую, без сокетов.
    background=False — обработчик выполняется до ответа (только для отладки).
    """

    def __init__(
        self,
        handler: UpdateHandler,
        *,
        secret: str | None = None,
        skip_bots: bool = True,
        background: bool = True,
        workers: int = 4,
    ) -> None:
        if not secret:
            log.warning("MAX webhook: secret не задан — запросы не проверяются (задай MAX_WEBHOOK_SECRET)")
        self._handler = handler
        self.secret = secret
        self.skip_bots = skip_bots
        self._pool = KeyedWorkerPool(self._run, workers=workers, name="max") if background else None

    async def start(self) -> None:
        if self._pool is not None:
            await self._pool.start()

    async def drain(self) -> None:
        """Дождаться обработки всех принятых событий."""
        if self._pool is not None:
            await self._pool.drain()

    async def stop(self) -> None:
        if self._pool is not None:
            await self._pool.stop()

    async def handle_post(self, body: bytes, secret_header: str | None) -> tuple[int, str]:
        if not verify_secret(secret_header, self.secret):
            log.warning("MAX webhook: неверный %s", SECRET_HEADER)
            return 403, "invalid secret"
        try:
            data = json.loads(body or b"{}")
        except ValueError:
            return 400, "invalid json"

        for update in parse_updates(data):
            if self.skip_bots and update.is_bot:
                continue
            if self._pool is None:
                await self._run(update)
                continue
            if not self._pool.running:
                await self._pool.start()
            self._pool.submit(update.order_key, update)
        # MAX ждёт 200 за 30 секунд — обработка идёт в фоне
        return 200, '{"ok": true}'

    async def _run(self, update: MaxUpdate) -> None:
        try:
            await self._handler(update)
        except Exception:  # noqa: BLE001 — ошибка обработчика не должна давать ретраи MAX
            log.exception("MAX webhook: ошибка обработчика (%s)", update.update_type)


# --------------------------------------------------------------------------- aiohttp

WEBHOOK_KEY = web.AppKey("max_webhook", MaxWebhook)


def webhook_app(endpoint: MaxWebhook, *, path: str = "/webhook") -> web.Application:
    """aiohttp-приложение: POST <path> принимает Update."""

    async def on_post(request: web.Request) -> web.Response:
        status, text = await endpoint.handle_post(
            await request.read(), request.headers.get(SECRET_HEADER)
        )
        content_type = "application/json" if status == 200 else "text/plain"
        return web.Response(status=status, text=text, content_type=content_type)

    async def on_startup(_app: web.Application) -> None:
        await endpoint.start()

    async def on_cleanup(_app: web.Application) -> None:
        await endpoint.stop()  # обработать принятое перед выходом

    app = web.Application()
    app[WEBHOOK_KEY] = endpoint
    app.router.add_post(path, on_post)
    app.on_startup.append(on_startup)
    app.on_cleanup.append(on_cleanup)
    return app


def create_webhook_app(
    handler: UpdateHandler,
    *,
    path: str = "/webhook",
    secret: str | None = None,
    skip_bots: bool = True,
    background: bool = True,
    workers: int = 4,
) -> web.Application:
    """Собрать эндпоинт и aiohttp-приложение одним вызовом."""
    endpoint = MaxWebhook(
        handler, secret=secret, skip_bots=skip_bots, background=background, workers=workers
    )
    return webhook_app(endpoint, path=path)
