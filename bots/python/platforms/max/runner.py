"""Раннер MAX: long polling (разработка) и webhook (продакшен) + учёт пользователей.

По образцу platforms/telegram/runner.py: init_db → работа → корректная остановка.
Диспетчер повторяет UserMiddleware Telegram-стека:
  - сессия БД на время обработки события (commit при успехе);
  - get_or_create пользователя (platform="max", external_id=user_id);
  - лог message_created в MessageLog (для statistics);
  - блокировка забаненных;
  - обработчик получает `client`, `session`, `db_user` через MaxContext.

Пример:
    async def handle(update: MaxUpdate, ctx: MaxContext) -> None:
        if update.update_type == "message_created":
            await ctx.client.send_text(update.chat_id, f"Эхо: {update.text}")

    asyncio.run(run_polling(handle))
"""
from __future__ import annotations

import asyncio
import contextlib
import os
from collections import OrderedDict
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass

import aiohttp
from aiohttp import web
from dotenv import dotenv_values
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import BASE_DIR, settings
from core.database.base import dispose_db, get_session, init_db
from core.database.models import Platform, User
from core.database.repositories import MessageRepository, UserRepository
from core.i18n import t
from core.logger import get_logger
from platforms.background import shares_db_connection
from platforms.max.client import MaxClient
from platforms.max.webhook import (
    HANDLED_TYPES,
    MaxUpdate,
    MaxWebhook,
    UpdateHandler,
    parse_updates,
    webhook_app,
)

log = get_logger(__name__)

DEDUP_SIZE = 1000
POLL_DELAY_MIN = 5    # сек, пауза после ошибки (как в официальном TS-клиенте)
POLL_DELAY_MAX = 60


def webhook_secret() -> str | None:
    """MAX_WEBHOOK_SECRET из окружения или .env (в core.config поля нет — ядро не трогаем)."""
    return os.environ.get("MAX_WEBHOOK_SECRET") or dotenv_values(BASE_DIR / ".env").get(
        "MAX_WEBHOOK_SECRET"
    )


@dataclass(slots=True)
class MaxContext:
    """То, что получает обработчик вместе с событием."""

    client: MaxClient
    session: AsyncSession
    db_user: User


MaxHandler = Callable[[MaxUpdate, MaxContext], Awaitable[None]]


def _keep(new: str | None, old: str | None) -> str | None:
    """get_or_create перезаписывает профиль: пустое поле события не стирает известное."""
    return new if new is not None else old


def make_dispatcher(handler: MaxHandler, client: MaxClient) -> UpdateHandler:
    """Обернуть обработчик: БД-сессия, регистрация, бан, лог, дедуп."""
    seen: OrderedDict[str, None] = OrderedDict()
    # Одно соединение на все сессии (SQLite :memory:) — сессии по одной, иначе параллельные
    # воркеры молча теряют записи друг друга (см. platforms/background.py)
    db_lock = asyncio.Lock() if shares_db_connection() else contextlib.nullcontext()

    async def dispatch(update: MaxUpdate) -> None:
        key = update.dedup_key
        if key:
            if key in seen:
                log.debug("MAX: повторная доставка %s — пропуск", key)
                return
            seen[key] = None
            if len(seen) > DEDUP_SIZE:
                seen.popitem(last=False)

        if update.user_id is None:
            # Пост в канале — отправителя нет, пользователя не регистрируем
            log.debug("MAX: событие без пользователя (%s) — пропуск", update.update_type)
            return

        async with db_lock, get_session() as session:
            users = UserRepository(session)
            existing = await users.get(Platform.MAX, update.user_id)
            db_user, _created = await users.get_or_create(
                platform=Platform.MAX,
                external_id=update.user_id,
                username=_keep(update.username, existing.username if existing else None),
                first_name=_keep(update.first_name, existing.first_name if existing else None),
                last_name=_keep(update.last_name, existing.last_name if existing else None),
                language_code=(update.user_locale or None) and update.user_locale[:10],
                is_admin=settings.is_admin(update.user_id),
            )

            # Забаненным — стоп (кроме админов)
            if db_user.is_banned and not settings.is_admin(update.user_id):
                locale = db_user.language_code or settings.default_locale
                text = t("common.banned", locale=locale)
                if update.callback_id:
                    await client.answer_callback(update.callback_id, notification=text)
                elif update.chat_id is not None:
                    await client.send_text(update.chat_id, text)
                return

            # Лог сообщения для статистики (как UserMiddleware: только сообщения)
            if update.update_type == "message_created":
                await MessageRepository(session).log(
                    user_id=db_user.id,
                    platform=Platform.MAX,
                    text=update.text,
                    content_type=update.content_type,
                )

            await handler(update, MaxContext(client=client, session=session, db_user=db_user))

    return dispatch


async def run_polling(
    handler: MaxHandler,
    *,
    client: MaxClient | None = None,
    types: Sequence[str] = HANDLED_TYPES,
    timeout: int = 30,
    skip_bots: bool = True,
) -> None:
    """Long polling до Ctrl+C. Только для разработки: при активном webhook не работает."""
    client = client or MaxClient()
    await init_db()
    dispatch = make_dispatcher(handler, client)
    marker: int | None = None
    delay = POLL_DELAY_MIN
    try:
        me = await client.get_me()
        log.info("Starting MAX bot @%s (id=%s) in polling mode", me.get("username"), me.get("user_id"))
        while True:
            try:
                data = await client.get_updates(marker, timeout=timeout, types=types)
            except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
                data = {"message": repr(exc)}
            if "updates" not in data:
                # 401/429/5xx/сеть — ждём с экспоненциальной паузой
                log.warning("MAX polling: ошибка %s, повтор через %s c", data, delay)
                await asyncio.sleep(delay)
                delay = min(delay * 2, POLL_DELAY_MAX)
                continue
            delay = POLL_DELAY_MIN
            marker = data.get("marker", marker)
            for update in parse_updates(data):
                if skip_bots and update.is_bot:
                    continue
                try:
                    await dispatch(update)
                except Exception:  # noqa: BLE001 — одно событие не должно ронять цикл
                    log.exception("MAX polling: ошибка обработчика (%s)", update.update_type)
    finally:
        await dispose_db()
        log.info("MAX bot stopped")


def build_webhook(
    handler: MaxHandler,
    *,
    client: MaxClient | None = None,
    secret: str | None = None,
    background: bool = True,
    workers: int = 4,
) -> MaxWebhook:
    """Эндпоинт без HTTP-сервера (handle_post) — для тестов и своего сервера."""
    client = client or MaxClient()
    return MaxWebhook(
        make_dispatcher(handler, client),
        secret=secret or webhook_secret(),
        background=background,
        workers=workers,
    )


def build_app(
    handler: MaxHandler,
    *,
    client: MaxClient | None = None,
    path: str = "/webhook",
    secret: str | None = None,
    workers: int = 4,
) -> web.Application:
    """Собрать aiohttp-приложение вебхука (без запуска)."""
    return webhook_app(
        build_webhook(handler, client=client, secret=secret, workers=workers), path=path
    )


async def run_webhook(
    handler: MaxHandler,
    *,
    host: str = "0.0.0.0",
    port: int = 8080,
    path: str = "/webhook",
    public_url: str | None = None,
    client: MaxClient | None = None,
    types: Sequence[str] = HANDLED_TYPES,
    workers: int = 4,
) -> None:
    """Сервер вебхука до Ctrl+C. Снаружи — HTTPS на 443 (reverse-proxy на host:port).

    public_url (например https://bot.example.com/webhook) — если задан, при старте
    вызывается POST /subscriptions с MAX_WEBHOOK_SECRET.
    MAX получает 200 сразу, события обрабатываются в фоне (workers воркеров).
    """
    client = client or MaxClient()
    secret = webhook_secret()
    await init_db()
    app = build_app(handler, client=client, path=path, secret=secret, workers=workers)
    runner = web.AppRunner(app)
    await runner.setup()
    try:
        await web.TCPSite(runner, host, port).start()
        if public_url:
            result = await client.subscribe(public_url, update_types=types, secret=secret)
            log.info("MAX subscribe %s: %s", public_url, result)
        log.info("MAX webhook listening on http://%s:%s%s", host, port, path)
        await asyncio.Event().wait()  # работаем, пока задачу не отменят
    finally:
        await runner.cleanup()
        await dispose_db()
        log.info("MAX webhook stopped")
