"""Раннер Instagram: aiohttp-сервер вебхука, учёт пользователей, роутинг в обработчик.

Повторяет поведение UserMiddleware из Telegram-стека:
  - открывает сессию БД на время обработки сообщения (commit при успехе);
  - get_or_create пользователя (platform="instagram", external_id=IGSID);
    имя и username — из User Profile API при первом сообщении, дальше не затираются;
  - логирует входящее в MessageLog (для statistics);
  - блокирует забаненных;
  - отдаёт обработчику `session` и `db_user` через InstagramContext.

Пример:
    async def handle(msg: IncomingMessage, ctx: InstagramContext) -> None:
        await ctx.client.send_text(msg.sender_id, f"Эхо: {msg.text}")

    asyncio.run(run_webhook(handle, port=8080))
"""
from __future__ import annotations

import asyncio
import contextlib
from collections import OrderedDict
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

from aiohttp import web
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database.base import dispose_db, get_session, init_db
from core.database.models import Platform, User
from core.database.repositories import MessageRepository, UserRepository
from core.i18n import t
from core.logger import get_logger
from platforms.background import shares_db_connection
from platforms.instagram.client import InstagramClient
from platforms.instagram.webhook import (
    IncomingMessage,
    InstagramWebhook,
    MessageHandler,
    webhook_app,
)

log = get_logger(__name__)

# Сколько последних mid помнить для дедупликации повторных доставок Meta
DEDUP_SIZE = 1000


@dataclass(slots=True)
class InstagramContext:
    """То, что получает обработчик вместе с сообщением."""

    client: InstagramClient
    session: AsyncSession
    db_user: User


InstagramHandler = Callable[[IncomingMessage, InstagramContext], Awaitable[None]]


async def _fetch_profile(client: InstagramClient, igsid: str) -> tuple[str | None, str | None]:
    """(username, name) из User Profile API; (None, None), если профиль недоступен."""
    try:
        profile = await client.get_user_profile(igsid, fields=("name", "username"))
    except Exception as exc:  # noqa: BLE001 — без профиля сообщение всё равно обрабатываем
        log.warning("IG: не удалось получить профиль %s: %s", igsid, exc)
        return None, None
    if "error" in profile:
        log.warning("IG: профиль %s недоступен: %s", igsid, profile["error"])
        return None, None
    return profile.get("username"), profile.get("name")


def make_dispatcher(handler: InstagramHandler, client: InstagramClient) -> MessageHandler:
    """Обернуть обработчик: БД-сессия, регистрация, бан, лог, дедуп по mid."""
    seen: OrderedDict[str, None] = OrderedDict()
    # Одно соединение на все сессии (SQLite :memory:) — сессии по одной, иначе параллельные
    # воркеры молча теряют записи друг друга (см. platforms/background.py)
    db_lock = asyncio.Lock() if shares_db_connection() else contextlib.nullcontext()

    async def dispatch(msg: IncomingMessage) -> None:
        if msg.mid:
            if msg.mid in seen:
                log.debug("IG: повторная доставка mid=%s — пропуск", msg.mid)
                return
            seen[msg.mid] = None
            if len(seen) > DEDUP_SIZE:
                seen.popitem(last=False)

        # TODO-VERIFY: IGSID в User Profile API описан как int; что он всегда укладывается
        # в BigInteger (int64) колонки users.external_id — документацией явно не подтверждено.
        try:
            external_id = int(msg.sender_id)
        except ValueError:
            log.warning("IG: нечисловой sender.id=%r — сообщение пропущено", msg.sender_id)
            return

        async with db_lock, get_session() as session:
            users = UserRepository(session)
            existing = await users.get(Platform.INSTAGRAM, external_id)
            if existing is None:
                # Новый собеседник — один раз берём имя из User Profile API
                username, first_name = await _fetch_profile(client, msg.sender_id)
            else:
                # get_or_create перезаписывает профиль — передаём уже известные значения
                username, first_name = existing.username, existing.first_name
            db_user, _created = await users.get_or_create(
                platform=Platform.INSTAGRAM,
                external_id=external_id,
                username=username,
                first_name=first_name,
                last_name=existing.last_name if existing else None,
                is_admin=settings.is_admin(external_id),
            )

            # Забаненным — стоп (кроме админов)
            if db_user.is_banned and not settings.is_admin(external_id):
                locale = db_user.language_code or settings.default_locale
                await client.send_text(msg.sender_id, t("common.banned", locale=locale))
                return

            # Лог сообщения для статистики
            await MessageRepository(session).log(
                user_id=db_user.id,
                platform=Platform.INSTAGRAM,
                text=msg.text,
                content_type=msg.content_type,
            )

            await handler(msg, InstagramContext(client=client, session=session, db_user=db_user))

    return dispatch


def build_webhook(
    handler: InstagramHandler,
    *,
    client: InstagramClient | None = None,
    check_signature: bool = True,
    background: bool = True,
    workers: int = 4,
) -> InstagramWebhook:
    """Эндпоинт без HTTP-сервера (handle_get/handle_post) — для тестов и своего сервера."""
    client = client or InstagramClient()
    return InstagramWebhook(
        make_dispatcher(handler, client),
        verify_token=settings.ig_verify_token,
        app_secret=settings.ig_app_secret,
        check_signature=check_signature,
        background=background,
        workers=workers,
    )


def build_app(
    handler: InstagramHandler,
    *,
    client: InstagramClient | None = None,
    path: str = "/webhook",
    check_signature: bool = True,
    workers: int = 4,
) -> web.Application:
    """Собрать aiohttp-приложение (без запуска)."""
    endpoint = build_webhook(
        handler, client=client, check_signature=check_signature, workers=workers
    )
    return webhook_app(endpoint, path=path)


async def run_webhook(
    handler: InstagramHandler,
    *,
    host: str = "0.0.0.0",
    port: int = 8080,
    path: str = "/webhook",
    client: InstagramClient | None = None,
    check_signature: bool = True,
    workers: int = 4,
) -> None:
    """Запустить сервер вебхука до Ctrl+C. Снаружи нужен HTTPS (reverse-proxy).

    Meta получает 200 сразу, сообщения обрабатываются в фоне (workers воркеров);
    при остановке принятое дообрабатывается.
    """
    await init_db()
    app = build_app(
        handler, client=client, path=path, check_signature=check_signature, workers=workers
    )
    runner = web.AppRunner(app)
    await runner.setup()
    try:
        await web.TCPSite(runner, host, port).start()
        log.info("Instagram webhook listening on http://%s:%s%s", host, port, path)
        await asyncio.Event().wait()  # работаем, пока задачу не отменят
    finally:
        await runner.cleanup()
        await dispose_db()
        log.info("Instagram webhook stopped")
