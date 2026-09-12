"""ORM-модели общего ядра.

Общие для всех платформ. Поле `platform` различает источник (telegram/instagram/max),
`external_id` — ID пользователя в этой платформе.
"""
from __future__ import annotations

from datetime import datetime, timezone
from enum import StrEnum

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database.base import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Platform(StrEnum):
    TELEGRAM = "telegram"
    INSTAGRAM = "instagram"
    MAX = "max"


class User(Base):
    """Пользователь бота (любой платформы)."""

    __tablename__ = "users"
    __table_args__ = (
        Index("ix_users_platform_external", "platform", "external_id", unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    platform: Mapped[str] = mapped_column(String(20), default=Platform.TELEGRAM)
    external_id: Mapped[int] = mapped_column(BigInteger, index=True)

    username: Mapped[str | None] = mapped_column(String(255), default=None)
    first_name: Mapped[str | None] = mapped_column(String(255), default=None)
    last_name: Mapped[str | None] = mapped_column(String(255), default=None)
    language_code: Mapped[str | None] = mapped_column(String(10), default=None)

    # external_id пригласившего (реферальная система, модуль referral)
    referred_by: Mapped[int | None] = mapped_column(BigInteger, default=None)

    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_banned: Mapped[bool] = mapped_column(Boolean, default=False)
    # активен = не заблокировал бота (для рассылок)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    messages: Mapped[list["MessageLog"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    @property
    def full_name(self) -> str:
        parts = [p for p in (self.first_name, self.last_name) if p]
        return " ".join(parts) or (self.username or f"id{self.external_id}")


class MessageLog(Base):
    """Лог входящих сообщений — основа статистики."""

    __tablename__ = "message_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    platform: Mapped[str] = mapped_column(String(20), default=Platform.TELEGRAM)

    text: Mapped[str | None] = mapped_column(Text, default=None)
    content_type: Mapped[str] = mapped_column(String(30), default="text")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )

    user: Mapped["User"] = relationship(back_populates="messages")


class BroadcastJob(Base):
    """Задача массовой рассылки и её результат."""

    __tablename__ = "broadcast_jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_by: Mapped[int] = mapped_column(BigInteger)  # external_id админа
    platform: Mapped[str] = mapped_column(String(20), default=Platform.TELEGRAM)

    text: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending/running/done/cancelled

    total: Mapped[int] = mapped_column(default=0)
    sent: Mapped[int] = mapped_column(default=0)
    failed: Mapped[int] = mapped_column(default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )


class Setting(Base):
    """Пары ключ-значение для настроек бота, изменяемых на лету."""

    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str | None] = mapped_column(Text, default=None)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )
