"""Сервисы модулей: broadcast, scheduler, statistics, payments (без Telegram и сети)."""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

from aiogram.exceptions import TelegramForbiddenError, TelegramRetryAfter
from aiogram.methods import SendMessage
from sqlalchemy import select

from core.database.base import get_session
from core.database.models import BroadcastJob, Platform
from core.database.repositories import MessageRepository, UserRepository
from tests.conftest import FakeBot

TG = Platform.TELEGRAM


async def _make_users(*external_ids: int, platform: str = TG) -> None:
    async with get_session() as s:
        repo = UserRepository(s)
        for ext in external_ids:
            await repo.get_or_create(platform=platform, external_id=ext)


# --------------------------------------------------------------------------- broadcast


async def test_broadcast_counts_and_marks_blocked(db):
    from modules.broadcast.service import run_broadcast

    await _make_users(1, 2, 3)
    await _make_users(9, platform=Platform.INSTAGRAM)  # другая платформа — не получатель
    method = SendMessage(chat_id=0, text="x")
    bot = FakeBot(
        errors={
            2: [TelegramForbiddenError(method=method, message="bot was blocked")],
            3: [TelegramRetryAfter(method=method, message="flood", retry_after=0)],
        }
    )

    sent, failed = await run_broadcast(bot, admin_id=111, text="news")

    assert (sent, failed) == (2, 1)
    assert sorted(chat for chat, _ in bot.sent) == [1, 3]  # 3 — после повтора
    async with get_session() as s:
        assert sorted(await UserRepository(s).all_active_ids(TG)) == [1, 3]
        job = await s.scalar(select(BroadcastJob))
        assert (job.total, job.sent, job.failed, job.status) == (3, 2, 1, "done")
        assert job.created_by == 111 and job.text == "news"


async def test_broadcast_without_recipients(db):
    from modules.broadcast.service import run_broadcast

    bot = FakeBot()
    assert await run_broadcast(bot, admin_id=1, text="x") == (0, 0)
    assert bot.sent == []


# --------------------------------------------------------------------------- scheduler


async def test_scheduler_delivers_due_posts(db, monkeypatch):
    from modules.scheduler import service
    from modules.scheduler.models import ScheduledPost

    await _make_users(1, 2)
    now = datetime.now(timezone.utc)
    async with get_session() as s:
        s.add_all(
            [
                ScheduledPost(created_by=111, text="to all", target="all", run_at=now - timedelta(minutes=1)),
                ScheduledPost(created_by=111, text="to chat", target="-100500", run_at=now - timedelta(seconds=1)),
                ScheduledPost(created_by=111, text="later", target="all", run_at=now + timedelta(hours=1)),
            ]
        )

    monkeypatch.setattr(service, "CHECK_INTERVAL", 0.01)
    bot = FakeBot()
    task = asyncio.create_task(service.scheduler_loop(bot))
    for _ in range(200):
        await asyncio.sleep(0.01)
        if len(bot.sent) >= 3:
            break
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

    assert sorted(bot.sent) == [(-100500, "to chat"), (1, "to all"), (2, "to all")]
    async with get_session() as s:
        statuses = {p.text: p.status for p in await s.scalars(select(ScheduledPost))}
    assert statuses == {"to all": "done", "to chat": "done", "later": "pending"}


async def test_scheduler_deliver_ignores_send_errors(db):
    from modules.scheduler.models import ScheduledPost
    from modules.scheduler.service import _deliver

    method = SendMessage(chat_id=0, text="x")
    bot = FakeBot(errors={5: [TelegramForbiddenError(method=method, message="blocked")]})
    post = ScheduledPost(id=1, created_by=1, text="t", target="5", run_at=datetime.now(timezone.utc))
    await _deliver(bot, post)  # не должно бросить
    assert bot.sent == []


# --------------------------------------------------------------------------- statistics


async def test_build_stats_text(db):
    from modules.statistics.service import build_stats_text

    await _make_users(1, 2)
    async with get_session() as s:
        user = await UserRepository(s).get(TG, 1)
        await MessageRepository(s).log(user_id=user.id, platform=TG, text="hi")

    async with get_session() as s:
        text = await build_stats_text(s, TG, locale="ru")
    assert "Всего пользователей: <b>2</b>" in text
    assert "за день (DAU): 1" in text
    assert "Сообщений за сутки: <b>1</b>" in text


# --------------------------------------------------------------------------- payments


async def test_send_stars_invoice():
    from modules.payments.service import send_stars_invoice

    bot = FakeBot()
    await send_stars_invoice(bot, 42, title="Донат", description="Спасибо", payload="donate", stars=50)
    inv = bot.invoices[0]
    assert inv["chat_id"] == 42 and inv["currency"] == "XTR" and inv["provider_token"] == ""
    assert inv["payload"] == "donate"
    assert [(p.label, p.amount) for p in inv["prices"]] == [("Донат", 50)]


async def test_send_provider_invoice():
    from modules.payments.service import send_provider_invoice

    bot = FakeBot()
    await send_provider_invoice(
        bot, 42, title="Товар", description="d", payload="order:1",
        provider_token="prov", currency="RUB", amount_minor=19900,
    )
    inv = bot.invoices[0]
    assert (inv["currency"], inv["provider_token"]) == ("RUB", "prov")
    assert [(p.label, p.amount) for p in inv["prices"]] == [("Товар", 19900)]


async def test_payment_model_persists(db):
    from modules.payments.models import Payment

    async with get_session() as s:
        user, _ = await UserRepository(s).get_or_create(platform=TG, external_id=1)
        s.add(Payment(user_id=user.id, amount=50, payload="donate", telegram_charge_id="ch_1"))
    async with get_session() as s:
        p = await s.scalar(select(Payment))
    assert (p.amount, p.currency, p.status) == (50, "XTR", "paid")


# --------------------------------------------------------------------------- пункт 6 и 20


async def test_scheduler_claim_is_exclusive(db):
    """Задачу забирает ровно один «процесс»: повторный и параллельный claim её не видят."""
    from modules.scheduler.models import ScheduledPost
    from modules.scheduler.service import claim_due_posts

    now = datetime.now(timezone.utc)
    async with get_session() as s:
        s.add_all(
            [
                ScheduledPost(created_by=1, text=f"p{i}", target="all", run_at=now - timedelta(minutes=1))
                for i in range(3)
            ]
            + [ScheduledPost(created_by=1, text="later", target="all", run_at=now + timedelta(hours=1))]
        )

    first, second = await asyncio.gather(claim_due_posts(), claim_due_posts())
    claimed = [p.text for p in first + second]
    assert sorted(claimed) == ["p0", "p1", "p2"]  # без дублей
    assert all(p.status == "done" for p in first + second)
    assert await claim_due_posts() == []


async def test_stats_all_platforms_with_breakdown(db):
    from modules.statistics.service import build_stats_text

    await _make_users(1, 2)
    await _make_users(10, platform=Platform.MAX)
    async with get_session() as s:
        text = await build_stats_text(s, locale="ru")
        telegram_only = await build_stats_text(s, TG, locale="ru")
    assert "Всего пользователей: <b>3</b>" in text
    assert "🌐 <b>По платформам:</b>" in text
    assert "• telegram: всего 2, DAU 0" in text and "• max: всего 1, DAU 0" in text
    assert "Всего пользователей: <b>2</b>" in telegram_only and "По платформам" not in telegram_only


async def test_stats_single_platform_has_no_breakdown(db):
    from modules.statistics.service import build_stats_text

    await _make_users(1)
    async with get_session() as s:
        text = await build_stats_text(s, locale="ru")
    assert "Всего пользователей: <b>1</b>" in text and "По платформам" not in text
