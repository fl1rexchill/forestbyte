"""Хендлеры Telegram-модулей (aiogram) через Dispatcher.feed_update — без сети и токена.

Bot получает FakeTelegramSession: все вызовы Bot API записываются и получают заготовленный
ответ. Роутеры aiogram — синглтоны модулей и подключаются к диспетчеру один раз, поэтому
диспетчеры собираются на модуль тестов, а БД и FSM сбрасываются на каждый тест.
"""
from __future__ import annotations

import sys
import time
from datetime import datetime
from typing import Any

import pytest
from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.client.session.base import BaseSession
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.methods import (
    AnswerCallbackQuery,
    AnswerPreCheckoutQuery,
    BanChatMember,
    EditMessageText,
    GetChatMember,
    GetMe,
    RestrictChatMember,
    SendInvoice,
    SendMessage,
    UnbanChatMember,
)
from aiogram.types import Chat, ChatMemberMember, ChatMemberOwner, Message, Update
from aiogram.types import User as TgUser
from sqlalchemy import select

from core.database.base import get_session
from core.database.models import Platform
from core.database.repositories import UserRepository

ADMIN = 111
GROUP = {"id": -100500, "type": "supergroup", "title": "G"}
BOT_USER = {"id": 42, "is_bot": True, "first_name": "Bot", "username": "test_bot"}


class FakeTelegramSession(BaseSession):
    """Сессия aiogram без сети: пишет вызовы, отвечает заготовками."""

    def __init__(self) -> None:
        super().__init__()
        self.calls: list[Any] = []

    async def make_request(self, bot: Bot, method: Any, timeout: int | None = None) -> Any:
        self.calls.append(method)
        if isinstance(method, (SendMessage, SendInvoice)):
            return Message(
                message_id=len(self.calls),
                date=datetime.now(),
                chat=Chat(id=method.chat_id, type="private"),
                text=getattr(method, "text", None),
            )
        if isinstance(method, GetMe):
            return TgUser(**BOT_USER)
        if isinstance(method, GetChatMember):
            user = TgUser(id=method.user_id, is_bot=False, first_name="x")
            if method.user_id == ADMIN:
                return ChatMemberOwner(user=user, is_anonymous=False)
            return ChatMemberMember(user=user)
        return True

    async def stream_content(self, *args: Any, **kwargs: Any):  # pragma: no cover
        raise NotImplementedError
        yield b""

    async def close(self) -> None:
        pass


class Harness:
    """Подаёт апдейты в диспетчер и даёт доступ к вызовам Bot API."""

    def __init__(self, dp: Dispatcher) -> None:
        self.dp = dp
        self.session = FakeTelegramSession()
        self.bot = Bot("123456:DUMMY", session=self.session, default=DefaultBotProperties(parse_mode="HTML"))
        self._seq = 0

    def calls(self, kind: type) -> list[Any]:
        return [m for m in self.session.calls if isinstance(m, kind)]

    def texts(self) -> list[str]:
        return [m.text for m in self.session.calls if isinstance(m, (SendMessage, EditMessageText))]

    @property
    def last(self) -> str:
        return self.texts()[-1]

    def _next(self) -> int:
        self._seq += 1
        return self._seq

    @staticmethod
    def _user(uid: int, name: str) -> dict[str, Any]:
        return {"id": uid, "is_bot": False, "first_name": name}

    async def _feed(self, data: dict[str, Any]) -> None:
        update = Update.model_validate({"update_id": self._next(), **data}, context={"bot": self.bot})
        await self.dp.feed_update(self.bot, update)

    async def message(
        self,
        uid: int,
        text: str | None,
        *,
        name: str = "User",
        chat: dict[str, Any] | None = None,
        entities: list[dict[str, Any]] | None = None,
        **extra: Any,
    ) -> None:
        msg: dict[str, Any] = {
            "message_id": self._next(),
            "date": int(time.time()),
            "chat": chat or {"id": uid, "type": "private"},
            "from": self._user(uid, name),
        }
        if text is not None:
            msg["text"] = text
            if text.startswith("/"):
                msg["entities"] = [{"type": "bot_command", "offset": 0, "length": len(text.split()[0])}]
        if entities:
            msg["entities"] = entities
        msg.update(extra)
        await self._feed({"message": msg})

    async def callback(self, uid: int, data: str, *, name: str = "User", chat: dict[str, Any] | None = None) -> None:
        await self._feed({"callback_query": {
            "id": str(self._next()),
            "from": self._user(uid, name),
            "chat_instance": "ci",
            "data": data,
            "message": {"message_id": 1, "date": int(time.time()),
                        "chat": chat or {"id": uid, "type": "private"}, "from": BOT_USER, "text": "..."},
        }})

    async def pre_checkout(self, uid: int, payload: str, amount: int) -> None:
        await self._feed({"pre_checkout_query": {
            "id": str(self._next()), "from": self._user(uid, "User"),
            "currency": "XTR", "total_amount": amount, "invoice_payload": payload,
        }})

    async def paid(self, uid: int, payload: str, amount: int) -> None:
        await self.message(uid, None, successful_payment={
            "currency": "XTR", "total_amount": amount, "invoice_payload": payload,
            "telegram_payment_charge_id": f"ch_{payload}", "provider_payment_charge_id": "",
        })


# --------------------------------------------------------------------------- фикстуры


@pytest.fixture(scope="module")
def full_dp() -> Dispatcher:
    from templates.telegram_full.main import build

    _, dp = build()
    return dp


@pytest.fixture(scope="module")
def group_dp() -> Dispatcher:
    from modules.captcha import router as captcha_router
    from modules.moderation import router as moderation_router
    from modules.users import UserMiddleware

    dp = Dispatcher(storage=MemoryStorage())
    dp.message.middleware(UserMiddleware())
    dp.callback_query.middleware(UserMiddleware())
    dp.include_router(captcha_router)
    dp.include_router(moderation_router)
    return dp


@pytest.fixture
async def tg(db, full_dp) -> Harness:
    full_dp.fsm.storage = MemoryStorage()
    return Harness(full_dp)


@pytest.fixture
async def grp(db, group_dp):
    group_dp.fsm.storage = MemoryStorage()
    captcha = sys.modules["modules.captcha.router"]  # имя router в пакете перекрывает подмодуль
    moderation = sys.modules["modules.moderation.router"]
    moderation._warns.clear()
    moderation._flood.clear()
    yield Harness(group_dp)
    for task in captcha._pending.values():
        task.cancel()
    captcha._pending.clear()


def _buttons(method: Any) -> list[str]:
    markup = method.reply_markup
    return [b.callback_data for row in markup.inline_keyboard for b in row]


# --------------------------------------------------------------------------- common


async def test_common_start_help_echo_cancel(tg: Harness):
    await tg.message(5001, "/start", name="<Tom>")
    assert tg.last == "👋 Привет, &lt;Tom&gt;! Я бот. Напиши /help, чтобы узнать возможности."
    await tg.message(5001, "/help")
    assert tg.last.startswith("📖 Доступные команды")
    await tg.message(5001, "a < b & <i>")
    assert tg.last == "a &lt; b &amp; &lt;i&gt;"
    await tg.message(5001, "жирный", entities=[{"type": "bold", "offset": 0, "length": 6}])
    assert tg.last == "<b>жирный</b>"
    await tg.message(5001, "/cancel")
    assert tg.last == "❌ Отменено."


async def test_banned_user_is_stopped(tg: Harness):
    await tg.message(5001, "hi")
    async with get_session() as s:
        await UserRepository(s).set_banned(Platform.TELEGRAM, 5001, True)
    await tg.message(5001, "hello")
    assert tg.last == "🚫 Вы заблокированы."


# --------------------------------------------------------------------------- admin + statistics


async def test_admin_panel_users_and_ban(tg: Harness):
    await tg.message(ADMIN, "/admin", name="Admin")
    assert "admin:stats" in _buttons(tg.calls(SendMessage)[-1])

    async with get_session() as s:
        await UserRepository(s).get_or_create(platform=Platform.MAX, external_id=77)
    await tg.callback(ADMIN, "admin:users")
    assert "Всего: <b>2</b> (telegram: 1, max: 1)" in tg.last
    assert "Активных в Telegram (не заблокировали бота): <b>1</b>" in tg.last

    await tg.message(ADMIN, "/ban 77 max")
    assert tg.last == "🚫 Забанен: <code>77</code> (max)"
    await tg.message(ADMIN, "/ban 77 vk")
    assert tg.last == "Платформа: telegram, instagram или max."
    await tg.message(ADMIN, "/unban abc")
    assert tg.last == "Использование: /ban &lt;user_id&gt; [telegram|instagram|max]"
    async with get_session() as s:
        assert (await UserRepository(s).get(Platform.MAX, 77)).is_banned is True

    # не админ: /admin проваливается до эхо
    await tg.message(5002, "/admin")
    assert tg.last == "/admin"


async def test_stats_command_and_button(tg: Harness):
    await tg.message(5001, "hi")
    async with get_session() as s:
        await UserRepository(s).get_or_create(platform=Platform.INSTAGRAM, external_id=900)
    await tg.message(ADMIN, "/stats", name="Admin")
    assert "👥 Всего пользователей: <b>3</b>" in tg.last
    assert "🌐 <b>По платформам:</b>" in tg.last and "• instagram: всего 1" in tg.last
    await tg.callback(ADMIN, "admin:stats")
    assert "📊 <b>Статистика</b>" in tg.last


# --------------------------------------------------------------------------- broadcast


async def test_broadcast_flow_and_cancel(tg: Harness):
    for uid in (5001, 5002):
        await tg.message(uid, "hi")

    await tg.message(ADMIN, "/broadcast", name="Admin")
    await tg.message(ADMIN, "/cancel", name="Admin")
    assert tg.last == "❌ Отменено."

    await tg.message(ADMIN, "/broadcast", name="Admin")
    await tg.message(ADMIN, "Скидка <50%>", name="Admin")
    assert tg.last == "Отправить рассылку 3 пользователям?\n\n<b>Превью:</b>\nСкидка &lt;50%&gt;"

    await tg.callback(ADMIN, "admin:bc_send")
    texts = tg.texts()
    assert "🚀 Рассылка запущена..." in texts
    assert texts.count("Скидка &lt;50%&gt;") == 3
    assert tg.last == "✅ Готово. Отправлено: 3, ошибок: 0."


# --------------------------------------------------------------------------- referral


async def test_referral_deep_link_and_ref(tg: Harness):
    await tg.message(ADMIN, "/start", name="Admin")
    await tg.message(5001, f"/start {ADMIN}", name="<Tom>")
    notice = [m for m in tg.calls(SendMessage) if m.chat_id == ADMIN and "присоединился" in m.text]
    assert notice and "&lt;Tom&gt;" in notice[0].text and "Всего приглашено: <b>1</b>" in notice[0].text
    await tg.message(ADMIN, "/ref", name="Admin")
    assert f"https://t.me/test_bot?start={ADMIN}" in tg.last
    assert "Приглашено: <b>1</b>" in tg.last


# --------------------------------------------------------------------------- support


async def test_support_ticket_reply_close(tg: Harness):
    from modules.support.models import Ticket, TicketMessage

    await tg.message(5001, "/support", name="<Eve>")
    await tg.message(5001, "/cancel", name="<Eve>")
    assert tg.last == "❌ Отменено."

    await tg.message(5001, "/support", name="<Eve>")
    await tg.message(5001, "Не работает <оплата>", name="<Eve>")
    # подтверждение уходит до уведомлений админам
    assert "✅ Обращение №1 принято. Мы ответим здесь же." in tg.texts()
    to_admins = [m for m in tg.calls(SendMessage) if m.text.startswith("🆕 <b>Тикет №1</b>")]
    assert [m.chat_id for m in to_admins] == [111, 222]
    assert "от &lt;Eve&gt;" in to_admins[0].text and "&lt;оплата&gt;" in to_admins[0].text

    await tg.message(ADMIN, "/tickets", name="Admin")
    assert "• №1" in tg.last
    await tg.message(ADMIN, "/reply 1 Уже чиним", name="Admin")
    assert any(m.chat_id == 5001 and "Уже чиним" in m.text for m in tg.calls(SendMessage))
    await tg.message(ADMIN, "/close 1", name="Admin")
    assert tg.last == "✅ Тикет №1 закрыт."

    async with get_session() as s:
        assert (await s.get(Ticket, 1)).status == "closed"
        texts = list(await s.scalars(select(TicketMessage.text).order_by(TicketMessage.id)))
    assert texts == ["Не работает <оплата>", "Уже чиним"]


# --------------------------------------------------------------------------- shop + payments


async def test_shop_cart_checkout_and_payment(tg: Harness):
    from modules.payments.models import Payment
    from modules.shop.models import Order, OrderItem

    await tg.message(ADMIN, "/addproduct <Кофе> | 10 | a&b", name="Admin")
    assert tg.last == "✅ Товар №1 «&lt;Кофе&gt;» добавлен (10 ⭐️)."
    await tg.message(5001, "/shop")
    assert tg.last == "<b>&lt;Кофе&gt;</b>\na&amp;b\n\nЦена: <b>10 ⭐️</b>"
    assert _buttons(tg.calls(SendMessage)[-1]) == ["shop:add:1"]

    await tg.callback(5001, "shop:add:1")
    await tg.callback(5001, "shop:add:1")
    await tg.message(5001, "/cart")
    assert "• &lt;Кофе&gt; × 2 = 20 ⭐️" in tg.last and "Итого: <b>20 ⭐️</b>" in tg.last

    await tg.callback(5001, "shop:checkout")
    invoice = tg.calls(SendInvoice)[-1]
    assert (invoice.payload, invoice.currency, invoice.prices[0].amount) == ("order:1", "XTR", 20)

    await tg.pre_checkout(5001, "order:1", 20)
    assert tg.calls(AnswerPreCheckoutQuery)[-1].ok is True
    await tg.paid(5001, "order:1", 20)
    assert "✅ Заказ №1 оплачён. Спасибо за покупку!" in tg.texts()

    async with get_session() as s:
        order = await s.get(Order, 1)
        items = list(await s.scalars(select(OrderItem)))
        payments = list(await s.scalars(select(Payment)))
    assert (order.status, order.total_stars) == ("paid", 20)
    assert [(i.title, i.qty) for i in items] == [("<Кофе>", 2)]
    assert [(p.amount, p.payload) for p in payments] == [(20, "order:1")]


async def test_donate_invoice_and_payment(tg: Harness):
    from modules.payments.models import Payment

    await tg.message(5001, "/donate")
    invoice = tg.calls(SendInvoice)[-1]
    assert (invoice.payload, invoice.currency, invoice.prices[0].amount) == ("donate:50", "XTR", 50)
    await tg.paid(5001, "donate:50", 50)
    assert tg.last == "✅ Оплата получена: 50 XTR. Спасибо!"
    async with get_session() as s:
        payment = await s.scalar(select(Payment))
    assert (payment.amount, payment.telegram_charge_id) == (50, "ch_donate:50")


# --------------------------------------------------------------------------- scheduler


async def test_scheduler_commands(tg: Harness):
    from modules.scheduler.models import ScheduledPost

    await tg.message(ADMIN, "/schedule 2099-01-01 10:00 | Анонс", name="Admin")
    assert tg.last == "✅ Запланировано №1 на 2099-01-01 10:00 UTC (получателей: все активные)."
    await tg.message(ADMIN, "/schedule 2000-01-01 10:00 | old", name="Admin")
    assert tg.last == "⏰ Время уже прошло. Укажите будущий момент (UTC)."
    await tg.message(ADMIN, "/schedule 2099-02-30 10:00 | bad", name="Admin")
    assert tg.last == "Не удалось разобрать дату. Пример: 2026-09-10 15:30"
    await tg.message(ADMIN, "/scheduled", name="Admin")
    assert "• №1 — 2099-01-01 10:00 UTC — Анонс…" in tg.last
    await tg.message(ADMIN, "/unschedule 1", name="Admin")
    assert tg.last == "✅ Задача №1 отменена."
    async with get_session() as s:
        assert (await s.get(ScheduledPost, 1)).status == "cancelled"


# --------------------------------------------------------------------------- captcha + moderation


async def test_captcha_restricts_and_releases(grp: Harness):
    newbie = {"id": 7001, "is_bot": False, "first_name": "<Bad>"}
    await grp.message(7001, None, name="<Bad>", chat=GROUP, new_chat_members=[newbie])
    restrict = grp.calls(RestrictChatMember)[-1]
    assert (restrict.user_id, restrict.permissions.can_send_messages) == (7001, False)
    assert grp.last == "👋 &lt;Bad&gt;, подтвердите, что вы не бот, за 60 сек."

    await grp.callback(7002, f"captcha:{GROUP['id']}:7001", chat=GROUP)
    assert grp.calls(AnswerCallbackQuery)[-1].show_alert is True

    await grp.callback(7001, f"captcha:{GROUP['id']}:7001", chat=GROUP)
    assert grp.calls(RestrictChatMember)[-1].permissions.can_send_messages is True
    assert grp.last == "✅ Проверка пройдена, добро пожаловать!"


async def test_moderation_warn_mute_kick_and_antiflood(grp: Harness):
    reply = {"reply_to_message": {"message_id": 1, "date": int(time.time()), "chat": GROUP,
                                  "from": {"id": 7001, "is_bot": False, "first_name": "<Bad>"},
                                  "text": "спам"}}

    await grp.message(7002, "/warn", chat=GROUP, **reply)
    assert grp.last == "⛔️ Только для админов чата."
    await grp.message(ADMIN, "/warn", name="Admin", chat=GROUP)
    assert grp.last == "Ответьте этой командой на сообщение нарушителя."

    for _ in range(2):
        await grp.message(ADMIN, "/warn", name="Admin", chat=GROUP, **reply)
    assert grp.last == "⚠️ Предупреждение 2/3 для &lt;Bad&gt;."
    await grp.message(ADMIN, "/warn", name="Admin", chat=GROUP, **reply)
    assert grp.last == "⚠️ &lt;Bad&gt;: 3/3 — мут на час."
    assert grp.calls(RestrictChatMember)[-1].user_id == 7001

    await grp.message(ADMIN, "/kick", name="Admin", chat=GROUP, **reply)
    assert grp.calls(BanChatMember) and grp.calls(UnbanChatMember)
    assert grp.last == "👢 &lt;Bad&gt; исключён."

    for i in range(6):
        await grp.message(7003, f"flood {i}", name="Spammer", chat=GROUP)
    assert grp.last == "🔇 Spammer заглушён на 5 мин за флуд."
