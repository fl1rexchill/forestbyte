"""Общие фикстуры pytest.

Тестовое окружение выставляется ДО импорта core.config: фиктивные токены,
SQLite in-memory, без лог-файла. Переменные окружения важнее .env, поэтому
реальные токены из .env в тесты не попадают. Сеть не используется.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

import pytest

PYTHON_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PYTHON_ROOT))

os.environ.update(
    {
        "BOT_TOKEN": "123456:DUMMY_TOKEN_FOR_TESTS",
        "ADMIN_IDS": "111,222",
        "DATABASE_URL": "sqlite+aiosqlite:///:memory:",
        "LOG_FILE": "",
        "IG_ACCESS_TOKEN": "ig-test-token",
        "IG_APP_SECRET": "ig-test-secret",
        "IG_VERIFY_TOKEN": "ig-verify",
        "MAX_BOT_TOKEN": "max-test-token",
        "MAX_WEBHOOK_SECRET": "max_test_secret",
    }
)


@pytest.fixture
async def db():
    """Чистая схема на каждый тест (in-memory SQLite, общий engine из core)."""
    from core.database.base import Base, engine

    # Регистрируем таблицы ядра и модулей
    import core.database.models  # noqa: F401
    import modules.payments.models  # noqa: F401
    import modules.scheduler.models  # noqa: F401
    import modules.shop.models  # noqa: F401
    import modules.support.models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # dispose закрывает соединение → in-memory БД исчезает; следующий тест начнёт с нуля
    await engine.dispose()


@pytest.fixture
async def session(db):
    """Сессия БД, закрывается после теста (commit вызывает сам тест)."""
    from core.database.base import SessionMaker

    async with SessionMaker() as s:
        yield s


# --------------------------------------------------------------------------- HTTP-моки


class FakeResponse:
    """Имитация aiohttp-ответа для `async with http.request(...) as resp`."""

    def __init__(self, data: Any, status: int = 200) -> None:
        self.data = data
        self.status = status

    async def json(self, content_type: str | None = None) -> Any:
        return self.data

    async def text(self) -> str:
        return self.data if isinstance(self.data, str) else json.dumps(self.data)

    async def __aenter__(self) -> "FakeResponse":
        return self

    async def __aexit__(self, *exc: object) -> bool:
        return False


class FakeHttpSession:
    """Подменяет aiohttp.ClientSession: запоминает запросы, отвечает заготовкой.

    responses — очередь (data, status) для последовательных запросов; когда она пуста,
    отвечает data/status по умолчанию.
    """

    def __init__(
        self,
        data: Any = None,
        status: int = 200,
        responses: list[tuple[Any, int]] | None = None,
    ) -> None:
        self.calls: list[tuple[str, str, dict[str, Any]]] = []
        self.data = data if data is not None else {}
        self.status = status
        self.responses = list(responses or [])

    def request(self, method: str, url: str, **kwargs: Any) -> FakeResponse:
        self.calls.append((method, url, kwargs))
        if self.responses:
            data, status = self.responses.pop(0)
            return FakeResponse(data, status)
        return FakeResponse(self.data, self.status)


@pytest.fixture
def fake_http() -> FakeHttpSession:
    return FakeHttpSession()


class FakeBot:
    """Минимальная замена aiogram.Bot для сервисов: пишет вызовы, может бросать ошибки."""

    def __init__(self, errors: dict[int, list[Exception]] | None = None) -> None:
        self.sent: list[tuple[int, str]] = []
        self.invoices: list[dict[str, Any]] = []
        # chat_id → очередь исключений, которые бросить на очередных вызовах
        self.errors = errors or {}

    async def send_message(self, chat_id: int, text: str, **_: Any) -> None:
        queue = self.errors.get(chat_id)
        if queue:
            raise queue.pop(0)
        self.sent.append((chat_id, text))

    async def send_invoice(self, **kwargs: Any) -> None:
        self.invoices.append(kwargs)
