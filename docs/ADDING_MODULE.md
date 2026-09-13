# ➕ Как добавить модуль (Python-стек)

Пример — модуль `feedback`: пользователь пишет `/feedback <текст>`, отзыв сохраняется,
админ смотрит `/feedbacks`. Перед началом прочитай [MODULE_CONTRACT.md](MODULE_CONTRACT.md).

## 1. Папка и `__init__.py`

```
bots/python/modules/feedback/
├── __init__.py
├── models.py     # только если нужна своя таблица
└── router.py
```

```python
# modules/feedback/__init__.py
"""Модуль feedback: отзывы пользователей.

Подключение (ДО common_router):
    from modules.feedback import router as feedback_router
    dp.include_router(feedback_router)

Пользователь: /feedback <текст>. Админ: /feedbacks — последние 10 отзывов.
"""
from modules.feedback.router import router

__all__ = ["router"]
```

## 2. Своя таблица (если нужна)

```python
# modules/feedback/models.py
"""Модель отзыва. Регистрируется в общей metadata при импорте модуля."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column

from core.database.base import Base
from core.database.models import utcnow


class Feedback(Base):
    __tablename__ = "feedback_items"          # префикс модуля

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
```

Затем — миграция:

1. Добавь `import modules.feedback.models  # noqa: E402,F401` в `bots/python/migrations/env.py`.
2. Сгенерируй и проверь:
   ```bash
   cd bots/python
   alembic revision --autogenerate -m "feedback"
   alembic upgrade head
   alembic check          # → No new upgrade operations detected.
   ```

Без Alembic таблица тоже появится: `init_db()` вызывает `create_all` на старте раннера —
но только если `models.py` импортирован до этого (его импортирует `router.py`).

## 3. Роутер

```python
# modules/feedback/router.py
"""Хендлеры отзывов."""
from __future__ import annotations

from aiogram import Router
from aiogram.filters import Command, CommandObject
from aiogram.types import Message
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database.models import User
from modules.admin import IsAdmin
from modules.feedback.models import Feedback

router = Router(name="feedback")


@router.message(Command("feedback"))
async def cmd_feedback(
    message: Message, command: CommandObject, session: AsyncSession, db_user: User
) -> None:
    text = (command.args or "").strip()
    if not text:
        await message.answer("Напишите: /feedback <текст>")
        return
    session.add(Feedback(user_id=db_user.id, text=text))   # commit сделает UserMiddleware
    await message.answer("Спасибо!")


@router.message(Command("feedbacks"), IsAdmin())
async def cmd_feedbacks(message: Message, session: AsyncSession) -> None:
    rows = await session.scalars(select(Feedback).order_by(Feedback.id.desc()).limit(10))
    await message.answer("\n".join(f"#{f.id}: {f.text}" for f in rows) or "Пусто")
```

Правила из контракта: `session`/`db_user` приходят от `UserMiddleware`; к таблицам ядра —
только через `core.database.repositories`; админское — под `IsAdmin`; тексты для
мультиязычности выносятся ключами `"feedback.*"` в `core/i18n.py`.

## 4. Подключение к шаблону

```python
# templates/<твой_бот>/main.py
from modules.feedback import router as feedback_router
...
dp.include_router(feedback_router)   # ДО common_router
dp.include_router(common_router)
```

## 5. Тест

```python
# tests/test_feedback.py
from sqlalchemy import select

from core.database.base import get_session
from core.database.repositories import UserRepository
from modules.feedback.models import Feedback


async def test_feedback_saved(db):
    async with get_session() as s:
        user, _ = await UserRepository(s).get_or_create(platform="telegram", external_id=1)
        s.add(Feedback(user_id=user.id, text="супер"))
    async with get_session() as s:
        assert (await s.scalar(select(Feedback))).text == "супер"
```

Фикстура `db` создаёт таблицы в SQLite in-memory — добавь импорт `modules.feedback.models`
в неё (`tests/conftest.py`), как сделано для payments/shop/support/scheduler.
Для хендлеров/сервисов, которые шлют сообщения, используй `FakeBot` из `tests/conftest.py`.

```bash
cd bots/python && pytest && python tests/smoke_test.py
```

## 6. Документация

- Строка в таблице «Модули» `KNOWLEDGE_BASE.md` (что делает, зависимости, теги).
- Запись в «Индексе по задачам» (`| Сбор отзывов | modules/feedback |`).
- Если модуль входит в шаблон — обнови его `README.md`.
