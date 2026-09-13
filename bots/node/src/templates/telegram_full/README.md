# Шаблон: telegram_full (Node.js)

Полноценный Telegram-бот «под ключ» на grammY — зеркало `bots/python/templates/telegram_full`.
Собран из ядра и всех основных модулей.

**Что внутри:** регистрация пользователей, `/start`/`/help`/`/cancel`, админ-панель (`/admin`),
статистика (`/stats`), рассылки (`/broadcast`), бан/разбан (`/ban`, `/unban`), отложенные посты
(`/schedule`, `/scheduled`, `/unschedule`), магазин (`/shop`, `/cart`, `/addproduct`...),
оплата Stars (`/donate`), рефералка (`/ref`), поддержка (`/support`, `/reply`, `/close`, `/tickets`), эхо.

**Запуск:**
```bash
cd bots/node
cp .env.example .env        # BOT_TOKEN + ADMIN_IDS обязательны
npm install
npm run build
npm run start:full
```

**Убрать ненужный модуль:** удали соответствующий `bot.use(...)` в `build()`.

**Добавить свой:** создай `src/modules/<имя>/` с `composer`, подключи в `build()` до `commonComposer`.
