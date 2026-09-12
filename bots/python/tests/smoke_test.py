"""Смоук-тест базы ботов: импорт всех модулей, сборка dispatcher, init БД, CRUD.

Не требует реального токена и сети. Проверяет, что всё собирается и БД поднимается.

Запуск:
    cd bots/python
    pip install -r requirements.txt
    python tests/smoke_test.py
"""
from __future__ import annotations

import asyncio
import os
import sys
import tempfile
from pathlib import Path

# Корень стека (bots/python) в путь + тестовое окружение ДО импорта core.config
PYTHON_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PYTHON_ROOT))

os.environ.setdefault("BOT_TOKEN", "123456:DUMMY_TOKEN_FOR_TESTS")
os.environ.setdefault("ADMIN_IDS", "111,222")
_tmp_db = Path(tempfile.gettempdir()) / "devbase_smoke.sqlite3"
_tmp_db.unlink(missing_ok=True)
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_tmp_db.as_posix()}"
os.environ["LOG_FILE"] = ""


async def main() -> None:
    from core.config import settings

    assert settings.admin_ids == [111, 222], settings.admin_ids
    assert settings.is_admin(111) and not settings.is_admin(999)
    print("[ok] config + admin_ids")

    from templates.telegram_full.main import build  # noqa: E402

    bot, dp = build()
    print("[ok] telegram_full build(): dispatcher собран со всеми модулями")

    import modules.captcha  # noqa: F401,E402
    import modules.moderation  # noqa: F401,E402

    print("[ok] captcha + moderation импортированы")

    from core.database.base import Base, dispose_db, get_session, init_db  # noqa: E402

    await init_db()
    tables = sorted(Base.metadata.tables.keys())
    print(f"[ok] init_db, таблиц: {len(tables)}")
    print("     " + ", ".join(tables))

    from core.database.models import Platform  # noqa: E402
    from core.database.repositories import UserRepository  # noqa: E402

    async with get_session() as s:
        _, created = await UserRepository(s).get_or_create(
            platform=Platform.TELEGRAM, external_id=555, first_name="Тест"
        )
    assert created is True
    async with get_session() as s:
        cnt = await UserRepository(s).count(Platform.TELEGRAM)
    assert cnt == 1, cnt
    print(f"[ok] репозиторий: пользователь создан, count={cnt}")

    await bot.session.close()
    await dispose_db()
    _tmp_db.unlink(missing_ok=True)
    print("\nSMOKE TEST PASSED")


if __name__ == "__main__":
    asyncio.run(main())
