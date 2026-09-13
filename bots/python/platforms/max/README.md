# 💬 Платформа MAX (Python)

Адаптер для ботов в мессенджере **MAX** (max.ru) через MAX Bot API.
Базовый URL `https://platform-api2.max.ru`, авторизация — заголовок `Authorization: <token>`.

> Сверено с официальной документацией [dev.max.ru/docs-api](https://dev.max.ru/docs-api) и
> официальными клиентами [github.com/max-messenger](https://github.com/max-messenger) в
> сентябре 2026. Неоднозначные места помечены в коде `# TODO-VERIFY`.

## Назначение

- получать события: **long polling** (`GET /updates`) для разработки или **webhook**
  (`POST /subscriptions`) для продакшена;
- проверять секрет вебхука (`X-Max-Bot-Api-Secret`) и **сразу отвечать 200**, обрабатывая
  события в фоне (`platforms/background.py`): одного пользователя — по порядку, разных — параллельно;
- разбирать `Update` в единый `MaxUpdate` (сообщение, нажатие кнопки, старт бота);
- регистрировать пользователя (пустые поля события не стирают профиль) и писать сообщения
  в `MessageLog` (как `UserMiddleware`);
- вызывать твой обработчик с `session` и `db_user`;
- отвечать через `MaxClient`: текст, inline-клавиатура, ответ на callback, **файлы**
  (`upload`, `send_file`) с повтором при `attachment.not.ready`.

## Требования

1. Бот, созданный на платформе MAX для партнёров (раздел «Чат-боты») или в «MAX для бизнеса».
   Токен: ⋮ → Настройки → скопировать токен.
2. Для webhook: публичный **HTTPS на порту 443** с сертификатом доверенного УЦ
   (или Минцифры). HTTP и самоподписанные сертификаты не поддерживаются с 25.05.2026.
3. Чтобы получать события из групп/каналов, бот должен быть администратором.

Ограничения: 30 rps на API; не более 2 сообщений в секунду в один чат; текст до 4000 символов;
клавиатура до 30 рядов / 210 кнопок (до 7 в ряду, до 3 для link/open_app/request_*).
Webhook и long polling одновременно не работают — при активной подписке `/updates` пуст.

## Переменные окружения

| Переменная | Где взять | Зачем |
|-----------|-----------|-------|
| `MAX_BOT_TOKEN` | настройки бота на платформе MAX | все запросы к API |
| `MAX_WEBHOOK_SECRET` | придумываешь сам: 5–256 символов `[A-Za-z0-9_-]` | проверка `X-Max-Bot-Api-Secret` |

`BOT_TOKEN` обязателен для `core.config` (общее ядро) — для чисто MAX-бота можно
указать любое непустое значение.

## Быстрый старт

```python
import asyncio

from platforms.max import MaxContext, MaxUpdate, callback_button, run_polling


async def handle(update: MaxUpdate, ctx: MaxContext) -> None:
    if update.update_type == "bot_started":
        await ctx.client.send_keyboard(
            update.chat_id, "Привет! Выбери:", [[callback_button("Помощь", "help")]]
        )
    elif update.update_type == "message_callback" and update.payload == "help":
        await ctx.client.answer_callback(update.callback_id, notification="Пишите вопрос")
    elif update.update_type == "message_created":
        await ctx.client.send_text(update.chat_id, f"Вы написали: {update.text}")


asyncio.run(run_polling(handle))                       # разработка
# asyncio.run(run_webhook(handle, port=8080,           # продакшен
#     public_url="https://bot.example.com/webhook"))   # подписка при старте
```

## Состав

| Файл | Что внутри |
|------|-----------|
| `client.py` | `MaxClient`: `send_text`, `send_message`, `send_keyboard`, `answer_callback`, `upload`, `send_file`, `get_upload_url`, `get_updates`, `subscribe`/`unsubscribe`/`get_subscriptions`, `get_me`; кнопки `callback_button`, `link_button`, `message_button`, `inline_keyboard` |
| `webhook.py` | `verify_secret`, `parse_update(s)` → `MaxUpdate`, эндпоинт `MaxWebhook` (`handle_post`), `webhook_app`/`create_webhook_app` |
| `runner.py` | `run_polling`, `run_webhook`, `build_webhook` (эндпоинт без сервера), `build_app`, `MaxContext` (client + session + db_user) |

Отправить файл: `await client.send_file(chat_id, "report.pdf", "file", text="Отчёт")`;
картинку/видео — `upload_type="image"` / `"video"`. Вложение из `upload()` можно
переиспользовать в нескольких сообщениях.

`MaxUpdate.update_type`: `message_created`, `message_callback`, `bot_started`.
`content_type`: `text`, `callback`, `bot_started` или тип вложения (`image`, `video`, `file`, `contact`…).
Сообщения от ботов (`sender.is_bot`) по умолчанию отбрасываются; посты в каналах без
отправителя в БД не пишутся.

## Точки расширения

| Хочу | Где менять |
|------|-----------|
| Своя логика ответа | обработчик `handle(update, ctx)` → `run_polling` / `run_webhook` |
| Другие события (`bot_added`, `message_edited`, `user_added`…) | `webhook.py` → `parse_update` + `HANDLED_TYPES` |
| Другие кнопки (`request_contact`, `open_app`, `clipboard`) | передать dict кнопки в `send_keyboard` |
| Разметка текста | `send_message(..., format="markdown" \| "html")` |
| Встроить в свой сервер | `build_webhook(...)` → `handle_post`; для aiohttp — `build_app(...)` |
| Дедупликация между процессами | `runner.py` → `make_dispatcher` (сейчас in-memory) |
| Паузы повторов при `attachment.not.ready` | `client.py` → `SEND_RETRY_DELAYS` |

## Документация MAX

- Обзор и клавиатуры: https://dev.max.ru/docs-api
- Отправка: https://dev.max.ru/docs-api/methods/POST/messages
- Long polling: https://dev.max.ru/docs-api/methods/GET/updates
- Webhook: https://dev.max.ru/docs-api/methods/POST/subscriptions
- Ответ на callback: https://dev.max.ru/docs-api/methods/POST/answers
- Объект Update: https://dev.max.ru/docs-api/objects/Update
