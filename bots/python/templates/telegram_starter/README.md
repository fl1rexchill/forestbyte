# Шаблон: telegram_starter

Минимальный Telegram-бот. Точка старта для простых задач.

**Что внутри:** регистрация пользователей в БД, `/start`, `/help`, `/cancel`, эхо.

**Запуск:**
```bash
cd bots/python
cp .env.example .env        # достаточно BOT_TOKEN
pip install -r requirements.txt
python templates/telegram_starter/main.py
```

**Расширение:** подключай модули из `modules/` в `main.py`
(`admin`, `statistics`, `broadcast`) — см. `telegram_full` как пример.
