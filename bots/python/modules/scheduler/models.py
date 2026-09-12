"""Модель отложенной публикации/рассылки."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from core.database.base import Base
from core.database.models import utcnow


class ScheduledPost(Base):
    __tablename__ = "scheduled_posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_by: Mapped[int] = mapped_column(BigInteger)  # external_id админа
    text: Mapped[str] = mapped_column(Text)

    # "all" — всем активным пользователям; иначе строковый chat_id
    target: Mapped[str] = mapped_column(String(64), default="all")

    run_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending/done/cancelled

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
