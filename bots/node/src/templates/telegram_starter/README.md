# Шаблон: telegram_starter (Node.js)

Минимальный Telegram-бот на grammY — зеркало `bots/python/templates/telegram_starter`.

**Что внутри:** регистрация пользователей в БД (`usersMiddleware`), `/start`, `/help`,
`/cancel`, эхо.

**Запуск:**
```bash
cd bots/node
cp .env.example .env        # BOT_TOKEN обязателен
npm install
npm run build
npm run start:starter
```

**Добавить модуль:** `bot.use(<модуль>Composer)` в `build()` — до `commonComposer`
(у него эхо на любое сообщение).
