"""Модель платежа (общая для Stars и провайдерских оплат)."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from core.database.base import Base
from core.database.models import utcnow


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Для валют вроде RUB/USD amount хранится в минимальных единицах (копейки/центы).
    # Для Telegram Stars (XTR) amount = число звёзд.
    amount: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(10), default="XTR")

    payload: Mapped[str] = mapped_column(String(255), default="")
    telegram_charge_id: Mapped[str | None] = mapped_column(String(255), default=None)
    status: Mapped[str] = mapped_column(String(20), default="paid")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
