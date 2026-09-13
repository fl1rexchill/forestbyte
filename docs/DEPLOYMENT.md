# 🚀 Деплой (Python-стек)

Всё ниже относится к `bots/python/`. Рабочая директория процесса — **всегда `bots/python`**:
оттуда читается `.env` (`core/config.py` → `BASE_DIR / ".env"`), а относительные пути
`DATABASE_URL=sqlite+aiosqlite:///data/bot.sqlite3` и `LOG_FILE=logs/bot.log` считаются от cwd.

## Подготовка сервера

```bash
cd /opt/devbase/bots/python
python3.11 -m venv .venv            # Python 3.11+ (StrEnum в моделях)
.venv/bin/pip install -r requirements.txt
cp .env.example .env                # BOT_TOKEN, ADMIN_IDS, DATABASE_URL ...
.venv/bin/alembic upgrade head      # схема БД — ДО первого запуска
```

Почему миграции до старта: раннеры (`platforms/*/runner.py`) вызывают `init_db()`, а он делает
`create_all` — создаст таблицы без записи в `alembic_version`. Если бот уже запускался без
Alembic, пометь существующую схему: `alembic stamp 0001`, затем `alembic check`.

## systemd

`/etc/systemd/system/devbase-bot.service`:

```ini
[Unit]
Description=DevBase Telegram bot (telegram_full)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=bot
WorkingDirectory=/opt/devbase/bots/python
ExecStartPre=/opt/devbase/bots/python/.venv/bin/alembic upgrade head
ExecStart=/opt/devbase/bots/python/.venv/bin/python templates/telegram_full/main.py
Restart=always
RestartSec=5
# Логи идут и в journald (stdout), и в LOG_FILE с ротацией 5 МБ × 3 (core/logger.py)

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now devbase-bot
journalctl -u devbase-bot -f
```

**Один процесс на бота.** Внешних хранилищ (Redis, очередей) в базе нет — часть состояния
живёт в памяти процесса и теряется при перезапуске. Оба стека (Python и Node) устроены одинаково:

| Что в памяти | Что будет при рестарте | При двух процессах |
|--------------|------------------------|--------------------|
| FSM / сессии диалогов (рассылка, поддержка, корзина магазина) | диалог начинается заново, корзина пустая | у пользователя «разные» состояния в разных процессах |
| Таймеры капчи (`captcha`) | новичок остаётся ограниченным, пока его не разблокирует админ | — |
| Счётчики `/warn` и антифлуда (`moderation`) | обнуляются | считаются раздельно |
| Дедуп и очередь фоновой обработки вебхуков Instagram/MAX | принятые, но не обработанные события теряются (платформа уже получила 200) | повторная доставка может попасть в другой процесс |

Что **безопасно** и для нескольких процессов:
- `scheduler` — задачи забираются атомарно (`UPDATE … RETURNING`), каждая уйдёт один раз;
- данные в БД (пользователи, заказы, тикеты, платежи).

Если нужен горизонтальный масштаб — FSM выносится в Redis (`RedisStorage` в
`platforms/telegram/bot.py`, `storage` у grammY-сессии), остальное — в БД или очередь.

## Docker

Файлов Docker в репозитории нет. Минимальный образ:

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["sh", "-c", "alembic upgrade head && python templates/telegram_full/main.py"]
```

```bash
cd bots/python
docker build -t devbase-bot .
docker run -d --name bot --restart unless-stopped --env-file .env \
  -v bot-data:/app/data -v bot-logs:/app/logs devbase-bot
```

`.env` не копируй в образ — передавай через `--env-file`. Для SQLite обязателен volume на
`/app/data`, иначе база пропадёт при пересоздании контейнера.

## ⚠️ SQLite и параллельная запись

Instagram и MAX обрабатывают события параллельно (`workers=4`, `platforms/background.py`),
каждое событие — отдельная транзакция. SQLite-файл выдерживает это без потери данных, но
**пишет только одна транзакция за раз**: пока обработчик одного события работает внутри
сессии (например, ждёт ответа API после регистрации нового пользователя), запись остальных
воркеров стоит. Замер: обработчик, державший транзакцию 7 с, задержал второй воркер на те же
7 с — и в обычном режиме журнала, и в WAL.

- Instagram/MAX-бот с заметным трафиком или с долгими обработчиками — **PostgreSQL**
  (раздел ниже). Минимум — SQLite в режиме **WAL**: чтение (статистика, админка) перестаёт
  блокироваться записью, но одновременная запись всё равно идёт по одной.
- Telegram-бот тоже обрабатывает апдейты параллельно (aiogram `start_polling` по умолчанию
  `handle_as_tasks=True`), поэтому при заметном трафике рекомендация та же.
- `sqlite+aiosqlite:///:memory:` — только для тестов: там одно соединение на все сессии, и
  Instagram/MAX обрабатывают события строго по одному (`shares_db_connection()`).

WAL включается один раз и сохраняется в самом файле БД:

```bash
cd bots/python
.venv/bin/python -c "import sqlite3; print(sqlite3.connect('data/bot.sqlite3').execute('PRAGMA journal_mode=WAL').fetchone())"
# → ('wal',)
```

Рядом появятся `bot.sqlite3-wal` и `bot.sqlite3-shm` — копируй их вместе с базой при бэкапе
(volume на `/app/data` в Docker их уже покрывает).

## SQLite → PostgreSQL

1. Поставь драйвер (уже в `requirements.txt`: `asyncpg`).
2. Поменяй одну строку в `.env`:
   ```env
   DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/botdb
   ```
3. Создай схему: `alembic upgrade head`.
4. Перенос данных из SQLite инструментами репозитория не автоматизирован — используй
   внешний инструмент (например, `pgloader`) или скрипт на репозиториях, затем
   синхронизируй sequence'ы (`SELECT setval(...)`) для таблиц с автоинкрементом.

Код менять не нужно: `core/database/base.py` сам включает `pool_pre_ping` для PostgreSQL,
миграция `0001` проверена генерацией SQL под PostgreSQL (`alembic upgrade head --sql`).

## Вебхуки

Все три платформы требуют публичный **HTTPS** с сертификатом доверенного УЦ; приложение
слушает HTTP на локальном порту, TLS снимает reverse-proxy.

```nginx
server {
    listen 443 ssl;
    server_name bot.example.com;
    ssl_certificate     /etc/letsencrypt/live/bot.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bot.example.com/privkey.pem;

    location /tg/ { proxy_pass http://127.0.0.1:8080/; }   # Telegram
    location /ig/ { proxy_pass http://127.0.0.1:8081/; }   # Instagram
    location /max/ { proxy_pass http://127.0.0.1:8082/; }  # MAX
}
```

| Платформа | Запуск | Регистрация URL | Проверка запросов |
|-----------|--------|-----------------|-------------------|
| Telegram | закомментированный `run_webhook` в `platforms/telegram/runner.py` (aiogram `SimpleRequestHandler`) | `bot.set_webhook(url)` внутри примера | — |
| Instagram | `platforms.instagram.run_webhook(handle, port=8081)` | App Dashboard → Webhooks: Callback URL `https://bot.example.com/ig/webhook`, Verify token = `IG_VERIFY_TOKEN`; подписка `POST /me/subscribed_apps` | `X-Hub-Signature-256` (`IG_APP_SECRET`), GET-челлендж |
| MAX | `platforms.max.run_webhook(handle, port=8082, public_url="https://bot.example.com/max/webhook")` | `POST /subscriptions` при старте (если задан `public_url`) | `X-Max-Bot-Api-Secret` (`MAX_WEBHOOK_SECRET`) |

Особенности:
- **Instagram и MAX отвечают 200 сразу**, а события обрабатывают в фоне (пул воркеров,
  `workers=4` по умолчанию): медленный обработчик не вызывает повторных доставок.
  При остановке (SIGTERM) принятое дообрабатывается — давайте процессу несколько секунд
  (`TimeoutStopSec` в systemd, `--stop-timeout` в Docker).
- **MAX** принимает вебхуки только на порту **443**, ответ 200 нужен за 30 с; без успешной
  доставки 8 часов бот отписывается автоматически. Long polling при активной подписке не работает.
- **Instagram**: приложение Meta должно быть в режиме Live; Meta повторяет недоставленное до 36 ч.
- **Telegram**: polling и webhook взаимоисключающие; `drop_pending_updates=True` в обоих режимах.
  Задавайте `secret_token` (Python — пример в `platforms/telegram/runner.py`, Node —
  `TELEGRAM_WEBHOOK_SECRET`): Telegram пришлёт его в `X-Telegram-Bot-Api-Secret-Token`,
  запросы без него отклоняются.

## Проверка после деплоя

```bash
cd bots/python
.venv/bin/python tests/smoke_test.py   # → SMOKE TEST PASSED (без токена и сети)
.venv/bin/alembic current              # → 0001 (head)
```
