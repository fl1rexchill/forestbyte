"""platforms/instagram: клиент (замоканный HTTP), подпись, парсинг, эндпоинт вебхука.

Эндпоинт проверяется напрямую (handle_get / handle_post) — без HTTP-сервера и сокетов.
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json

import pytest

from core.database.base import get_session
from core.database.repositories import StatsRepository, UserRepository
from platforms.instagram import (
    InstagramClient,
    build_app,
    build_webhook,
    create_webhook_app,
    parse_events,
    verify_challenge,
    verify_signature,
)
from platforms.instagram.client import GRAPH_API
from platforms.instagram.webhook import WEBHOOK_KEY, InstagramWebhook
from tests.conftest import FakeHttpSession

SECRET = "ig-test-secret"  # из conftest


def _event(mid: str, **message) -> dict:
    return {
        "sender": {"id": "777"},
        "recipient": {"id": "IG"},
        "timestamp": 1,
        "message": {"mid": mid, **message},
    }


PAYLOAD = {
    "object": "instagram",
    "entry": [
        {
            "id": "IG",
            "time": 1,
            "messaging": [
                _event("m1", text="hello"),
                _event("m2", attachments=[{"type": "image", "payload": {"url": "https://cdn/x.jpg"}}]),
                _event("m3", text="Да", quick_reply={"payload": "YES"}),
                {"sender": {"id": "777"}, "recipient": {"id": "IG"}, "timestamp": 2,
                 "postback": {"mid": "m4", "title": "Старт", "payload": "GO"}},
                {"sender": {"id": "IG"}, "recipient": {"id": "777"}, "timestamp": 3,
                 "message": {"mid": "m5", "text": "echo", "is_echo": True}},
                {"sender": {"id": "777"}, "recipient": {"id": "IG"}, "timestamp": 4, "read": {"mid": "m1"}},
            ],
        }
    ],
}


def _sign(body: bytes) -> str:
    return "sha256=" + hmac.new(SECRET.encode(), body, hashlib.sha256).hexdigest()


def _body(*events: dict) -> bytes:
    return json.dumps({"object": "instagram", "entry": [{"id": "IG", "messaging": list(events)}]}).encode()


# --------------------------------------------------------------------------- client


async def test_send_text_request_shape(fake_http: FakeHttpSession):
    client = InstagramClient(session=fake_http)
    await client.send_text("42", "hi")
    method, url, kw = fake_http.calls[0]
    assert (method, url) == ("POST", f"{GRAPH_API}/me/messages")
    assert GRAPH_API == "https://graph.instagram.com/v26.0"
    assert kw["headers"] == {"Authorization": "Bearer ig-test-token"}
    assert kw["json"] == {"recipient": {"id": "42"}, "message": {"text": "hi"}}


async def test_send_image_and_ig_user_id(fake_http: FakeHttpSession):
    client = InstagramClient(ig_user_id="17841400000", session=fake_http)
    await client.send_image("42", "https://x/i.png")
    _, url, kw = fake_http.calls[0]
    assert url.endswith("/17841400000/messages")
    assert kw["json"]["message"] == {
        "attachments": [{"type": "image", "payload": {"url": "https://x/i.png"}}]
    }


async def test_send_quick_replies_limits(fake_http: FakeHttpSession):
    client = InstagramClient(session=fake_http)
    replies = [("X" * 30, "P0")] + [(f"b{i}", f"P{i}") for i in range(1, 15)]
    replies.append({"content_type": "user_email", "title": "e", "payload": "E"})
    await client.send_quick_replies("42", "Выбери", replies)
    items = fake_http.calls[0][2]["json"]["message"]["quick_replies"]
    assert len(items) == 13
    assert items[0] == {"content_type": "text", "title": "X" * 20, "payload": "P0"}


async def test_mark_seen_and_profile(fake_http: FakeHttpSession):
    client = InstagramClient(session=fake_http)
    await client.mark_seen("42")
    await client.get_user_profile("42", fields=("name", "username"))
    assert fake_http.calls[0][2]["json"] == {"recipient": {"id": "42"}, "sender_action": "mark_seen"}
    method, url, kw = fake_http.calls[1]
    assert method == "GET" and url == f"{GRAPH_API}/42"
    assert kw["params"] == {"fields": "name,username", "access_token": "ig-test-token"}


async def test_api_error_is_returned_not_raised():
    http = FakeHttpSession(data={"error": {"message": "bad", "code": 100}}, status=400)
    result = await InstagramClient(session=http).send_text("1", "x")
    assert result["error"]["code"] == 100


# --------------------------------------------------------------------------- verify / parse


def test_verify_challenge():
    ok = {"hub.mode": "subscribe", "hub.verify_token": "vt", "hub.challenge": "123"}
    assert verify_challenge(ok, "vt") == "123"
    assert verify_challenge({**ok, "hub.verify_token": "bad"}, "vt") is None
    assert verify_challenge({**ok, "hub.mode": "unsubscribe"}, "vt") is None
    assert verify_challenge(ok, None) is None


def test_verify_signature():
    body = b'{"a":1}'
    assert verify_signature(body, _sign(body), SECRET)
    assert not verify_signature(body + b" ", _sign(body), SECRET)
    assert not verify_signature(body, "sha1=abc", SECRET)
    assert not verify_signature(body, None, SECRET)


def test_parse_events():
    events = parse_events(PAYLOAD)
    assert [e.content_type for e in events] == ["text", "image", "quick_reply", "postback", "text"]
    assert events[0].sender_id == "777" and events[0].account_id == "IG" and events[0].text == "hello"
    assert events[1].attachments == [{"type": "image", "url": "https://cdn/x.jpg"}]
    assert events[2].payload == "YES" and events[3].payload == "GO" and events[3].text == "Старт"
    assert events[4].is_echo is True
    assert parse_events([PAYLOAD])[0].mid == "m1"  # тело-массив
    assert parse_events({"object": "page", "entry": []}) == []


# --------------------------------------------------------------------------- эндпоинт


async def test_webhook_end_to_end(db):
    got = []

    async def handler(msg, ctx):
        got.append((msg.mid, ctx.db_user.external_id))

    hook = build_webhook(handler, client=InstagramClient(session=FakeHttpSession()))
    ok = {"hub.mode": "subscribe", "hub.verify_token": "ig-verify", "hub.challenge": "999"}
    assert hook.handle_get(ok) == (200, "999")
    assert hook.handle_get({**ok, "hub.verify_token": "x"}) == (403, "forbidden")

    raw = json.dumps(PAYLOAD).encode()
    assert (await hook.handle_post(raw, "sha256=00"))[0] == 403
    assert (await hook.handle_post(b"not json", _sign(b"not json")))[0] == 400
    for _ in range(2):  # повторная доставка отсекается по mid
        assert await hook.handle_post(raw, _sign(raw)) == (200, "EVENT_RECEIVED")
    await hook.stop()  # дообработать принятое

    assert got == [("m1", 777), ("m2", 777), ("m3", 777), ("m4", 777)]
    async with get_session() as s:
        assert await UserRepository(s).count("instagram") == 1
        assert (await StatsRepository(s).summary("instagram"))["messages_day"] == 4


async def test_200_is_returned_before_processing(db):
    """Meta получает ответ сразу, даже если обработчик ещё работает."""
    release = asyncio.Event()
    got = []

    async def handler(msg, ctx):
        await release.wait()
        got.append(msg.mid)

    hook = build_webhook(handler, client=InstagramClient(session=FakeHttpSession()))
    raw = _body(_event("slow", text="hi"))
    assert (await asyncio.wait_for(hook.handle_post(raw, _sign(raw)), timeout=1))[0] == 200
    assert got == []
    release.set()
    await hook.stop()
    assert got == ["slow"]


async def test_inline_mode_processes_before_response(db):
    got = []

    async def handler(msg, ctx):
        got.append(msg.mid)

    hook = build_webhook(handler, client=InstagramClient(session=FakeHttpSession()), background=False)
    raw = _body(_event("inline", text="hi"))
    await hook.handle_post(raw, _sign(raw))
    assert got == ["inline"]


async def test_banned_user_gets_notice_not_handler(db):
    async with get_session() as s:
        users = UserRepository(s)
        await users.get_or_create(platform="instagram", external_id=777)
        await users.set_banned("instagram", 777, True)

    http = FakeHttpSession()
    called = []

    async def handler(msg, ctx):
        called.append(msg)

    hook = build_webhook(handler, client=InstagramClient(session=http))
    raw = _body(_event("b1", text="hi"))
    assert (await hook.handle_post(raw, _sign(raw)))[0] == 200
    await hook.stop()
    assert called == []
    assert http.calls[0][2]["json"]["recipient"] == {"id": "777"}


def test_app_requires_secret_and_wires_routes():
    async def handler(msg):
        pass

    with pytest.raises(ValueError):
        create_webhook_app(handler, app_secret=None)
    create_webhook_app(handler, app_secret=None, check_signature=False)  # локальная отладка

    async def full_handler(msg, ctx):
        pass

    app = build_app(full_handler, client=InstagramClient(session=FakeHttpSession()), path="/ig")
    routes = {(r.method, r.resource.canonical) for r in app.router.routes()}
    assert {("GET", "/ig"), ("POST", "/ig")} <= routes
    assert isinstance(app[WEBHOOK_KEY], InstagramWebhook)


async def test_new_user_profile_fetched_once(db):
    http = FakeHttpSession(data={"name": "Иван Петров", "username": "ivan_ig"})
    seen = []

    async def handler(msg, ctx):
        seen.append((ctx.db_user.username, ctx.db_user.first_name))

    hook = build_webhook(handler, client=InstagramClient(session=http))
    raw = _body(_event("n1", text="hi"), _event("n2", text="again"))
    assert (await hook.handle_post(raw, _sign(raw)))[0] == 200
    await hook.stop()
    profile_calls = [c for c in http.calls if c[0] == "GET"]
    assert len(profile_calls) == 1 and profile_calls[0][1].endswith("/777")
    assert seen == [("ivan_ig", "Иван Петров"), ("ivan_ig", "Иван Петров")]


async def test_profile_error_does_not_block_handler(db):
    http = FakeHttpSession(data={"error": {"message": "User consent is required"}}, status=400)
    seen = []

    async def handler(msg, ctx):
        seen.append(ctx.db_user.username)

    hook = build_webhook(handler, client=InstagramClient(session=http))
    raw = _body(_event("n1", text="hi"), _event("n2", text="again"))
    assert (await hook.handle_post(raw, _sign(raw)))[0] == 200
    await hook.stop()
    assert seen == [None, None]
