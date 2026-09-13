# 📐 Соглашения по коду (Python-стек)

Правила выведены из существующего кода `bots/python/`. Новый код пишется так же —
перед созданием файла открой соседний и повтори его стиль.

## Язык и версия

- **Python 3.11+** — `core/database/models.py` использует `enum.StrEnum`. Смоук-тест
  проверен на 3.14 (см. комментарий в `requirements.txt`).
- Первая строка кода каждого модуля: `from __future__ import annotations`.
- Типы — встроенные дженерики и `X | None`: `list[int]`, `dict[str, Any]`, `str | None`.
- Комментарии, докстринги, README и тексты логов — **на русском**. Идентификаторы — на английском.

## Структура файла

```python
"""Одна строка: что это.

Абзац: как устроено / ограничения.

Подключение / Использование:
    from modules.x import router as x_router
    dp.include_router(x_router)
"""
from __future__ import annotations

import ...                      # stdlib
from aiogram import ...         # сторонние
from core.config import settings  # свои: core → modules → platforms

log = get_logger(__name__)      # если модуль логирует
```

- Докстринг модуля обязателен и содержит блок **«Подключение:»** или **«Использование:»**
  с готовым к копированию кодом (см. `modules/*/__init__.py`, `core/database/base.py`).
- Константы модуля — `UPPER_CASE` в начале файла (`CHECK_INTERVAL` в `scheduler/service.py`,
  `GRAPH_API_VERSION` в `platforms/instagram/client.py`).
- Разделители секций в длинных файлах: `# ----...---- название`.

## Именование

| Что | Правило | Пример |
|-----|---------|--------|
| Папка модуля | существительное, snake_case | `modules/broadcast/`, `modules/support/` |
| Роутер | `router = Router(name="<модуль>")` | `modules/referral/router.py` |
| Таблица ядра | snake_case, мн. число | `users`, `message_logs`, `broadcast_jobs` |
| Таблица модуля | префикс модуля | `shop_products`, `shop_orders`, `support_tickets` |
| Репозиторий | `<Сущность>Repository` | `UserRepository`, `StatsRepository` |
| Ключ i18n | `"<модуль>.<строка>"` | `"start.hello"`, `"common.banned"` |
| callback_data | `"<модуль>:<действие>"` | `admin:stats`, `admin:broadcast` |
| Платформа | значение `Platform` | `"telegram"`, `"instagram"`, `"max"` |

## Раскладка модуля

Используются только нужные файлы из набора:

| Файл | Содержимое | Где есть |
|------|-----------|----------|
| `__init__.py` | докстринг-инструкция + реэкспорт `router` (и `setup`, хелперов) в `__all__` | все модули |
| `router.py` | aiogram-хендлеры | почти все |
| `service.py` | логика без хендлеров, переиспользуемая (рассылка, счета, фон. цикл) | broadcast, scheduler, statistics, payments |
| `models.py` | ORM-модели модуля на общем `Base` | payments, shop, support, scheduler |
| `keyboards.py` | фабрики клавиатур | admin, shop |
| `states.py` | FSM-состояния | broadcast |
| `filters.py` | фильтры | admin (`IsAdmin`) |
| `middleware.py` | aiogram-middleware | users |

Отдельного `README.md` у модуля нет — документация живёт в докстринге `__init__.py`.
У платформ и шаблонов README есть.

## Конфигурация и секреты

- Все настройки — `from core.config import settings` (pydantic-settings, `.env` в `bots/python/`).
- Новая переменная окружения → строка в `bots/python/.env.example` с комментарием.
- Токены никогда не хардкодятся и не логируются.

## База данных

- Модели: SQLAlchemy 2.0, `Mapped[...]` + `mapped_column(...)`, время — `DateTime(timezone=True)`
  с `default=utcnow` из `core.database.models`.
- Сессия: `async with get_session() as session:` — commit при выходе без ошибки, rollback при ошибке.
  В хендлерах сессию даёт `UserMiddleware` (аргумент `session`).
- Таблицы ядра — только через репозитории `core/database/repositories.py`, SQL в хендлерах не пишем.
- Схема меняется только миграцией Alembic (`bots/python/migrations/`).

## Логирование и ошибки

- `log = get_logger(__name__)`; формат и файл настраивает `core/logger.py`.
- Широкий `except Exception` допустим только там, где одна ошибка не должна ронять цикл
  (рассылка, фоновые задачи, обработка вебхука), и помечается `# noqa: BLE001`.
- HTTP-клиенты платформ не бросают исключения на ошибки API — логируют и возвращают JSON.

## Тесты

- `bots/python/tests/test_*.py`, pytest + pytest-asyncio (`asyncio_mode = auto`).
- Без сети и токенов: БД — SQLite in-memory (фикстура `db`), HTTP — `FakeHttpSession`,
  Telegram — `FakeBot` из `tests/conftest.py`.
- `tests/smoke_test.py` — отдельный скрипт, запускается как `python tests/smoke_test.py`.
