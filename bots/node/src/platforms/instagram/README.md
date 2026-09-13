# 📸 Платформа Instagram (Node.js)

Адаптер для ботов в Instagram Direct через **Instagram API with Instagram Login**
(Graph API **v26.0**, хост `graph.instagram.com`) — зеркало `bots/python/platforms/instagram`.
Логика бота живёт в обработчике, платформа только принимает вебхуки и отправляет ответы.

> Сверено с официальной документацией Meta в сентябре 2026. Неоднозначные места помечены
> в коде `// TODO-VERIFY`.

## Что делает

- принимает вебхук Meta: GET-верификация подписки + POST с событиями;
- проверяет подпись `X-Hub-Signature-256` (HMAC-SHA256 ключом App Secret);
- **сразу отвечает 200**, а события обрабатывает в фоне (`KeyedWorkerPool`): сообщения
  одного собеседника — по порядку, разных — параллельно; при остановке принятое дообрабатывается;
- разбирает тело в `IncomingMessage` (текст, вложения, quick reply, postback);
- регистрирует пользователя (имя и username — один раз из User Profile API), блокирует
  забаненных, пишет сообщение в `MessageLog`, отсекает повторную доставку по `mid`;
- вызывает твой обработчик с `ctx.client`, `ctx.db`, `ctx.dbUser`.

## Требования

Те же, что у Python-версии: профессиональный аккаунт Instagram, Meta App с разрешениями
`instagram_business_basic` и `instagram_business_manage_messages`, приложение в режиме Live,
публичный HTTPS (reverse-proxy на `runWebhook`), подписка `POST /me/subscribed_apps`.
Подробно — [`bots/python/platforms/instagram/README.md`](../../../../python/platforms/instagram/README.md).

## Переменные окружения

| Переменная | Зачем |
|-----------|-------|
| `IG_ACCESS_TOKEN` | отправка сообщений, профиль |
| `IG_APP_SECRET` | проверка `X-Hub-Signature-256` |
| `IG_VERIFY_TOKEN` | GET-верификация подписки |

## Быстрый старт

```ts
import { runWebhook } from "./platforms/instagram/index.js";

await runWebhook(
  async (msg, ctx) => {
    await ctx.client.markSeen(msg.senderId);
    if (msg.payload === "HELP") {
      await ctx.client.sendText(msg.senderId, "Чем помочь?");
      return;
    }
    await ctx.client.sendQuickReplies(msg.senderId, `Вы написали: ${msg.text}`, [
      ["Помощь", "HELP"],
      ["Меню", "MENU"],
    ]);
  },
  { port: 8080, path: "/webhook" },
);
```

## Состав

| Файл | Что внутри |
|------|-----------|
| `client.ts` | `InstagramClient`: `sendText`, `sendImage`, `sendQuickReplies`, `markSeen`, `getUserProfile` |
| `webhook.ts` | `verifyChallenge`, `verifySignature`, `parseEvents`, эндпоинт `InstagramWebhook` (`handleGet`/`handlePost`) |
| `runner.ts` | `makeDispatcher`, `buildWebhook` (эндпоинт без сервера), `runWebhook` |
| `../background.ts`, `../http.ts` | общий пул воркеров и сервер вебхука для Instagram и MAX |

## Ограничения

- `external_id` в Node хранится как `number`: IGSID больше 2^53 будет пропущен с предупреждением
  (`toExternalId`, TODO-VERIFY). В Python такого ограничения нет.
- Очередь фоновой обработки и дедуп — в памяти процесса (один процесс на бота).

## Точки расширения

| Хочу | Где менять |
|------|-----------|
| Своя логика ответа | обработчик `runWebhook(handler, …)` |
| Встроить в свой сервер | `buildWebhook(handler)` → `handleGet` / `handlePost` |
| Другая версия Graph API | `client.ts` → `GRAPH_API_VERSION` |
| Реакции, `read`, `referral` | `webhook.ts` → `parseMessage` |
