# 🐍 Python-боты (aiogram 3.x)

Модульная база для сборки ботов. Ядро + подключаемые модули + готовые шаблоны.

## Архитектура

```
bots/python/
├── core/                 # общее ядро (копируется целиком)
│   ├── config.py         # настройки из .env (pydantic-settings)
│   ├── logger.py         # логи (консоль + файл с ротацией)
│   ├── i18n.py           # мультиязычность ru/en
│   └── database/         # SQLAlchemy 2.0 async (SQLite/PostgreSQL)
│       ├── base.py       # движок, сессии, init/dispose
│       ├── models.py     # User, MessageLog, BroadcastJob, Setting
│       └── repositories.py  # весь доступ к данным
├── modules/              # подключаемые фичи (берёшь нужные)
│   ├── users/            # регистрация/учёт (middleware)
│   ├── common/           # /start, /help, /cancel, эхо
│   ├── admin/            # админ-панель, бан/разбан
│   ├── statistics/       # DAU/WAU/MAU, новые/активные
│   ├── broadcast/        # массовые рассылки
│   ├── referral/         # реферальные ссылки, учёт приглашённых
│   ├── support/          # тикеты поддержки (юзер ↔ админ)
│   ├── scheduler/        # отложенные посты/рассылки + фоновый цикл
│   ├── payments/         # оплата: Telegram Stars и провайдеры
│   ├── shop/             # магазин: каталог, корзина, заказы
│   ├── captcha/          # антибот-капча для групп
│   └── moderation/       # модерация групп: ban/mute/warn + антифлуд
├── platforms/            # адаптеры мессенджеров
│   ├── telegram/         # 🟢 aiogram: фабрики Bot/Dispatcher, раннер
│   ├── instagram/        # 🟢 Instagram API (Graph v26.0): клиент, вебхук, раннер
│   └── max/              # 🟢 MAX Bot API: long polling + webhook
└── templates/            # готовые боты «под ключ»
    ├── telegram_starter/ # минимальный
    ├── telegram_full/    # админка, стата, рассылки, магазин, оплата, рефералка, поддержка
    └── telegram_group/   # модератор группы: капча + модерация + антифлуд
```

## Запуск за 4 шага

```bash
cd bots/python
cp .env.example .env          # заполни BOT_TOKEN и ADMIN_IDS
pip install -r requirements.txt
python templates/telegram_full/main.py
```

## Проверка сборки (смоук-тест)

Без токена и сети — проверяет, что всё импортируется, диспетчер собирается и БД поднимается:

```bash
cd bots/python
pip install -r requirements.txt
python tests/smoke_test.py     # → SMOKE TEST PASSED
```

## Тесты (pytest)

Без токенов и сети: БД — SQLite in-memory, HTTP и Telegram замоканы (`tests/conftest.py`).

```bash
cd bots/python
pip install -r requirements-dev.txt   # requirements.txt + pytest, pytest-asyncio
pytest                                # tests/test_*.py
```

| Файл | Что проверяет |
|------|---------------|
| `tests/test_repositories.py` | репозитории `core/database/repositories.py` |
| `tests/test_services.py` | сервисы broadcast / scheduler (атомарный захват) / statistics / payments |
| `tests/test_handlers.py` | хендлеры всех Telegram-модулей через `Dispatcher.feed_update` |
| `tests/test_background.py` | пул фоновой обработки вебхуков `platforms/background.py` |
| `tests/test_instagram.py` | клиент, подпись, парсинг и эндпоинт вебхука `platforms/instagram` |
| `tests/test_max.py` | клиент, загрузка файлов, парсинг, эндпоинт вебхука и polling `platforms/max` |

Вебхуки проверяются напрямую через эндпоинт (`handle_post`) — сокеты не открываются.

## Миграции БД (Alembic)

Схема описана миграциями в `migrations/versions/`; URL берётся из `DATABASE_URL` (`.env`),
движок и metadata — из `core/database/base.py`. Запуск — из `bots/python`:

```bash
alembic upgrade head        # новая БД: создать схему (делай ДО первого запуска бота)
alembic stamp 0001          # БД уже создана ботом через init_db() — пометить как актуальную
alembic check               # модели и миграции совпадают → "No new upgrade operations detected."
alembic revision --autogenerate -m "описание"   # после изменения моделей
alembic downgrade -1        # откатить последнюю миграцию
```

`0001_initial` — текущая схема без изменений: users, message_logs, broadcast_jobs, settings +
таблицы модулей payments, shop, support, scheduler. Новая таблица в модуле → добавь импорт её
`models.py` в `migrations/env.py`. Подробнее: [`docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md).

## Переключение SQLite → PostgreSQL

Меняешь одну строку в `.env`, код не трогаешь:

```env
# было (dev):
DATABASE_URL=sqlite+aiosqlite:///data/bot.sqlite3
# стало (prod):
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/botdb
```

## Как нейросети добавить модуль к боту

1. Скопировать папку модуля из `modules/` (если проект отдельный).
2. В `main.py`:
   ```python
   from modules.admin import router as admin_router
   dp.include_router(admin_router)   # ДО common_router (у него эхо на всё)
   ```
3. Убедиться, что `UserMiddleware` подключён (даёт `session` и `db_user` в хендлеры).

## Контракт модуля

Каждый модуль:
- экспортирует `router` (aiogram Router) и/или middleware через `__init__.py`;
- получает в хендлеры `session: AsyncSession` и `db_user: User` от `UserMiddleware`;
- не пишет SQL напрямую — только через репозитории из `core.database.repositories`;
- админские модули защищены фильтром `IsAdmin` (доступ по `ADMIN_IDS`).

## Точки расширения

| Хочу | Где менять |
|------|-----------|
| Новые тексты/язык | `core/i18n.py` (TRANSLATIONS) |
| Новая таблица | `core/database/models.py` + репозиторий |
| Новая метрика | `core/database/repositories.py` → `StatsRepository` |
| Webhook вместо polling | `platforms/telegram/runner.py` (внизу пример) |
| Хранить FSM в Redis | `platforms/telegram/bot.py` → RedisStorage |
