# Шаблон: telegram_full

Полноценный Telegram-бот «под ключ». Собран из ядра и всех основных модулей.

**Что внутри:** регистрация пользователей, `/start`/`/help`, админ-панель (`/admin`),
статистика (`/stats`), рассылки (`/broadcast`), бан/разбан (`/ban`, `/unban`), эхо.

**Запуск:**
```bash
cd bots/python
cp .env.example .env        # BOT_TOKEN + ADMIN_IDS обязательны
pip install -r requirements.txt
python templates/telegram_full/main.py
```

**Убрать ненужный модуль:** удали соответствующий `dp.include_router(...)` в `main.py`.

**Добавить свой:** создай `modules/<имя>/` с `router`, подключи в `main.py` до `common_router`.
