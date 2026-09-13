# 📜 Контракт модуля (Python-стек)

Развёрнутая версия раздела «Контракт модуля» из [`bots/python/README.md`](../bots/python/README.md).
Модуль, соблюдающий контракт, подключается к любому шаблону одной строкой `include_router`.

## 1. Экспорт через `__init__.py`

Модуль экспортирует aiogram `Router` под именем `router` и/или middleware — и больше ничего
не требует от шаблона.

```python
# modules/support/__init__.py
from modules.support.router import router
__all__ = ["router"]
```

Допустимы дополнительные экспорты:

| Экспорт | Зачем | Пример |
|---------|-------|--------|
| `setup(dp)` | фоновая задача на жизненном цикле бота (`dp.startup` / `dp.shutdown`) | `modules.scheduler.setup` |
| сервисные функции | переиспользование без хендлеров | `modules.payments.send_stars_invoice` |
| фильтры | защита чужих роутеров | `modules.admin.IsAdmin` |
| middleware | вместо роутера | `modules.users.UserMiddleware` |

## 2. Что модуль получает в хендлер

`UserMiddleware` (`modules/users/middleware.py`) вешается шаблоном на `dp.message` и
`dp.callback_query` и на каждый апдейт:

1. открывает `AsyncSession` (commit после успешного хендлера);
2. делает `UserRepository.get_or_create(...)` и обновляет профиль / `last_seen_at`;
3. останавливает забаненных (кроме админов) ответом `t("common.banned")`;
4. пишет входящее сообщение в `MessageLog` (для `statistics`);
5. передаёт в хендлер `session: AsyncSession` и `db_user: User`.

```python
@router.message(Command("ref"))
async def cmd_ref(message: Message, session: AsyncSession, db_user: User, bot: Bot) -> None:
    ...
```

Модуль **не** открывает свою сессию в хендлере и **не** регистрирует пользователя сам.
Исключение — долгие фоновые операции вне апдейта (рассылка, цикл планировщика): они сами
открывают короткие сессии через `get_session()` (см. `broadcast/service.py`).

## 3. Доступ к данным

- Таблицы ядра (`users`, `message_logs`, `broadcast_jobs`, `settings`) — **только** через
  репозитории `core/database/repositories.py`. SQL в хендлерах не пишется.
- Новая метрика или выборка по ядру → новый метод репозитория (например, в `StatsRepository`).
- Собственные таблицы модуль объявляет в своём `models.py` на общем `Base`; запросы к ним
  живут в `service.py`/`router.py` модуля (пример: `scheduler/service.py`).
- Таблица модуля регистрируется в `Base.metadata` при импорте `models.py` и должна быть
  добавлена в `bots/python/migrations/env.py` + отражена миграцией.

## 4. Доступ админа

Админские хендлеры защищены фильтром `IsAdmin` (`modules/admin/filters.py`) — проверяет
`from_user.id` по `ADMIN_IDS` из `.env`:

```python
# весь роутер — только админам (admin, statistics, broadcast, scheduler)
router.message.filter(IsAdmin())
router.callback_query.filter(IsAdmin())

# отдельные команды в пользовательском модуле (shop, support)
@router.message(Command("addproduct"), IsAdmin())
```

## 5. Порядок подключения

Роутеры проверяются по порядку `include_router`, поэтому модуль документирует своё место:

| Правило | Почему |
|---------|--------|
| `common` — последним | в нём эхо-хендлер на любое сообщение |
| `shop` раньше `payments` | заказы оплачиваются с payload `order:<id>`, иначе платёж заберёт `payments` |
| `referral` раньше `common` | ловит `/start <payload>` |
| `payments`, `support` раньше `common` | иначе сообщения съест эхо |

Эталон порядка — `templates/telegram_full/main.py`.

## 5a. То же в Node.js

- Модуль экспортирует `composer`; хендлеры, которым нужен пользователь, вешаются на
  `composer.filter(hasUser)` — там `ctx.db` и `ctx.dbUser` типизированы и гарантированно есть.
  Без `usersMiddleware` такой апдейт просто проходит дальше, а не падает.
- Несколько связанных записей (заказ + позиции, тикет + сообщение) — в `transaction(db, fn)`
  из `core/db`; внутри — только запросы к БД, без вызовов Telegram API.
- Админское — `composer.filter(hasUser).filter(isAdmin)` или `.command(...).filter(isAdmin, ...)`.

## 6. Тексты и платформа

- Тексты пользователю — через `t("<модуль>.<ключ>", locale=...)` из `core/i18n.py`.
  Локаль: `db_user.language_code or settings.default_locale`.
- Данные пишутся с полем `platform` (`Platform.TELEGRAM` и т.д.).
  Текущие модули aiogram/grammY-специфичны (роутеры, `Bot`), для Instagram/MAX используется
  та же БД и репозитории, а логика вызывается из обработчика платформы.
- Что читается из общей БД, учитывает все платформы: `statistics` и раздел «Пользователи»
  в `admin` показывают разбивку telegram/instagram/max, `/ban <id> [платформа]`, `referral`
  считает в платформе пользователя (`db_user.platform`). Рассылка и `scheduler` доставляют
  только в Telegram — через Telegram-бота.
- Пользовательский текст в ответах с `parse_mode=HTML` — только экранированный
  (`html.escape` / `message.html_text` в Python, `escapeHtml` / `messageHtml` в Node).

## 7. Документация и проверка

- Докстринг `__init__.py`: что делает, блок «Подключение:», команды, требования
  (права бота, место в порядке роутеров).
- Модуль импортируется в `tests/smoke_test.py` через шаблон и покрывается тестом
  `tests/test_*.py`, если у него есть сервис или свои таблицы.
- Строка в таблице модулей `KNOWLEDGE_BASE.md` и запись в «Индексе по задачам».

## Чек-лист

- [ ] `__init__.py` экспортирует `router` (и `setup`, если есть фон)
- [ ] хендлеры принимают `session` / `db_user`, не открывают свои сессии
- [ ] таблицы ядра — только через репозитории
- [ ] админское — под `IsAdmin`
- [ ] место в порядке `include_router` указано в докстринге
- [ ] новые таблицы — в `migrations/env.py` + миграция
- [ ] тексты — через `t()`
- [ ] строка в `KNOWLEDGE_BASE.md`
