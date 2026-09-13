"""Приём вебхуков Instagram: верификация, проверка подписи, нормализация событий.

Сверено с официальной документацией Meta (2026-09):
  - https://developers.facebook.com/docs/instagram-platform/webhooks/
  - https://developers.facebook.com/docs/instagram-platform/webhooks/examples/

Верификация (GET):  ?hub.mode=subscribe&hub.verify_token=<IG_VERIFY_TOKEN>&hub.challenge=<int>
                    → ответить телом hub.challenge (200), иначе 403.
События (POST):     заголовок X-Hub-Signature-256: sha256=<HMAC-SHA256(body, IG_APP_SECRET)>
                    → ответить 200 OK. Meta повторяет недоставленное до 36 часов —
                    обработчик должен быть идемпотентным (дедуп по mid).

200 отдаётся сразу, события обрабатываются в фоне (platforms.background.KeyedWorkerPool):
сообщения одного собеседника — по порядку, разных — параллельно.
"""
from __future__ import annotations

import hashlib
import hmac
import json
from collections.abc import Awaitable, Callable, Iterable, Mapping
from dataclasses import dataclass, field
from typing import Any

from aiohttp import web

from core.database.models import Platform
from core.logger import get_logger
from platforms.background import KeyedWorkerPool

log = get_logger(__name__)

SIGNATURE_HEADER = "X-Hub-Signature-256"
SIGNATURE_PREFIX = "sha256="


@dataclass(slots=True)
class IncomingMessage:
    """Нормализованное входящее сообщение Instagram (не зависит от формы JSON Meta)."""

    account_id: str            # entry.id — ID профессионального аккаунта (IG_ID)
    sender_id: str             # messaging.sender.id — IGSID собеседника
    recipient_id: str          # messaging.recipient.id
    timestamp: int             # messaging.timestamp (мс)
    mid: str | None            # message.mid / postback.mid
    text: str | None           # message.text / postback.title
    content_type: str          # text | quick_reply | postback | <attachment type> | deleted | unsupported
    payload: str | None = None  # quick_reply.payload / postback.payload
    attachments: list[dict[str, Any]] = field(default_factory=list)  # [{"type", "url"}]
    is_echo: bool = False      # сообщение отправлено самим бизнес-аккаунтом
    platform: str = Platform.INSTAGRAM
    raw: dict[str, Any] = field(default_factory=dict, repr=False)


MessageHandler = Callable[[IncomingMessage], Awaitable[None]]


# --------------------------------------------------------------------------- проверки


def verify_challenge(query: Mapping[str, str], verify_token: str | None) -> str | None:
    """Проверка GET-запроса подписки. Возвращает hub.challenge или None (→ 403)."""
    if not verify_token:
        return None
    mode = query.get("hub.mode")
    token = query.get("hub.verify_token") or ""
    challenge = query.get("hub.challenge")
    if mode == "subscribe" and challenge is not None and hmac.compare_digest(token, verify_token):
        return challenge
    return None


def verify_signature(body: bytes, signature_header: str | None, app_secret: str) -> bool:
    """Проверка X-Hub-Signature-256: HMAC-SHA256 от сырого тела ключом App Secret."""
    if not signature_header or not signature_header.startswith(SIGNATURE_PREFIX):
        return False
    expected = hmac.new(app_secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header[len(SIGNATURE_PREFIX):])


# --------------------------------------------------------------------------- парсинг


def _parse_message(entry_id: str, event: dict[str, Any]) -> IncomingMessage | None:
    base = {
        "account_id": entry_id,
        "sender_id": str((event.get("sender") or {}).get("id", "")),
        "recipient_id": str((event.get("recipient") or {}).get("id", "")),
        "timestamp": int(event.get("timestamp") or 0),
        "raw": event,
    }

    if "message" in event:
        msg = event["message"] or {}
        attachments = [
            {"type": a.get("type"), "url": (a.get("payload") or {}).get("url")}
            for a in msg.get("attachments") or []
        ]
        quick_reply = msg.get("quick_reply") or {}
        if msg.get("is_deleted"):
            content_type = "deleted"
        elif msg.get("is_unsupported"):
            content_type = "unsupported"
        elif quick_reply:
            content_type = "quick_reply"
        elif attachments:
            content_type = str(attachments[0]["type"] or "attachment")
        else:
            content_type = "text"
        return IncomingMessage(
            mid=msg.get("mid"),
            text=msg.get("text"),
            content_type=content_type,
            payload=quick_reply.get("payload"),
            attachments=attachments,
            is_echo=bool(msg.get("is_echo")),
            **base,
        )

    if "postback" in event:
        pb = event["postback"] or {}
        return IncomingMessage(
            mid=pb.get("mid"),
            text=pb.get("title"),
            content_type="postback",
            payload=pb.get("payload"),
            **base,
        )

    # reaction / read / referral / message_edit — не сообщения, пропускаем
    return None


def parse_events(payload: dict[str, Any] | list[Any]) -> list[IncomingMessage]:
    """Разобрать тело вебхука в список IncomingMessage (messages + messaging_postbacks)."""
    # В примерах документации тело иногда показано массивом — поддерживаем обе формы
    bodies: Iterable[Any] = payload if isinstance(payload, list) else [payload]
    result: list[IncomingMessage] = []
    for body in bodies:
        if not isinstance(body, dict) or body.get("object") != "instagram":
            continue
        for entry in body.get("entry") or []:
            entry_id = str(entry.get("id", ""))
            # Business Login for Instagram: события в entry.messaging[].
            # TODO-VERIFY: при Facebook Login for Business события приходят в entry.changes[]
            # (field/value) — формат messages в этом варианте в документации не показан.
            for event in entry.get("messaging") or []:
                parsed = _parse_message(entry_id, event)
                if parsed is not None:
                    result.append(parsed)
    return result


# --------------------------------------------------------------------------- эндпоинт


class InstagramWebhook:
    """Логика эндпоинта без HTTP-сервера: проверки, парсинг, фоновая обработка.

    handle_get / handle_post возвращают (status, body) — их вызывает aiohttp-приложение
    (webhook_app) или любой свой сервер; в тестах — напрямую, без сокетов.
    background=False — обработчик выполняется до ответа (только для отладки).
    """

    def __init__(
        self,
        handler: MessageHandler,
        *,
        verify_token: str | None = None,
        app_secret: str | None = None,
        check_signature: bool = True,
        skip_echo: bool = True,
        background: bool = True,
        workers: int = 4,
    ) -> None:
        if check_signature and not app_secret:
            raise ValueError("IG_APP_SECRET не задан — проверка X-Hub-Signature-256 невозможна")
        self._handler = handler
        self.verify_token = verify_token
        self.app_secret = app_secret or ""
        self.check_signature = check_signature
        self.skip_echo = skip_echo
        self._pool = (
            KeyedWorkerPool(self._run, workers=workers, name="instagram") if background else None
        )

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

    def handle_get(self, query: Mapping[str, str]) -> tuple[int, str]:
        challenge = verify_challenge(query, self.verify_token)
        if challenge is None:
            log.warning("IG webhook: верификация отклонена")
            return 403, "forbidden"
        log.info("IG webhook: подписка подтверждена")
        return 200, challenge

    async def handle_post(self, body: bytes, signature: str | None) -> tuple[int, str]:
        if self.check_signature and not verify_signature(body, signature, self.app_secret):
            log.warning("IG webhook: неверная подпись %s", SIGNATURE_HEADER)
            return 403, "invalid signature"
        try:
            data = json.loads(body or b"{}")
        except ValueError:
            return 400, "invalid json"

        for message in parse_events(data):
            if self.skip_echo and message.is_echo:
                continue
            if self._pool is None:
                await self._run(message)
                continue
            if not self._pool.running:
                await self._pool.start()
            self._pool.submit(message.sender_id, message)
        # Meta ждёт быстрый 200, иначе повторяет доставку — обработка идёт в фоне
        return 200, "EVENT_RECEIVED"

    async def _run(self, message: IncomingMessage) -> None:
        try:
            await self._handler(message)
        except Exception:  # noqa: BLE001 — одно сообщение не должно ронять остальные
            log.exception("IG webhook: ошибка обработчика (mid=%s)", message.mid)


# --------------------------------------------------------------------------- aiohttp

WEBHOOK_KEY = web.AppKey("instagram_webhook", InstagramWebhook)


def webhook_app(endpoint: InstagramWebhook, *, path: str = "/webhook") -> web.Application:
    """aiohttp-приложение с одним путём: GET — верификация, POST — события."""

    async def on_get(request: web.Request) -> web.Response:
        status, text = endpoint.handle_get(request.query)
        return web.Response(status=status, text=text)

    async def on_post(request: web.Request) -> web.Response:
        status, text = await endpoint.handle_post(
            await request.read(), request.headers.get(SIGNATURE_HEADER)
        )
        return web.Response(status=status, text=text)

    async def on_startup(_app: web.Application) -> None:
        await endpoint.start()

    async def on_cleanup(_app: web.Application) -> None:
        await endpoint.stop()  # обработать принятое перед выходом

    app = web.Application()
    app[WEBHOOK_KEY] = endpoint
    app.router.add_get(path, on_get)
    app.router.add_post(path, on_post)
    app.on_startup.append(on_startup)
    app.on_cleanup.append(on_cleanup)
    return app


def create_webhook_app(
    handler: MessageHandler,
    *,
    path: str = "/webhook",
    verify_token: str | None = None,
    app_secret: str | None = None,
    check_signature: bool = True,
    skip_echo: bool = True,
    background: bool = True,
    workers: int = 4,
) -> web.Application:
    """Собрать эндпоинт и aiohttp-приложение одним вызовом.

    check_signature=False допустим только для локальной отладки без App Secret.
    """
    endpoint = InstagramWebhook(
        handler,
        verify_token=verify_token,
        app_secret=app_secret,
        check_signature=check_signature,
        skip_echo=skip_echo,
        background=background,
        workers=workers,
    )
    return webhook_app(endpoint, path=path)
