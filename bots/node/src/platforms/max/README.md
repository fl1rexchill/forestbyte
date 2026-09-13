# 💬 Платформа MAX (Node.js)

Адаптер для ботов в мессенджере **MAX** (max.ru) через MAX Bot API — зеркало
`bots/python/platforms/max`. Базовый URL `https://platform-api2.max.ru`, авторизация —
заголовок `Authorization: <token>`.

> Сверено с [dev.max.ru/docs-api](https://dev.max.ru/docs-api) и официальными клиентами
> [github.com/max-messenger](https://github.com/max-messenger) в сентябре 2026.
> Неоднозначные места помечены в коде `// TODO-VERIFY`.

## Что делает

- получает события: **long polling** (`runPolling`, для разработки) или **webhook**
  (`runWebhook`, для продакшена) с проверкой `X-Max-Bot-Api-Secret`;
- webhook **сразу отвечает 200**, события обрабатываются в фоне: одного пользователя —
  по порядку, разных — параллельно;
- разбирает `Update` в `MaxUpdate` (сообщение, нажатие кнопки, старт бота);
- регистрирует пользователя (пустые поля события не стирают профиль), блокирует
  забаненных, пишет сообщения в `MessageLog`, отсекает повторную доставку;
- отправляет текст, inline-клавиатуры, отвечает на callback, **загружает файлы**
  (`upload`, `sendFile`) с повтором при `attachment.not.ready`.

## Переменные окружения

| Переменная | Зачем |
|-----------|-------|
| `MAX_BOT_TOKEN` | все запросы к API |
| `MAX_WEBHOOK_SECRET` | проверка `X-Max-Bot-Api-Secret` (5–256 символов `[A-Za-z0-9_-]`) |

## Быстрый старт

```ts
import { callbackButton, runPolling } from "./platforms/max/index.js";

await runPolling(async (update, ctx) => {
  if (update.updateType === "bot_started") {
    await ctx.client.sendKeyboard(update.chatId, "Привет! Выбери:", [
      [callbackButton("Помощь", "help")],
    ]);
  } else if (update.updateType === "message_callback" && update.callbackId) {
    await ctx.client.answerCallback(update.callbackId, { notification: "Пишите вопрос" });
  } else if (update.updateType === "message_created") {
    await ctx.client.sendText(update.chatId, `Вы написали: ${update.text}`);
  }
});
// продакшен: await runWebhook(handler, { port: 8080, publicUrl: "https://bot.example.com/webhook" });
```

Отправить файл: `await client.sendFile(chatId, "report.pdf", "file", { text: "Отчёт" })`.

## Состав

| Файл | Что внутри |
|------|-----------|
| `client.ts` | `MaxClient`: `sendText`, `sendMessage`, `sendKeyboard`, `answerCallback`, `upload`, `sendFile`, `getUpdates`, `subscribe`/`unsubscribe`/`getSubscriptions`, `getMe`; кнопки `callbackButton`, `linkButton`, `messageButton`, `inlineKeyboard` |
| `webhook.ts` | `verifySecret`, `parseUpdate(s)` → `MaxUpdate`, эндпоинт `MaxWebhook` (`handlePost`) |
| `runner.ts` | `makeDispatcher`, `runPolling` (остановка по `signal` или Ctrl+C), `buildWebhook`, `runWebhook` |

Требования к вебхуку (HTTPS на 443, доверенный сертификат, ответ за 30 с) и лимиты API —
в [`bots/python/platforms/max/README.md`](../../../../python/platforms/max/README.md).

## Точки расширения

| Хочу | Где менять |
|------|-----------|
| Другие события (`bot_added`, `message_edited`…) | `webhook.ts` → `parseUpdate` + `HANDLED_TYPES` |
| Другие кнопки (`request_contact`, `open_app`) | передать объект кнопки в `sendKeyboard` |
| Встроить в свой сервер | `buildWebhook(handler)` → `handlePost` |
| Паузы повторов при загрузке | `new MaxClient({ retryDelaysMs: [...] })` |
