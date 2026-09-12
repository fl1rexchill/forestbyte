"""Слой доступа к БД: async-движок SQLAlchemy 2.0.

Работает и с SQLite (dev), и с PostgreSQL (prod) — определяется по DATABASE_URL.
Переключение: поменяй DATABASE_URL в .env, код менять не нужно.

Использование:
    from core.database.base import init_db, get_session, dispose_db

    await init_db()                      # при старте бота (создаёт таблицы)
    async with get_session() as session: # в хендлерах
        ...
    await dispose_db()                   # при остановке
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from core.config import settings
from core.logger import get_logger

log = get_logger(__name__)


class Base(DeclarativeBase):
    """Базовый класс для всех ORM-моделей."""


def _make_engine():
    """Создаёт async-движок с учётом типа БД."""
    kwargs: dict = {"echo": False, "pool_pre_ping": True}

    if settings.is_sqlite:
        # Для SQLite гарантируем, что папка под файл БД существует
        # (URL вида sqlite+aiosqlite:///data/bot.sqlite3)
        db_path = settings.database_url.split(":///")[-1]
        if db_path and db_path != ":memory:":
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        # pool_pre_ping не нужен SQLite
        kwargs.pop("pool_pre_ping", None)

    return create_async_engine(settings.database_url, **kwargs)


engine = _make_engine()
SessionMaker = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def init_db() -> None:
    """Создаёт все таблицы (для простых проектов; в проде — Alembic)."""
    # Импортируем модели, чтобы они зарегистрировались в metadata
    from core.database import models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    log.info("Database initialized (%s)", "sqlite" if settings.is_sqlite else "postgres")


async def dispose_db() -> None:
    """Закрывает пул соединений при остановке приложения."""
    await engine.dispose()
    log.info("Database connections disposed")


@asynccontextmanager
async def get_session() -> AsyncIterator[AsyncSession]:
    """Контекстный менеджер сессии с авто-commit/rollback.

    async with get_session() as session:
        session.add(obj)
        # commit произойдёт автоматически при выходе без ошибки
    """
    session = SessionMaker()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()
