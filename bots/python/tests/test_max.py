"""platforms/max: клиент (замоканный HTTP), загрузка файлов, парсинг Update, вебхук, polling.

Эндпоинт вебхука проверяется напрямую (handle_post) — без HTTP-сервера и сокетов.
"""
from __future__ import annotations

import asyncio
import json

import aiohttp
import pytest

from core.database.base import get_session
from core.database.repositories import StatsRepository, UserRepository
from platforms.max import (
    MaxClient,
    MaxUploadError,
    build_app,
    build_webhook,
    callback_button,
    link_button,
    parse_update,
    parse_updates,
    run_polling,
)
from platforms.max.client import BASE_URL
from platforms.max.webhook import WEBHOOK_KEY, MaxWebhook, verify_secret
from tests.conftest import FakeHttpSession

SECRET = "max_test_secret"  # из conftest


def msg_update(mid: str, text: str | None, uid: int = 500, is_bot: bool = False, attachments=None) -> dict:
    return {
        "update_type": "message_created",
        "timestamp": 1,
        "user_locale": "ru",
        "message": {
            "sender": {"user_id": uid, "first_name": "Иван", "username": "ivan", "is_bot": is_bot},
            "recipient": {"chat_id": 9001, "chat_type": "dialog", "user_id": None},
            "timestamp": 1,
            "body": {"mid": mid, "seq": 1, "text": text, "attachments": attachments},
        },
    }


CALLBACK = {
    "update_type": "message_callback",
    "timestamp": 2,
    "callback": {"timestamp": 2, "callback_id": "cb1", "payload": "help",
                 "user": {"user_id": 500, "first_name": "Иван", "username": "ivan", "is_bot": False}},
    "message": {"recipient": {"chat_id": 9001, "chat_type": "dialog"}, "timestamp": 1,
                "body": {"mid": "m0", "seq": 0, "text": "menu"}},
}
BOT_STARTED = {
    "update_type": "bot_started",
    "timestamp": 3,
    "chat_id": 9001,
    "payload": "ref42",
    "user": {"user_id": 600, "first_name": "Пётр", "is_bot": False},
}
CHANNEL_POST = {
    "update_type": "message_created",
    "timestamp": 4,
    "message": {"recipient": {"chat_id": -5, "chat_type": "channel"}, "timestamp": 4,
                "body": {"mid": "p1", "seq": 1, "text": "post"}},
}


def _raw(body: dict) -> bytes:
    return json.dumps(body).encode()


# --------------------------------------------------------------------------- client


async def test_send_text_request_shape(fake_http: FakeHttpSession):
    await MaxClient(session=fake_http).send_text(9001, "hi")
    method, url, kw = fake_http.calls[0]
    assert (method, url) == ("POST", f"{BASE_URL}/messages")
    assert BASE_URL == "https://platform-api2.max.ru"
    assert kw["headers"] == {"Authorization": "max-test-token"}  # без "Bearer"
    assert kw["params"] == {"chat_id": 9001}
    assert kw["json"] == {"text": "hi"}


async def test_send_keyboard_to_user(fake_http: FakeHttpSession):
    buttons = [[callback_button("Да", "yes"), link_button("Сайт", "https://x")]]
    await MaxClient(session=fake_http).send_keyboard(None, "Выбор", buttons, user_id=7)
    _, _, kw = fake_http.calls[0]
    assert kw["params"] == {"user_id": 7}
    assert kw["json"]["attachments"] == [{
        "type": "inline_keyboard",
        "payload": {"buttons": [[
            {"type": "callback", "text": "Да", "payload": "yes"},
            {"type": "link", "text": "Сайт", "url": "https://x"},
        ]]},
    }]


async def test_send_requires_recipient(fake_http: FakeHttpSession):
    with pytest.raises(ValueError):
        await MaxClient(session=fake_http).send_text(None, "x")


async def test_answer_callback_and_updates(fake_http: FakeHttpSession):
    client = MaxClient(session=fake_http)
    await client.answer_callback("cb1", notification="ok")
    await client.get_updates(123, timeout=10, types=["message_created", "message_callback"])
    _, url, kw = fake_http.calls[0]
    assert url.endswith("/answers") and kw["params"] == {"callback_id": "cb1"}
    assert kw["json"] == {"notification": "ok"}
    method, url, kw = fake_http.calls[1]
    assert method == "GET" and url.endswith("/updates")
    assert kw["params"] == {"marker": 123, "timeout": 10, "limit": 100,
                            "types": "message_created,message_callback"}
    assert kw["timeout"].total == 25  # HTTP-таймаут больше long-poll таймаута


async def test_subscriptions(fake_http: FakeHttpSession):
    client = MaxClient(session=fake_http)
    await client.subscribe("https://h/webhook", update_types=["message_created"], secret=SECRET)
    await client.unsubscribe("https://h/webhook")
    assert fake_http.calls[0][2]["json"] == {
        "url": "https://h/webhook", "update_types": ["message_created"], "secret": SECRET,
    }
    assert fake_http.calls[1][0] == "DELETE"
    assert fake_http.calls[1][2]["params"] == {"url": "https://h/webhook"}


# --------------------------------------------------------------------------- загрузка файлов

UPLOAD_URL = "https://iu.oneme.ru/upload.do?id=1"


async def test_upload_image_payload_is_upload_response():
    http = FakeHttpSession(responses=[
        ({"url": UPLOAD_URL}, 200),
        ({"photos": {"p1": {"token": "IMG"}}}, 200),
    ])
    attachment = await MaxClient(session=http).upload("image", b"PNG", filename="a.png")
    assert attachment == {"type": "image", "payload": {"photos": {"p1": {"token": "IMG"}}}}

    method, url, kw = http.calls[0]
    assert (method, url, kw["params"]) == ("POST", f"{BASE_URL}/uploads", {"type": "image"})
    method, url, kw = http.calls[1]
    assert (method, url) == ("POST", UPLOAD_URL)
    assert isinstance(kw["data"], aiohttp.FormData)
    assert "headers" not in kw  # токен бота на хост загрузки не уходит


async def test_upload_video_uses_token_from_first_step(tmp_path):
    file = tmp_path / "clip.mp4"
    file.write_bytes(b"MP4")
    http = FakeHttpSession(responses=[
        ({"url": "https://omub.okcdn.ru/u", "token": "VID"}, 200),
        ("<retval>1</retval>", 200),  # хост видео может ответить не JSON
    ])
    attachment = await MaxClient(session=http).upload("video", file)
    assert attachment == {"type": "video", "payload": {"token": "VID"}}


async def test_upload_errors():
    with pytest.raises(ValueError):
        await MaxClient(session=FakeHttpSession()).upload("photo", b"x")
    with pytest.raises(MaxUploadError):  # нет url
        await MaxClient(session=FakeHttpSession(data={"code": "err"})).upload("file", b"x")
    http = FakeHttpSession(responses=[({"url": UPLOAD_URL}, 200), ({"error": "big"}, 413)])
    with pytest.raises(MaxUploadError):
        await MaxClient(session=http).upload("file", b"x")
    http = FakeHttpSession(responses=[({"url": UPLOAD_URL}, 200), ("ok", 200)])
    with pytest.raises(MaxUploadError):  # video/audio без token
        await MaxClient(session=http).upload("audio", b"x")


async def test_send_file_retries_while_not_ready(monkeypatch):
    import platforms.max.client as client_mod

    monkeypatch.setattr(client_mod, "SEND_RETRY_DELAYS", (0, 0, 0))
    http = FakeHttpSession(responses=[
        ({"url": UPLOAD_URL}, 200),
        ({"token": "FILE"}, 200),
        ({"code": "attachment.not.ready", "message": "not processed"}, 400),
        ({"code": "attachment.not.ready", "message": "not processed"}, 400),
        ({"message": {"body": {"mid": "m1"}}}, 200),
    ])
    result = await MaxClient(session=http).send_file(9001, b"PDF", text="Отчёт", filename="r.pdf")
    assert result == {"message": {"body": {"mid": "m1"}}}
    sends = [c for c in http.calls if c[1] == f"{BASE_URL}/messages"]
    assert len(sends) == 3
    assert sends[0][2]["json"] == {
        "text": "Отчёт", "attachments": [{"type": "file", "payload": {"token": "FILE"}}],
    }


async def test_text_message_is_not_retried(monkeypatch):
    import platforms.max.client as client_mod

    monkeypatch.setattr(client_mod, "SEND_RETRY_DELAYS", (0, 0))
    http = FakeHttpSession(data={"code": "attachment.not.ready"}, status=400)
    await MaxClient(session=http).send_text(1, "x")
    assert len(http.calls) == 1


# --------------------------------------------------------------------------- parse / secret


def test_parse_message_created():
    u = parse_update(msg_update("m1", "hello"))
    assert (u.update_type, u.chat_id, u.user_id, u.text, u.mid) == ("message_created", 9001, 500, "hello", "m1")
    assert (u.content_type, u.chat_type, u.user_locale, u.first_name) == ("text", "dialog", "ru", "Иван")
    img = parse_update(msg_update("m2", None, attachments=[{"type": "image", "payload": {"url": "u"}}]))
    assert img.content_type == "image" and img.attachments[0]["type"] == "image"


def test_parse_callback_and_bot_started():
    cb = parse_update(CALLBACK)
    assert (cb.callback_id, cb.payload, cb.user_id, cb.chat_id, cb.content_type) == ("cb1", "help", 500, 9001, "callback")
    st = parse_update(BOT_STARTED)
    assert (st.payload, st.user_id, st.chat_id, st.content_type) == ("ref42", 600, 9001, "bot_started")
    assert st.order_key == "600" and parse_update(CHANNEL_POST).order_key == "-5"


def test_parse_skips_unknown_types():
    assert parse_update({"update_type": "bot_added", "chat_id": 1}) is None
    batch = parse_updates({"updates": [CALLBACK, BOT_STARTED, {"update_type": "user_added"}], "marker": 5})
    assert [u.update_type for u in batch] == ["message_callback", "bot_started"]


def test_verify_secret():
    assert verify_secret("anything", None)
    assert verify_secret(SECRET, SECRET)
    assert not verify_secret("wrong", SECRET)
    assert not verify_secret(None, SECRET)


# --------------------------------------------------------------------------- эндпоинт


async def test_webhook_end_to_end(db):
    got = []

    async def handler(update, ctx):
        got.append((update.update_type, ctx.db_user.external_id))

    # workers по умолчанию (4): пользователи 500 и 600 обрабатываются параллельно
    hook = build_webhook(handler, client=MaxClient(session=FakeHttpSession()))
    assert (await hook.handle_post(_raw(msg_update("m1", "hi")), "wrong"))[0] == 403
    assert (await hook.handle_post(b"{bad", SECRET))[0] == 400
    bodies = [msg_update("m1", "hi"), msg_update("m1", "hi"), CALLBACK, BOT_STARTED,
              CHANNEL_POST, msg_update("mb", "bot", uid=1, is_bot=True)]
    for body in bodies:
        assert await hook.handle_post(_raw(body), SECRET) == (200, '{"ok": true}')
    await hook.stop()

    # дубль m1, пост канала и сообщение бота не дошли до обработчика;
    # разные пользователи обрабатываются параллельно — порядок гарантирован внутри пользователя
    assert sorted(got) == sorted([("message_created", 500), ("message_callback", 500), ("bot_started", 600)])
    assert [kind for kind, uid in got if uid == 500] == ["message_created", "message_callback"]
    async with get_session() as s:
        users = UserRepository(s)
        assert await users.count("max") == 2
        ivan = await users.get("max", 500)
        assert (ivan.first_name, ivan.username, ivan.language_code) == ("Иван", "ivan", "ru")
        # в MessageLog пишется только message_created
        assert (await StatsRepository(s).summary("max"))["messages_day"] == 1


async def test_200_is_returned_before_processing(db):
    release = asyncio.Event()
    got = []

    async def handler(update, ctx):
        await release.wait()
        got.append(update.mid)

    hook = build_webhook(handler, client=MaxClient(session=FakeHttpSession()))
    status, _ = await asyncio.wait_for(hook.handle_post(_raw(msg_update("slow", "hi")), SECRET), timeout=1)
    assert status == 200 and got == []
    release.set()
    await hook.stop()
    assert got == ["slow"]


async def test_banned_user_callback_gets_notification(db):
    async with get_session() as s:
        users = UserRepository(s)
        await users.get_or_create(platform="max", external_id=500)
        await users.set_banned("max", 500, True)

    http = FakeHttpSession()
    called = []

    async def handler(update, ctx):
        called.append(update)

    hook = build_webhook(handler, client=MaxClient(session=http))
    assert (await hook.handle_post(_raw(CALLBACK), SECRET))[0] == 200
    await hook.stop()
    assert called == []
    _, url, kw = http.calls[0]
    assert url.endswith("/answers") and "notification" in kw["json"]


def test_app_wires_route():
    async def handler(update, ctx):
        pass

    app = build_app(handler, client=MaxClient(session=FakeHttpSession()), path="/max")
    routes = {(r.method, r.resource.canonical) for r in app.router.routes()}
    assert ("POST", "/max") in routes
    assert isinstance(app[WEBHOOK_KEY], MaxWebhook)


async def test_partial_user_does_not_erase_profile(db):
    """Событие без username/last_name (например, callback) не стирает известный профиль."""
    partial = {
        **CALLBACK,
        "callback": {
            **CALLBACK["callback"],
            "callback_id": "cb_partial",
            "user": {"user_id": 500, "first_name": "Иван", "is_bot": False},
        },
    }

    async def handler(update, ctx):
        pass

    hook = build_webhook(handler, client=MaxClient(session=FakeHttpSession()))
    for body in (msg_update("p1", "hi"), partial):
        assert (await hook.handle_post(_raw(body), SECRET))[0] == 200
    await hook.stop()
    async with get_session() as s:
        ivan = await UserRepository(s).get("max", 500)
    assert (ivan.username, ivan.first_name) == ("ivan", "Иван")


# --------------------------------------------------------------------------- polling


class FakeMax(MaxClient):
    """Клиент без сети: 1-й вызов — ошибка API, 2-й — пачка апдейтов, дальше висит."""

    def __init__(self) -> None:
        super().__init__(token="t", session=FakeHttpSession())
        self.markers: list[int | None] = []

    async def get_me(self) -> dict:
        return {"user_id": 1, "username": "bot"}

    async def get_updates(self, marker=None, **kwargs) -> dict:
        self.markers.append(marker)
        if len(self.markers) == 1:
            return {"code": "too.many.requests", "message": "429"}
        if len(self.markers) == 2:
            return {"updates": [msg_update("pm1", "poll"), msg_update("pb", "bot", uid=2, is_bot=True)], "marker": 77}
        await asyncio.sleep(3600)
        return {}


async def test_run_polling_backoff_marker_dispatch(db, monkeypatch):
    import platforms.max.runner as runner

    monkeypatch.setattr(runner, "POLL_DELAY_MIN", 0)
    polled = []

    async def handler(update, ctx):
        polled.append(update.mid)

    client = FakeMax()
    task = asyncio.create_task(run_polling(handler, client=client))
    for _ in range(200):
        await asyncio.sleep(0.01)
        if len(client.markers) >= 3:
            break
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task

    assert polled == ["pm1"]
    assert client.markers[:3] == [None, None, 77]
