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
Node-стек использует ту же схему (Drizzle ORM) — оба стека могут работать с одной БД.

Общие гайды: [`docs/`](docs/) — соглашения, контракт модуля, как добавить модуль/платформу, деплой.
Боты рассчитаны на **один процесс на бота** (что живёт в памяти — `docs/DEPLOYMENT.md`).

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
| `admin/` | Режим админа: панель, пользователи всех платформ, `/ban <id> [платформа]`, доступ по ID из конфига | core.db, users | admin, panel, access-control |
| `statistics/` | Статистика: DAU/WAU/MAU, новые/активные — по всем платформам с разбивкой | core.db, users | stats, analytics, metrics |
| `broadcast/` | Массовые рассылки (Telegram): очередь, троттлинг, отчёт, отмена | core.db, users, admin | broadcast, mailing, queue |
| `referral/` | Реферальная система: deep-link `/start`, учёт приглашённых, `/ref` | core.db, users | referral, invite, deep-link |
| `support/` | Тикеты поддержки: юзер пишет → админ отвечает, история в БД | core.db, users, admin | support, tickets, helpdesk |
| `scheduler/` | Отложенные посты/рассылки (Telegram) + фоновый цикл; задачи забираются атомарно | core.db, users, admin | scheduler, cron, delayed |
| `payments/` | Оплата: Telegram Stars и провайдеры, pre_checkout, запись | core.db, users | payments, stars, invoice |
| `shop/` | Магазин: каталог, корзина, заказы, оплата в Stars | core.db, users, payments | shop, catalog, cart, orders, ecommerce |
| `captcha/` | Антибот-капча для новых участников группы (+кик по таймауту) | core | captcha, antibot, group |
| `moderation/` | Модерация групп: ban/kick/mute/warn + антифлуд | core | moderation, antiflood, group, mute |
| `common/` | Базовые хендлеры: /start, /help, echo, отмена FSM | core | common, start, help |

#### Платформы — `bots/python/platforms/` 
| Платформа | Статус | Заметки |
|-----------|--------|---------|
| `telegram/` | 🟢 | aiogram 3.x, polling + webhook (с `secret_token`) |
| `instagram/` | 🟢 | Instagram API with Instagram Login (Graph API v26.0): клиент, вебхук с проверкой `X-Hub-Signature-256` и фоновой обработкой, профиль собеседника. Нужен бизнес-аккаунт + Meta App |
| `max/` | 🟢 | MAX Bot API (`platform-api2.max.ru`): long polling + webhook (`X-Max-Bot-Api-Secret`, фоновая обработка), inline-клавиатуры, загрузка файлов |

#### Шаблоны — `bots/python/templates/` 
| Шаблон | Что внутри | Статус |
|--------|-----------|--------|
| `telegram_starter/` | Минимальный бот: /start, /help, БД юзеров | 🟢 |
| `telegram_full/` | Полный бот: users+admin+stats+broadcast+scheduler+shop+payments+referral+support | 🟢 |
| `telegram_group/` | Бот-модератор группы: captcha+moderation+антифлуд | 🟢 |

#### Миграции и тесты — `bots/python/` 🟢
| Что | Где | Теги |
|-----|-----|------|
| Миграции Alembic (async, SQLite/Postgres), `0001_initial` — текущая схема ядра и модулей | `alembic.ini`, `migrations/` | alembic, migrations, schema |
| Тесты pytest: репозитории, сервисы, хендлеры всех Telegram-модулей, клиенты и вебхуки Instagram/MAX — без сети и токенов | `tests/test_*.py`, `requirements-dev.txt` | tests, pytest, asyncio |
| Смоук-тест сборки | `tests/smoke_test.py` | smoke, ci |

---

### Node.js · стек grammY (TypeScript)

Расположение: [`bots/node/`](bots/node/) — зеркалит структуру Python (strict TypeScript,
Drizzle ORM, zod + dotenv, grammY Composer вместо Router).

#### Ядро — `bots/node/src/core/` 🟢
| Файл | Назначение | Теги |
|------|-----------|------|
| `config.ts` | Настройки из `.env`/окружения (zod + dotenv), те же переменные, что в Python | config, env, zod |
| `db/client.ts` | Drizzle: SQLite (better-sqlite3) / PostgreSQL (postgres.js) по `DATABASE_URL`; `transaction()` | db, drizzle, sqlite, postgres, transaction |
| `db/schema.ts` | users, message_logs, broadcast_jobs, settings — 1:1 с Python-моделями | db, schema, orm |
| `db/ddl.ts` | `CREATE TABLE IF NOT EXISTS` (тот же SQL, что у Alembic), `registerDdl` для модулей | db, ddl |
| `db/repositories.ts` | Репозитории с тем же набором методов, что в Python | db, repository, crud |
| `logger.ts` | Логирование (консоль + асинхронная запись в файл с ротацией) | logging |
| `i18n.ts` | Мультиязычность ru/en | i18n, localization |

#### Модули — `bots/node/src/modules/` 🟢
| Модуль | Что делает | Зависит от | Теги |
|--------|-----------|-----------|------|
| `users/` | `usersMiddleware`: регистрация, бан, лог сообщений, `ctx.db`/`ctx.dbUser` | core.db | users, middleware |
| `common/` | /start, /help, /cancel, эхо | core | common, start, help |
| `admin/` | Панель `/admin`, пользователи всех платформ, `/ban <id> [платформа]`, фильтр `isAdmin` | core.db, users | admin, panel |
| `statistics/` | `/stats`, кнопка `admin:stats`, `buildStatsText` — по всем платформам | core.db, admin | stats, analytics |
| `broadcast/` | Диалог рассылки + `runBroadcast` (троттлинг, 429/403) | core.db, admin | broadcast, mailing |
| `referral/` | Deep-link `/start <id>`, `/ref` | core.db, users | referral, deep-link |
| `support/` | Тикеты `/support`, `/reply`, `/close`, `/tickets` | core.db, admin | support, tickets |
| `scheduler/` | `/schedule` и фоновый цикл (хуки `onStartup`/`onShutdown`), атомарный захват задач | core.db, admin | scheduler, delayed |
| `payments/` | `/donate`, pre_checkout, запись оплат, `sendStarsInvoice` | core.db, users | payments, stars |
| `shop/` | Каталог, корзина, заказы (транзакцией), оплата в Stars | core.db, payments | shop, cart, orders |
| `captcha/` | Капча новичков группы + кик по таймауту | core | captcha, group |
| `moderation/` | ban/kick/mute/unmute/warn + антифлуд | core | moderation, antiflood |

#### Платформы — `bots/node/src/platforms/`
| Платформа | Статус | Заметки |
|-----------|--------|---------|
| `telegram/` | 🟢 | grammY: `createBot`/`createComposer`, polling + webhook, FSM на сессии, lifecycle-хуки, `hasUser` |
| `instagram/` | 🟢 | Зеркало Python: клиент Graph API v26.0, вебхук (`X-Hub-Signature-256`, фоновая обработка), профиль собеседника |
| `max/` | 🟢 | Зеркало Python: long polling + webhook, клавиатуры, загрузка файлов с повтором `attachment.not.ready` |

#### Шаблоны — `bots/node/src/templates/`
| Шаблон | Что внутри | Статус |
|--------|-----------|--------|
| `telegram_starter/` | Минимальный бот: /start, /help, БД юзеров | 🟢 |
| `telegram_full/` | users+admin+stats+broadcast+scheduler+shop+payments+referral+support | 🟢 |
| `telegram_group/` | captcha+moderation+антифлуд | 🟢 |

Тесты: `bots/node/tests/` (vitest) — ядро, репозитории, транзакции, все модули и шаблоны,
Instagram и MAX без сети; `npm run typecheck` проверяет типы и кода, и тестов.

---

## 🌐 САЙТЫ

Расположение: [`sites/`](sites/). Философия та же: самодостаточные блоки, копируешь и дополняешь.
Виджеты — на чистом JS (Web Components), падают в WordPress и на любой сайт.

### Виджеты — `sites/components/` 🟢
| Тег | Файл | Назначение | Теги |
|-----|------|-----------|------|
| `shared/tokens.css` | — | Дизайн-токены и темизация (`--fb-*`), тёмная тема | theme, tokens, css-vars, dark |
| `<fb-navbar>` | `navbar/fb-navbar.js` | Адаптивное меню: бургер, sticky, CTA | navbar, menu, responsive, burger |
| `<fb-footer>` | `footer/fb-footer.js` | Футер: колонки, соцсети, подписка | footer, socials, newsletter |
| `<fb-video-circles>` | `video-circles/fb-video-circles.js` | Кружки-видео как в Telegram | video, circles, telegram |
| `<fb-stories>` | `stories/fb-stories.js` | Сториз как в Instagram (прогресс, тапы, seen) | stories, instagram, viewer |
| `<fb-social-feed>` | `social-feed/fb-social-feed.js` | Лента постов из соцсетей (VK/TG/IG/YT) | feed, social, grid |
| `<fb-cookie-consent>` | `cookie-consent/fb-cookie-consent.js` | Баннер согласия 152-ФЗ/GDPR + события | cookie, consent, 152fz, gdpr |
| `<fb-reveal>` | `reveal/fb-reveal.js` | Появление при скролле (anime.js, stagger) | animation, scroll, reveal, anime |
| `<fb-counter>` | `counter/fb-counter.js` | Анимированный счётчик чисел (anime.js) | counter, stats, animation, anime |
| `<fb-faq>` | `faq/fb-faq.js` | Аккордеон FAQ с плавным раскрытием (anime.js) | faq, accordion, anime |
| `<fb-testimonials>` | `testimonials/fb-testimonials.js` | Слайдер отзывов (anime.js, автоплей) | testimonials, reviews, slider, anime |
| `<fb-modal>` | `modal/fb-modal.js` | Попап/модалка (anime.js): load/delay/exit/клик | modal, popup, lead, anime |

Общее: `shared/tokens.css` (палитра без фиолетового + токены человечных кнопок),
`shared/anim.js` (мягкая загрузка anime.js v4). Демо: `sites/components/demo/index.html`
(базовые) и `demo/widgets2.html` (анимированные) — проверены в браузере.

### Юр-шаблоны — `sites/legal/` 🟢
| Файл | Что | Теги |
|------|-----|------|
| `privacy-policy-152fz.md` | Политика обработки ПД (152-ФЗ), плейсхолдеры | 152fz, privacy, legal |
| `consent-personal-data.md` | Согласие на обработку ПД + чекбокс для форм | consent, forms, 152fz |
| `cookie-policy.md` | Политика cookie | cookie, legal |

### Интеграции CRM — `sites/integrations/crm/` 🟢
| CRM | Файлы | Как подключить | Теги |
|-----|-------|----------------|------|
| Bitrix24 | `bitrix24/bitrix24.php` · `bitrix24.js` | `bitrix24/TUTORIAL.md` (входящий вебхук, 1 ссылка) | crm, bitrix24, lead, webhook |
| amoCRM | `amocrm/amocrm.php` · `amocrm.js` | `amocrm/TUTORIAL.md` (поддомен + долгосрочный токен) | crm, amocrm, lead, oauth |

Единый интерфейс `createLead({name, phone, email, comment, title})` в PHP и Node.

### WordPress — `sites/wordpress/` 🟢
| Компонент | Расположение | Что даёт |
|-----------|-------------|----------|
| Плагин Forestbyte | `wordpress/plugin/forestbyte/` | Админ-панель (цвет/тема/CRM), шорткоды всех виджетов, форма-заявка → CRM (Bitrix24/amoCRM) + e-mail + антиспам. Самодостаточен (виджеты и CRM-адаптеры внутри). |
| Стартовая тема | `wordpress/theme/forestbyte-starter/` | Адаптивный каркас + демо-главная на шорткодах |
| Туториал установки | `wordpress/TUTORIAL.md` | Пошагово «на пальцах»: установка, настройка, CRM |
| Сборка ZIP | `wordpress/build-zips.sh` | Готовые архивы для загрузки в админку |

Шорткоды: `[fb_lead_form]`, `[fb_stories]`, `[fb_video_circles]`, `[fb_social_feed]`,
`[fb_testimonials]`, `[fb_faq]`, `[fb_counter]`, `[fb_cookie_consent]`, `[fb_reveal]`, `[fb_modal]`.

### Сайты под 10 ниш — `sites/niches/` 🟢
10 готовых функциональных сайтов (фитнес, мастер на час, автосервис, одежда, тату, клининг, косметология, кейтеринг, салон красоты, ветклиника) на общем ядре `_shared/core.js` + сервер заявок без зависимостей `server/server.mjs` (Telegram, CRM-адаптеры, занятость слотов, публичный статус) + CRM-панель `crm/` + оглавление `index.html`. Запуск: `node sites/niches/server/server.mjs`. Подробно — `sites/niches/README.md`, типичные ошибки ИИ — `sites/niches/AI_MISTAKES.md`.

### Клиентский сайт WAVE — `sites/wave/` 🟢
Сайт бренда мебели для ванной WAVE (waverus.ru) на основе шаблона «Этюд» (`sites/niches/cosmetology`), светлая палитра. Статический генератор без зависимостей (`_src/build.mjs` → `public/`): главная, коллекция, 4 карточки товаров, контакты, документы по 152-ФЗ. Полное SEO (title/description, canonical, Open Graph, schema.org Organization/FurnitureStore/Product/FAQPage/BreadcrumbList, sitemap.xml, robots.txt с Clean-param), шрифты локально, Яндекс Метрика только после согласия, приём заявок `public/api/lead.php`. Подробно — `sites/wave/README.md`.

### В работе 🟡
| Раздел | Расположение | Статус |
|--------|-------------|--------|
| Полные шаблоны (vanilla / Next.js) | `sites/templates/` | 🟡 |

---

## 🏷 Индекс по задачам (быстрый поиск)

Пути: Python — `bots/python/…`, Node.js — `bots/node/src/…` (одинаковые имена модулей и шаблонов).

| «Мне нужно...» | Python | Node.js |
|----------------|--------|---------|
| Просто запустить бота с /start | `bots/python/templates/telegram_starter` | `bots/node/src/templates/telegram_starter` |
| Бот с админкой, статой и рассылками | `bots/python/templates/telegram_full` | `bots/node/src/templates/telegram_full` |
| Бот-модератор группы | `bots/python/templates/telegram_group` | `bots/node/src/templates/telegram_group` |
| Добавить админ-панель к своему боту | `bots/python/modules/admin` | `bots/node/src/modules/admin` |
| Считать активных пользователей (все платформы) | `bots/python/modules/statistics` | `bots/node/src/modules/statistics` |
| Разослать сообщение всем | `bots/python/modules/broadcast` | `bots/node/src/modules/broadcast` |
| Отложенная рассылка по времени | `bots/python/modules/scheduler` | `bots/node/src/modules/scheduler` |
| Реферальная программа | `bots/python/modules/referral` | `bots/node/src/modules/referral` |
| Поддержка/тикеты в боте | `bots/python/modules/support` | `bots/node/src/modules/support` |
| Приём оплаты (звёзды/деньги) | `bots/python/modules/payments` | `bots/node/src/modules/payments` |
| Магазин/продажи в боте | `bots/python/modules/shop` (+ `payments`) | `bots/node/src/modules/shop` (+ `payments`) |
| Защита группы от ботов | `bots/python/modules/captcha` | `bots/node/src/modules/captcha` |
| Модерация группы / антифлуд | `bots/python/modules/moderation` | `bots/node/src/modules/moderation` |
| Хранить пользователей в БД | `bots/python/modules/users` + `core/database` | `bots/node/src/modules/users` + `core/db` |
| Переключиться SQLite → Postgres | `DATABASE_URL` в `bots/python/.env` | `DATABASE_URL` в `bots/node/.env` |
| Бот на Instagram | `bots/python/platforms/instagram` | `bots/node/src/platforms/instagram` |
| Бот на MAX | `bots/python/platforms/max` | `bots/node/src/platforms/max` |
| Отправить файл/картинку в MAX | `MaxClient.send_file` | `MaxClient.sendFile` |
| Несколько записей атомарно | сессия `get_session()` | `transaction()` из `core/db` |
| Миграции схемы БД | `bots/python/migrations` → `alembic upgrade head` | (схему ведёт Alembic из Python) |
| Запустить тесты | `cd bots/python && pytest` | `cd bots/node && npm test` |
| Правила кода и контракт модуля | `docs/CONVENTIONS.md`, `docs/MODULE_CONTRACT.md` | то же |
| Добавить свой модуль / платформу | `docs/ADDING_MODULE.md`, `docs/ADDING_PLATFORM.md` | то же |
| Задеплоить (systemd, Docker, вебхуки) | `docs/DEPLOYMENT.md` | то же |

### Сайты — быстрый поиск

| «Мне нужно...» | Бери |
|----------------|------|
| Адаптивное меню / футер | `sites/components/navbar` · `sites/components/footer` |
| Кружки-видео как в Telegram | `sites/components/video-circles` |
| Сториз как в Instagram | `sites/components/stories` |
| Лента из соцсетей | `sites/components/social-feed` |
| Баннер cookie / согласие 152-ФЗ | `sites/components/cookie-consent` |
| Анимация появления при скролле | `sites/components/reveal` |
| Анимированные цифры/статистика | `sites/components/counter` |
| FAQ-аккордеон | `sites/components/faq` |
| Отзывы (слайдер) | `sites/components/testimonials` |
| Попап/лид-магнит | `sites/components/modal` |
| Форма-заявка → CRM | `sites/wordpress` (шорткод `[fb_lead_form]`) |
| Подключить Bitrix24 | `sites/integrations/crm/bitrix24/TUTORIAL.md` |
| Подключить amoCRM | `sites/integrations/crm/amocrm/TUTORIAL.md` |
| Сайт на WordPress (плагин+тема) | `sites/wordpress/` → `TUTORIAL.md` |
| Политика конфиденциальности 152-ФЗ | `sites/legal/privacy-policy-152fz.md` |
| Согласие на обработку ПД (форма) | `sites/legal/consent-personal-data.md` |
| Перекрасить виджеты под бренд | `sites/components/shared/tokens.css` (`--fb-*`) |
| Статический сайт-каталог с SEO и 152-ФЗ «под ключ» | `sites/wave/` (генератор `_src/build.mjs`) |
