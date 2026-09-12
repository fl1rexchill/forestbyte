# Шаблон: telegram_group

Бот-модератор для групп: капча новичков + модерация + антифлуд.

**Что внутри:**
- captcha — новый участник ограничивается, пока не нажмёт «Я человек» (иначе кик);
- moderation — команды ответом на сообщение: `/ban`, `/kick`, `/mute [мин]`, `/unmute`, `/warn`;
- антифлуд — авто-мут за слишком частые сообщения.

**Требования:** бот должен быть **администратором** группы с правами
ограничивать и банить участников.

**Запуск:**
```bash
cd bots/python
cp .env.example .env        # BOT_TOKEN
pip install -r requirements.txt
python templates/telegram_group/main.py
```

**Настройка:** время капчи и пороги флуда — в `modules/captcha/router.py`
и `modules/moderation/router.py` (константы вверху файлов).
