# 📸 Платформа Instagram (Python)

Адаптер для ботов в Instagram Direct через **Instagram API with Instagram Login**
(Graph API **v26.0**, хост `graph.instagram.com`). Логика бота живёт в обработчике,
платформа только принимает вебхуки и отправляет ответы.

> Сверено с официальной документацией Meta в сентябре 2026. Места, где документация
> неоднозначна, помечены в коде `# TODO-VERIFY`.

## Назначение

- принять вебхук Meta: GET-верификация подписки + POST с событиями;
- проверить подпись `X-Hub-Signature-256` (HMAC-SHA256 ключом App Secret);
- **сразу ответить 200**, а события обработать в фоне (`platforms/background.py`):
  сообщения одного собеседника — по порядку, разных — параллельно; при остановке принятое
  дообрабатывается;
- разобрать тело в единый `IncomingMessage` (текст, вложения, quick reply, postback);
- зарегистрировать пользователя (имя и username — один раз из User Profile API, дальше не
  затираются) и записать сообщение в `MessageLog` (как `UserMiddleware`);
- вызвать твой обработчик с `session` и `db_user`;
- отвечать через `InstagramClient`.

## Требования

1. **Профессиональный аккаунт Instagram** (Business или Creator).
2. **Meta App** на [developers.facebook.com](https://developers.facebook.com) с продуктом
   Instagram → «API setup with Instagram login».
3. Разрешения: `instagram_business_basic`, `instagram_business_manage_messages`.
   Для чужих аккаунтов — Advanced Access (App Review) и Business Verification.
4. Приложение в режиме **Live** — иначе Meta не шлёт вебхуки.
5. Публичный **HTTPS** с валидным сертификатом (самоподписанные не принимаются) →
   reverse-proxy (nginx/Caddy) на `run_webhook`.
6. Подписка аккаунта на поля вебхука: `POST /me/subscribed_apps?subscribed_fields=messages,messaging_postbacks`.

Ограничения API: отвечать можно только тому, кто написал первым, и в течение 24 часов;
текст — до 1000 байт; quick replies — до 13 кнопок по 20 символов; картинки png/jpeg до 8 МБ.

## Переменные окружения

| Переменная | Где взять | Зачем |
|-----------|-----------|-------|
| `IG_ACCESS_TOKEN` | Instagram User access token (App Dashboard → API setup) | отправка сообщений, профиль |
| `IG_APP_SECRET` | App Dashboard → App settings → Basic → App Secret | проверка `X-Hub-Signature-256` |
| `IG_VERIFY_TOKEN` | придумываешь сам, вписываешь в настройки Webhooks | GET-верификация подписки |

`BOT_TOKEN` обязателен для `core.config` (общее ядро) — для чисто Instagram-бота можно
указать любое непустое значение.

## Быстрый старт

```python
import asyncio

from platforms.instagram import IncomingMessage, InstagramContext, run_webhook


async def handle(msg: IncomingMessage, ctx: InstagramContext) -> None:
    await ctx.client.mark_seen(msg.sender_id)
    if msg.payload == "HELP":
        await ctx.client.send_text(msg.sender_id, "Чем помочь?")
        return
    await ctx.client.send_quick_replies(
        msg.sender_id, f"Вы написали: {msg.text}", [("Помощь", "HELP"), ("Меню", "MENU")]
    )


asyncio.run(run_webhook(handle, host="0.0.0.0", port=8080, path="/webhook"))
```

Callback URL в App Dashboard: `https://<твой-домен>/webhook`, Verify token = `IG_VERIFY_TOKEN`.

## Состав

| Файл | Что внутри |
|------|-----------|
| `client.py` | `InstagramClient`: `send_text`, `send_image`, `send_quick_replies`, `mark_seen`, `get_user_profile` |
| `webhook.py` | `verify_challenge`, `verify_signature`, `parse_events` → `IncomingMessage`, эндпоинт `InstagramWebhook` (`handle_get`/`handle_post`), `webhook_app`/`create_webhook_app` |
| `runner.py` | `run_webhook`, `build_webhook` (эндпоинт без сервера), `build_app`, `InstagramContext` (client + session + db_user) |

`IncomingMessage.content_type`: `text`, `quick_reply`, `postback`, тип вложения
(`image`, `video`, `audio`, `file`, `share`, `story_mention`, `ig_reel`…), `deleted`, `unsupported`.
Эхо собственных сообщений (`is_echo`) по умолчанию отбрасывается.

## Точки расширения

| Хочу | Где менять |
|------|-----------|
| Своя логика ответа | обработчик `handle(msg, ctx)` → `run_webhook` |
| Другая версия Graph API | `client.py` → `GRAPH_API_VERSION` |
| Facebook Login / Page token (`graph.facebook.com`) | `InstagramClient(api_base="https://graph.facebook.com/v26.0")` — не проверено |
| Реакции, `read`, `referral`, `message_edit` | `webhook.py` → `_parse_message` (сейчас пропускаются) |
| Встроить в свой сервер | `build_webhook(...)` → `handle_get` / `handle_post`; для aiohttp — `build_app(...)` |
| Число фоновых воркеров | `run_webhook(..., workers=4)` |
| Отключить проверку подписи (локальная отладка без App Secret) | `run_webhook(..., check_signature=False)` — никогда в проде |
| Дедупликация между процессами | `runner.py` → `make_dispatcher` (сейчас in-memory по `mid`) |

## Документация Meta

- Send API: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/
- Webhooks: https://developers.facebook.com/docs/instagram-platform/webhooks/
- Примеры payload: https://developers.facebook.com/docs/instagram-platform/webhooks/examples/
- Quick replies / Sender actions / User Profile — разделы Messaging API там же
- Версии Graph API: https://developers.facebook.com/docs/graph-api/changelog/
