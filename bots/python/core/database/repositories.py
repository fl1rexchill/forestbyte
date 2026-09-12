"""Репозитории — весь доступ к данным через них (не пишем SQL в хендлерах).

Каждый репозиторий принимает готовую AsyncSession.

Использование:
    async with get_session() as session:
        users = UserRepository(session)
        user = await users.get_or_create(platform="telegram", external_id=123, ...)
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select, update

from core.database.models import (
    BroadcastJob,
    MessageLog,
    Platform,
    Setting,
    User,
    utcnow,
)
from sqlalchemy.ext.asyncio import AsyncSession


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, platform: str, external_id: int) -> User | None:
        stmt = select(User).where(
            User.platform == platform, User.external_id == external_id
        )
        return await self.session.scalar(stmt)

    async def get_or_create(
        self,
        *,
        platform: str,
        external_id: int,
        username: str | None = None,
        first_name: str | None = None,
        last_name: str | None = None,
        language_code: str | None = None,
        is_admin: bool = False,
    ) -> tuple[User, bool]:
        """Возвращает (user, created). Обновляет профиль, если пользователь уже есть."""
        user = await self.get(platform, external_id)
        if user is None:
            user = User(
                platform=platform,
                external_id=external_id,
                username=username,
                first_name=first_name,
                last_name=last_name,
                language_code=language_code,
                is_admin=is_admin,
            )
            self.session.add(user)
            await self.session.flush()
            return user, True

        # Обновляем изменяемые поля профиля
        user.username = username
        user.first_name = first_name
        user.last_name = last_name
        if language_code:
            user.language_code = language_code
        if is_admin:
            user.is_admin = True
        user.last_seen_at = utcnow()
        user.is_active = True  # раз пишет — значит не заблокировал
        return user, False

    async def set_banned(self, platform: str, external_id: int, banned: bool) -> bool:
        user = await self.get(platform, external_id)
        if not user:
            return False
        user.is_banned = banned
        return True

    async def mark_inactive(self, user_id: int) -> None:
        """Пометить, что пользователь заблокировал бота (для рассылок)."""
        await self.session.execute(
            update(User).where(User.id == user_id).values(is_active=False)
        )

    async def all_active_ids(self, platform: str) -> list[int]:
        """external_id всех активных, не забаненных — цель рассылки."""
        stmt = select(User.external_id).where(
            User.platform == platform,
            User.is_active.is_(True),
            User.is_banned.is_(False),
        )
        return list(await self.session.scalars(stmt))

    async def count(self, platform: str | None = None) -> int:
        stmt = select(func.count(User.id))
        if platform:
            stmt = stmt.where(User.platform == platform)
        return await self.session.scalar(stmt) or 0

    async def set_referrer(self, user: User, referrer_external_id: int) -> bool:
        """Проставить пригласившего (только если ещё не задан и это не сам юзер)."""
        if user.referred_by is not None or user.external_id == referrer_external_id:
            return False
        user.referred_by = referrer_external_id
        return True

    async def count_referrals(self, platform: str, referrer_external_id: int) -> int:
        stmt = select(func.count(User.id)).where(
            User.platform == platform, User.referred_by == referrer_external_id
        )
        return await self.session.scalar(stmt) or 0


class MessageRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def log(
        self,
        *,
        user_id: int,
        platform: str,
        text: str | None,
        content_type: str = "text",
    ) -> None:
        self.session.add(
            MessageLog(
                user_id=user_id,
                platform=platform,
                text=text,
                content_type=content_type,
            )
        )


class StatsRepository:
    """Аналитические выборки для модуля statistics."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def total_users(self, platform: str) -> int:
        return await UserRepository(self.session).count(platform)

    async def new_users_since(self, platform: str, since: datetime) -> int:
        stmt = select(func.count(User.id)).where(
            User.platform == platform, User.created_at >= since
        )
        return await self.session.scalar(stmt) or 0

    async def active_users_since(self, platform: str, since: datetime) -> int:
        """Уникальные пользователи, писавшие боту с момента `since`."""
        stmt = select(func.count(func.distinct(MessageLog.user_id))).where(
            MessageLog.platform == platform, MessageLog.created_at >= since
        )
        return await self.session.scalar(stmt) or 0

    async def messages_since(self, platform: str, since: datetime) -> int:
        stmt = select(func.count(MessageLog.id)).where(
            MessageLog.platform == platform, MessageLog.created_at >= since
        )
        return await self.session.scalar(stmt) or 0

    async def summary(self, platform: str) -> dict[str, int]:
        """Сводка: total / new & active за день, неделю, месяц."""
        now = datetime.now(timezone.utc)
        day = now - timedelta(days=1)
        week = now - timedelta(days=7)
        month = now - timedelta(days=30)
        return {
            "total": await self.total_users(platform),
            "new_day": await self.new_users_since(platform, day),
            "new_week": await self.new_users_since(platform, week),
            "new_month": await self.new_users_since(platform, month),
            "active_day": await self.active_users_since(platform, day),
            "active_week": await self.active_users_since(platform, week),
            "active_month": await self.active_users_since(platform, month),
            "messages_day": await self.messages_since(platform, day),
        }


class BroadcastRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, *, created_by: int, platform: str, text: str, total: int) -> BroadcastJob:
        job = BroadcastJob(
            created_by=created_by, platform=platform, text=text, total=total, status="running"
        )
        self.session.add(job)
        await self.session.flush()
        return job

    async def get(self, job_id: int) -> BroadcastJob | None:
        return await self.session.get(BroadcastJob, job_id)

    async def finish(self, job_id: int, sent: int, failed: int, status: str = "done") -> None:
        await self.session.execute(
            update(BroadcastJob)
            .where(BroadcastJob.id == job_id)
            .values(sent=sent, failed=failed, status=status, finished_at=utcnow())
        )


class SettingRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, key: str, default: str | None = None) -> str | None:
        row = await self.session.get(Setting, key)
        return row.value if row else default

    async def set(self, key: str, value: str) -> None:
        row = await self.session.get(Setting, key)
        if row:
            row.value = value
        else:
            self.session.add(Setting(key=key, value=value))
