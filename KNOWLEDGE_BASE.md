# 📖 KNOWLEDGE BASE — Манифест решений

> Это **карта** всех готовых решений. Нейросеть читает этот файл первым, находит нужный
> модуль/шаблон по задаче и тегам, затем открывает его `README.md`.

Легенда статусов: 🟢 готово · 🟡 в работе · ⚪ запланировано

---

## 🤖 БОТЫ

### Общие принципы

- **Ядро (`core/`)** — общее для всех ботов стека: конфиг, слой БД, логи, i18n. Копируется целиком.
- **Модули (`modules/`)** — независимые фичи. Подключаются к боту как роутеры/плагины. Берёшь только нужные.
- **Платформы (`platforms/`)** — тонкие адаптеры под API мессенджера. Логика живёт в модулях.
- **Шаблоны (`templates/`)** — собранные боты «под ключ» из ядра + модулей. Точка старта.

Слой БД един: **SQLAlchemy 2.0 async**. По умолчанию SQLite (`aiosqlite`), для продакшена —
PostgreSQL (`asyncpg`), переключается одной строкой в `.env` (`DATABASE_URL`).

---

### Python · стек aiogram 3.x

Расположение: [`bots/python/`](bots/python/)

#### Ядро — `bots/python/core/` 🟢
| Файл | Назначение | Теги |
|------|-----------|------|
| `config.py` | Загрузка настроек из `.env`/окружения (pydantic-settings) | config, env, settings |
| `database/base.py` | Async-движок SQLAlchemy, сессии, init/dispose. SQLite+Postgres | db, sqlalchemy, async, sqlite, postgres |
| `database/models.py` | Модели: User, MessageLog, BroadcastJob, Setting | db, models, orm |
| `database/repositories.py` | Репозитории (CRUD) поверх моделей | db, repository, crud |
| `logger.py` | Структурное логирование (консоль + файл) | logging, observability |
| `i18n.py` | Простая мультиязычность (ru/en, расширяемо) | i18n, localization |

#### Модули — `bots/python/modules/` 🟢
| Модуль | Что делает | Зависит от | Теги |
|--------|-----------|-----------|------|
| `users/` | Регистрация/учёт пользователей, автозапись при `/start`, бан/разбан | core.db | users, registration, ban |
| `admin/` | Режим админа: панель, управление, доступ по ID из конфига | core.db, users | admin, panel, access-control |
| `statistics/` | Статистика: DAU/WAU/MAU, новые/активные, графики-выгрузки | core.db, users | stats, analytics, metrics |
| `broadcast/` | Массовые рассылки: очередь, троттлинг, отчёт, отмена | core.db, users, admin | broadcast, mailing, queue |
| `referral/` | Реферальная система: deep-link `/start`, учёт приглашённых, `/ref` | core.db, users | referral, invite, deep-link |
| `support/` | Тикеты поддержки: юзер пишет → админ отвечает, история в БД | core.db, users, admin | support, tickets, helpdesk |
| `scheduler/` | Отложенные посты/рассылки по времени + фоновый цикл | core.db, users, admin | scheduler, cron, delayed |
| `payments/` | Оплата: Telegram Stars и провайдеры, pre_checkout, запись | core.db, users | payments, stars, invoice |
| `shop/` | Магазин: каталог, корзина, заказы, оплата в Stars | core.db, users, payments | shop, catalog, cart, orders, ecommerce |
| `captcha/` | Антибот-капча для новых участников группы (+кик по таймауту) | core | captcha, antibot, group |
| `moderation/` | Модерация групп: ban/kick/mute/warn + антифлуд | core | moderation, antiflood, group, mute |
| `common/` | Базовые хендлеры: /start, /help, echo, отмена FSM | core | common, start, help |

#### Платформы — `bots/python/platforms/` 
| Платформа | Статус | Заметки |
|-----------|--------|---------|
| `telegram/` | 🟢 | aiogram 3.x, polling + webhook |
| `instagram/` | 🟡 | Instagram Graph API (Messaging). Нужен бизнес-аккаунт + Meta App |
| `max/` | 🟡 | MAX Bot API (max.ru). Long-polling/webhook |

#### Шаблоны — `bots/python/templates/` 
| Шаблон | Что внутри | Статус |
|--------|-----------|--------|
| `telegram_starter/` | Минимальный бот: /start, /help, БД юзеров | 🟢 |
| `telegram_full/` | Полный бот: users+admin+stats+broadcast+scheduler+shop+payments+referral+support | 🟢 |
| `telegram_group/` | Бот-модератор группы: captcha+moderation+антифлуд | 🟢 |

---

### Node.js · стек grammY (TypeScript)

Расположение: [`bots/node/`](bots/node/) — 🟡 зеркалит структуру Python.

---

## 🌐 САЙТЫ

Расположение: [`sites/`](sites/) — ⚪ запланировано (следующий крупный этап).

---

## 🏷 Индекс по задачам (быстрый поиск)

| «Мне нужно...» | Бери |
|----------------|------|
| Просто запустить бота с /start | `templates/telegram_starter` |
| Бот с админкой, статой и рассылками | `templates/telegram_full` |
| Добавить админ-панель к своему боту | `modules/admin` |
| Считать активных пользователей | `modules/statistics` |
| Разослать сообщение всем | `modules/broadcast` |
| Отложенная рассылка по времени | `modules/scheduler` |
| Реферальная программа | `modules/referral` |
| Поддержка/тикеты в боте | `modules/support` |
| Приём оплаты (звёзды/деньги) | `modules/payments` |
| Магазин/продажи в боте | `modules/shop` (+ `payments`) |
| Защита группы от ботов | `modules/captcha` |
| Модерация группы / антифлуд | `modules/moderation` |
| Хранить пользователей в БД | `modules/users` + `core/database` |
| Переключиться SQLite → Postgres | поменять `DATABASE_URL` в `.env` |
| Бот на Instagram | `platforms/instagram` (🟡) |
| Бот на MAX | `platforms/max` (🟡) |
