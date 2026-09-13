"""Окружение Alembic: async-движок и metadata из core.database.

- движок — тот же `engine` из core/database/base.py (DATABASE_URL из .env);
- metadata — Base.metadata ядра + модели модулей (payments, shop, support, scheduler);
- для SQLite включён batch-режим (ALTER TABLE в SQLite ограничен).

Новая таблица в модуле → добавь импорт её models.py в блок ниже.
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from alembic import context
from sqlalchemy.engine import Connection

# Корень стека (bots/python) в путь — чтобы работало и при запуске не из этой папки
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.config import settings  # noqa: E402
from core.database.base import Base, engine  # noqa: E402

# Регистрируем все таблицы в Base.metadata
import core.database.models  # noqa: E402,F401
import modules.payments.models  # noqa: E402,F401
import modules.scheduler.models  # noqa: E402,F401
import modules.shop.models  # noqa: E402,F401
import modules.support.models  # noqa: E402,F401

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """`alembic upgrade head --sql` — сгенерировать SQL без подключения к БД."""
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=settings.is_sqlite,
    )
    with context.begin_transaction():
        context.run_migrations()


def _run_sync(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        render_as_batch=settings.is_sqlite,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Обычный режим: подключаемся async-движком и гоняем миграции в run_sync."""
    async with engine.connect() as connection:
        await connection.run_sync(_run_sync)
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
