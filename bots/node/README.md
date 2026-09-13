# 🟢 Node.js-боты (grammY + TypeScript)

Зеркалит архитектуру Python-стека (`bots/python`), но на TypeScript (strict).
Логика и контракты модулей — те же, что в `bots/python/README.md`.

## Архитектура

```
bots/node/
├── src/
│   ├── core/                 # общее ядро (копируется целиком)          🟢
│   │   ├── config.ts         # настройки из .env (zod + dotenv)
│   │   ├── logger.ts         # логи (консоль + асинхронный файл с ротацией)
│   │   ├── i18n.ts           # мультиязычность ru/en
│   │   └── db/               # Drizzle ORM (SQLite/PostgreSQL)
│   │       ├── client.ts     # подключение, initDb/getDb/disposeDb, transaction()
│   │       ├── schema.ts     # users, message_logs, broadcast_jobs, settings — 1:1 с Python
│   │       ├── ddl.ts        # CREATE TABLE IF NOT EXISTS (тот же SQL, что у Alembic)
│   │       ├── helpers.ts    # pickTables (таблицы модуля под диалект), userFullName
│   │       └── repositories.ts  # весь доступ к данным
│   ├── modules/              # подключаемые фичи (grammY Composer)       🟢
│   │   ├── users/            # регистрация/учёт (middleware)
│   │   ├── common/           # /start, /help, /cancel, эхо
│   │   ├── admin/            # админ-панель, бан/разбан, фильтр isAdmin
│   │   ├── statistics/       # DAU/WAU/MAU, новые/активные — по всем платформам
│   │   ├── broadcast/        # массовые рассылки
│   │   ├── referral/         # реферальные ссылки, учёт приглашённых
│   │   ├── support/          # тикеты поддержки (юзер ↔ админ)
│   │   ├── scheduler/        # отложенные посты + фоновый цикл
│   │   ├── payments/         # оплата: Telegram Stars и провайдеры
│   │   ├── shop/             # магазин: каталог, корзина, заказы
│   │   ├── captcha/          # антибот-капча для групп
│   │   └── moderation/       # модерация групп: ban/mute/warn + антифлуд
│   ├── platforms/            #                                          🟢
│   │   ├── telegram/         # grammY: фабрики Bot/Composer, раннер polling + webhook,
│   │   │                     #   FSM (fsm.ts), хуки старта/остановки (lifecycle.ts), hasUser
│   │   ├── instagram/        # Instagram API (Graph v26.0): клиент, вебхук, раннер
│   │   ├── max/              # MAX Bot API: long polling + webhook, клавиатуры, файлы
│   │   ├── background.ts     # пул воркеров: вебхук отвечает 200 сразу, обработка в фоне
│   │   └── http.ts           # общий сервер вебхука (node:http), fetch для клиентов
│   └── templates/            # готовые боты «под ключ»                  🟢
│       ├── telegram_starter/ # минимальный
│       ├── telegram_full/    # админка, стата, рассылки, магазин, оплата, рефералка, поддержка
│       └── telegram_group/   # модератор группы: капча + модерация + антифлуд
├── tests/                    # vitest: ядро, модули, шаблоны, Instagram/MAX — без сети
├── package.json
├── tsconfig.json             # strict: true (сборка src)
├── tsconfig.test.json        # проверка типов тестов
├── vitest.config.ts
└── biome.json                # линтер + форматтер (единственный)
```

## Соответствие стеков

| Python | Node |
|--------|------|
| aiogram 3.x | grammY |
| SQLAlchemy async | Drizzle ORM (better-sqlite3 / postgres.js) |
| pydantic-settings | zod + dotenv |
| Router | grammY Composer |
| middleware | grammY middleware |
| FSMContext + MemoryStorage | grammY `session` + `platforms/telegram/fsm.ts` |
| `dp.startup` / `dp.shutdown` | `onStartup` / `onShutdown` (`platforms/telegram/lifecycle.ts`) |
| фильтр `IsAdmin()` | `composer.filter(isAdmin)` |
| `session`, `db_user` в хендлере | `ctx.db`, `ctx.dbUser` после `composer.filter(hasUser)` |
| сессия `get_session()` (unit of work) | `transaction(db, fn)` для нескольких записей |
| `snake_case` поля моделей | `camelCase` свойства, те же колонки в БД |

## Запуск за 4 шага

```bash
cd bots/node
cp .env.example .env          # заполни BOT_TOKEN и ADMIN_IDS
npm install
npm run build && npm run start:full     # или start:starter / start:group
```

## Проверка сборки и тесты

Без токенов и сети: БД — SQLite in-memory, Telegram API и `fetch` подменены.

```bash
cd bots/node
npx tsc --noEmit              # типы кода (strict)
npm run typecheck             # типы кода и тестов
npm test                      # vitest
npm run lint                  # biome
```

| Файл | Что проверяет |
|------|---------------|
| `tests/core.config.test.ts` | разбор `.env`, значения по умолчанию, ошибки конфигурации |
| `tests/core.i18n.test.ts` | переводы, фоллбэки локали, подстановка параметров |
| `tests/core.db.test.ts` | `DATABASE_URL`, формат дат, DDL, все репозитории |
| `tests/smoke.test.ts` | все модули и шаблоны: таблицы, сценарии через `bot.handleUpdate` |
| `tests/fixes.test.ts` | `/cancel` в диалогах, экранирование HTML, `messageHtml` |
| `tests/improvements.test.ts` | `transaction()`, ключ сессии, `hasUser`, платформы в статистике, scheduler, логгер |
| `tests/background.test.ts` | пул воркеров: порядок, параллельность, ошибки |
| `tests/instagram.test.ts` · `tests/max.test.ts` | клиенты, подписи, парсинг, вебхуки, загрузка файлов, polling |

## База данных

Одна переменная `DATABASE_URL` переключает драйвер, код не меняется:

```env
DATABASE_URL=sqlite:///data/bot.sqlite3                 # dev (better-sqlite3)
DATABASE_URL=postgres://user:pass@localhost:5432/botdb  # prod (postgres.js)
```

Строки из Python-стека (`sqlite+aiosqlite:///...`, `postgresql+asyncpg://...`) тоже понимаются.

Схема **1:1 с Python-моделями**: те же таблицы, колонки и индексы, даты в SQLite — в формате
SQLAlchemy. Node- и Python-боты могут работать с одной БД. `initDb()` создаёт недостающие
таблицы ядра и зарегистрированных модулей (как `create_all`); для продакшена схему ведёт
Alembic из `bots/python`.

**Транзакции.** Методы репозиториев пишут сразу. Несколько связанных записей объединяй в
`transaction(db, async (tx) => …)`: в PostgreSQL — транзакция Drizzle, в SQLite —
`BEGIN IMMEDIATE`/`COMMIT` на единственном соединении, транзакции идут по очереди. Внутри —
только запросы к БД (без вызовов Telegram API). Так пишутся заказ магазина, тикет поддержки,
итог рассылки.

## Контракт модуля

Каждый модуль:
- экспортирует `composer` (grammY Composer) и/или middleware через `index.ts`;
- хендлеры, которым нужен пользователь, вешает на `composer.filter(hasUser)` — там
  `ctx.db` и `ctx.dbUser` гарантированно есть (без `usersMiddleware` апдейт просто
  проходит дальше, а не падает);
- не пишет SQL по таблицам ядра — только через репозитории из `core/db`;
- свои таблицы описывает в `models.ts` (оба диалекта) и регистрирует через `registerDdl()`;
- админские хендлеры защищены `isAdmin` (доступ по `ADMIN_IDS`).

Порядок подключения — как в Python: `usersMiddleware` первым, `shop` раньше `payments`,
`referral` раньше `common`, `common` (эхо) последним. Эталон — `src/templates/telegram_full/main.ts`.

Подробно — [`docs/MODULE_CONTRACT.md`](../../docs/MODULE_CONTRACT.md) (контракт общий для стеков).

## Ограничения

- Один процесс на бота: FSM-сессии, таймеры капчи, счётчики антифлуда, дедуп и очередь
  вебхуков живут в памяти (подробно — `docs/DEPLOYMENT.md`). Scheduler безопасен и для
  нескольких процессов — задачи забираются атомарно.
- `external_id` хранится как `number`: id больше 2^53 (возможно у Instagram) пропускаются
  с предупреждением.

## Точки расширения

| Хочу | Где менять |
|------|-----------|
| Новые тексты/язык | `src/core/i18n.ts` (TRANSLATIONS) |
| Новая таблица ядра | `src/core/db/schema.ts` (оба диалекта) + `ddl.ts` + репозиторий |
| Таблица модуля | `src/modules/<имя>/models.ts` + `registerDdl()` (пример: `support/models.ts`) |
| Webhook вместо polling | `runWebhook(bot, { baseUrl })` из `platforms/telegram` |
| Бот на Instagram / MAX | `src/platforms/instagram`, `src/platforms/max` (README рядом) |
| Фоновая задача модуля | `onStartup` / `onShutdown` (пример: `scheduler/service.ts`) |
| FSM в Redis / между перезапусками | `platforms/telegram/bot.ts` → `storage` у `session` |
