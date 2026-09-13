"""Репозитории core/database/repositories.py на SQLite in-memory."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from core.database.models import MessageLog, Platform, User
from core.database.repositories import (
    BroadcastRepository,
    MessageRepository,
    SettingRepository,
    StatsRepository,
    UserRepository,
)

TG = Platform.TELEGRAM


async def test_get_or_create_creates_then_updates(session):
    users = UserRepository(session)
    user, created = await users.get_or_create(
        platform=TG, external_id=1, username="old", first_name="A", language_code="ru"
    )
    assert created is True and user.id is not None

    user2, created2 = await users.get_or_create(
        platform=TG, external_id=1, username="new", first_name="B", language_code=None, is_admin=True
    )
    assert created2 is False and user2.id == user.id
    assert (user2.username, user2.first_name) == ("new", "B")
    assert user2.language_code == "ru"  # None не затирает язык
    assert user2.is_admin is True


async def test_get_or_create_reactivates_user(session):
    users = UserRepository(session)
    user, _ = await users.get_or_create(platform=TG, external_id=5)
    await users.mark_inactive(user.id)
    await session.commit()
    session.expire_all()
    assert (await users.get(TG, 5)).is_active is False

    user, _ = await users.get_or_create(platform=TG, external_id=5)
    assert user.is_active is True


async def test_same_external_id_on_different_platforms(session):
    users = UserRepository(session)
    await users.get_or_create(platform=TG, external_id=7)
    _, created = await users.get_or_create(platform=Platform.MAX, external_id=7)
    assert created is True
    assert await users.count() == 2
    assert await users.count(TG) == 1


async def test_set_banned_and_active_ids(session):
    users = UserRepository(session)
    for ext in (1, 2, 3):
        await users.get_or_create(platform=TG, external_id=ext)
    await users.get_or_create(platform=Platform.INSTAGRAM, external_id=4)

    assert await users.set_banned(TG, 2, True) is True
    assert await users.set_banned(TG, 999, True) is False
    u3 = await users.get(TG, 3)
    await users.mark_inactive(u3.id)
    await session.flush()
    session.expire_all()

    assert sorted(await users.all_active_ids(TG)) == [1]


async def test_referrals(session):
    users = UserRepository(session)
    inviter, _ = await users.get_or_create(platform=TG, external_id=10)
    guest, _ = await users.get_or_create(platform=TG, external_id=11)

    assert await users.set_referrer(inviter, 10) is False  # сам себя
    assert await users.set_referrer(guest, 10) is True
    assert await users.set_referrer(guest, 12) is False  # уже задан
    await session.flush()
    assert await users.count_referrals(TG, 10) == 1
    assert await users.count_referrals(TG, 12) == 0


async def test_message_log_and_stats(session):
    users = UserRepository(session)
    a, _ = await users.get_or_create(platform=TG, external_id=1)
    b, _ = await users.get_or_create(platform=TG, external_id=2)
    old, _ = await users.get_or_create(platform=TG, external_id=3)
    old.created_at = datetime.now(timezone.utc) - timedelta(days=40)

    msgs = MessageRepository(session)
    await msgs.log(user_id=a.id, platform=TG, text="hi")
    await msgs.log(user_id=a.id, platform=TG, text=None, content_type="photo")
    await msgs.log(user_id=b.id, platform=TG, text="yo")
    # старое сообщение — вне окна месяца
    session.add(
        MessageLog(
            user_id=old.id,
            platform=TG,
            text="old",
            created_at=datetime.now(timezone.utc) - timedelta(days=40),
        )
    )
    await session.flush()

    summary = await StatsRepository(session).summary(TG)
    assert summary == {
        "total": 3,
        "new_day": 2,
        "new_week": 2,
        "new_month": 2,
        "active_day": 2,
        "active_week": 2,
        "active_month": 2,
        "messages_day": 3,
    }
    assert (await StatsRepository(session).summary(Platform.MAX))["total"] == 0


async def test_broadcast_repository(session):
    repo = BroadcastRepository(session)
    job = await repo.create(created_by=111, platform=TG, text="hello", total=5)
    job_id = job.id
    assert job_id is not None and job.status == "running"

    await repo.finish(job_id, sent=4, failed=1)
    await session.commit()
    session.expire_all()

    job = await repo.get(job_id)
    assert (job.sent, job.failed, job.status) == (4, 1, "done")
    assert job.finished_at is not None
    assert await repo.get(999) is None


async def test_setting_repository(session):
    repo = SettingRepository(session)
    assert await repo.get("welcome") is None
    assert await repo.get("welcome", "default") == "default"

    await repo.set("welcome", "hi")
    await session.flush()
    assert await repo.get("welcome") == "hi"

    await repo.set("welcome", "hello")
    await session.flush()
    assert await repo.get("welcome") == "hello"


async def test_user_full_name(session):
    user, _ = await UserRepository(session).get_or_create(
        platform=TG, external_id=77, first_name="Иван", last_name="Петров"
    )
    assert user.full_name == "Иван Петров"
    assert User(external_id=5, username="nick").full_name == "nick"
    assert User(external_id=5).full_name == "id5"
