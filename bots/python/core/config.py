"""Конфигурация приложения.

Загружает настройки из переменных окружения / файла .env через pydantic-settings.
Единая точка правды для всех модулей и платформ.

Использование:
    from core.config import settings
    settings.bot_token
    settings.admin_ids  # -> list[int]
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# Корень стека python-ботов (папка, где лежит .env)
BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Все настройки бота. Значения берутся из .env / окружения."""

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- Telegram ---
    bot_token: str = Field(..., alias="BOT_TOKEN")

    # --- Доступ ---
    # NoDecode отключает JSON-парсинг env-значения — строку "1,2,3" разберёт валидатор ниже
    admin_ids: Annotated[list[int], NoDecode] = Field(
        default_factory=list, alias="ADMIN_IDS"
    )

    # --- База данных ---
    database_url: str = Field(
        default="sqlite+aiosqlite:///data/bot.sqlite3", alias="DATABASE_URL"
    )

    # --- Логи ---
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    log_file: str | None = Field(default="logs/bot.log", alias="LOG_FILE")

    # --- Локализация ---
    default_locale: str = Field(default="ru", alias="DEFAULT_LOCALE")

    # --- Рассылки ---
    broadcast_rate: int = Field(default=25, alias="BROADCAST_RATE")

    # --- Instagram (опционально) ---
    ig_access_token: str | None = Field(default=None, alias="IG_ACCESS_TOKEN")
    ig_app_secret: str | None = Field(default=None, alias="IG_APP_SECRET")
    ig_verify_token: str | None = Field(default=None, alias="IG_VERIFY_TOKEN")

    # --- MAX (опционально) ---
    max_bot_token: str | None = Field(default=None, alias="MAX_BOT_TOKEN")

    @field_validator("admin_ids", mode="before")
    @classmethod
    def _parse_admin_ids(cls, value: object) -> list[int]:
        """Разбирает "123,456" или список в list[int]."""
        if value is None or value == "":
            return []
        if isinstance(value, str):
            return [int(x.strip()) for x in value.split(",") if x.strip()]
        if isinstance(value, (list, tuple)):
            return [int(x) for x in value]
        return [int(value)]  # type: ignore[arg-type]

    def is_admin(self, user_id: int) -> bool:
        """Быстрая проверка: является ли пользователь админом из конфига."""
        return user_id in self.admin_ids

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    """Кэшированный синглтон настроек."""
    return Settings()  # type: ignore[call-arg]


# Готовый к импорту экземпляр
settings = get_settings()
