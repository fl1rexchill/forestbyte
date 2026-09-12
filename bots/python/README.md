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
│   ├── instagram/        # 🟡 Instagram Graph API
│   └── max/              # 🟡 MAX Bot API
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
