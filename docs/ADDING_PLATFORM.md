# 🔌 Как добавить платформу (Python-стек)

Платформа — тонкий адаптер между API мессенджера и общим ядром. Логика бота не живёт
в платформе. Эталоны: `platforms/instagram/` (только webhook) и `platforms/max/`
(long polling + webhook). `platforms/telegram/` — особый случай: там всё делает aiogram.

## Структура

```
bots/python/platforms/<name>/
├── __init__.py   # докстринг: требования, эндпоинты, как переиспользовать ядро; реэкспорт
├── client.py     # HTTP-клиент API
├── webhook.py    # проверка запросов, нормализация событий, aiohttp-приложение
├── runner.py     # запуск (polling/webhook), учёт пользователей, роутинг в обработчик
└── README.md     # назначение, требования, переменные, быстрый старт, точки расширения
```

## 0. Документация API

Сначала найди **официальную** документацию и зафиксируй в докстринге `client.py`:
базовый URL, версию API, способ авторизации, лимиты, ссылку и дату сверки. Всё, что
документация не подтверждает однозначно, помечается в коде:

```python
# TODO-VERIFY: <что именно не подтверждено и где смотреть>
```

## 1. `client.py`

Шаблон — `platforms/max/client.py`:

- `__init__(token=None, *, base_url=..., session=None)`: токен по умолчанию из `settings`,
  предупреждение в лог, если его нет;
- один приватный `_request(...)`: заголовки авторизации, `resp.json(content_type=None)`,
  лог ошибок `>= 400`, **ответ возвращается, а не бросается**;
- `session: aiohttp.ClientSession | None` — внешняя сессия для переиспользования
  соединений и для тестов (`FakeHttpSession`);
- публичные методы — по одному на действие (`send_text`, `send_keyboard`, …), лимиты API —
  константами в начале файла.

## 2. `webhook.py`

- функции проверки запроса: подпись/секрет (`hmac.compare_digest`), челлендж подписки;
- `@dataclass(slots=True)` нормализованного события (`IncomingMessage`, `MaxUpdate`) с полями
  `platform`, id отправителя, `text`, `content_type`, `payload`, `raw`;
- `parse_*()` — чистая функция JSON → список событий (легко тестируется);
- `create_webhook_app(handler, *, path, secret...)` — `aiohttp.web.Application`;
  ошибка обработчика логируется, но ответ всё равно 200 (иначе платформа будет ретраить).

## 3. `runner.py`

`make_dispatcher(handler, client)` повторяет `UserMiddleware` Telegram-стека:

1. дедуп повторной доставки (по id сообщения / callback);
2. `async with get_session()`;
3. `UserRepository.get_or_create(platform=..., external_id=..., is_admin=settings.is_admin(...))`;
4. забаненным — `t("common.banned")` и стоп;
5. `MessageRepository.log(...)` — чтобы `statistics` считал и эту платформу;
6. `await handler(event, Context(client, session, db_user))`.

Функции запуска по образцу `platforms/telegram/runner.py`: `init_db()` → работа →
`finally: dispose_db()`. Для webhook — `web.AppRunner` + `TCPSite` + `asyncio.Event().wait()`;
`build_app(...)` отдельно, чтобы встраивать в свой сервер и тестировать.

## 3a. Фоновая обработка: `platforms/background.py`

Вебхук должен отвечать быстро (MAX ждёт 200 не дольше 30 с, Meta повторяет недоставленное),
поэтому эталонные платформы отвечают 200 сразу, а события отдают в `KeyedWorkerPool` —
переиспользуй его, а не пиши свою очередь:

```python
from platforms.background import KeyedWorkerPool

self._pool = KeyedWorkerPool(self._run, workers=workers, name="<name>")
await self._pool.start()                    # on_startup приложения
self._pool.submit(event.sender_id, event)   # в handle_post, затем сразу 200
await self._pool.stop()                     # on_cleanup: дообработать принятое
```

- ключ — id отправителя (или чата): события одного ключа идут по порядку, разных — параллельно
  (`workers` воркеров, по умолчанию 4);
- ошибка обработчика логируется и не останавливает воркер;
- очередь живёт в памяти процесса: при падении принятые события теряются (`docs/DEPLOYMENT.md`).

**Параллельные воркеры — это параллельные сессии БД.** Каждое событие открывает свою
`get_session()`, поэтому важно, какая БД под ботом:

| БД | Что происходит при параллельной записи | Что делать |
|----|----------------------------------------|-----------|
| SQLite `:memory:` (тесты) | одно соединение (`StaticPool`) на все сессии: закрытая сессия делает ROLLBACK и **молча** стирает незакоммиченные записи другой, `commit()` той проходит без ошибки | сессии по одной, если `shares_db_connection()` — см. ниже |
| SQLite-файл | у сессий свои соединения, записи не теряются, но одновременно пишет только одна транзакция: долгий обработчик внутри сессии задерживает запись остальных воркеров | при заметном трафике — WAL или PostgreSQL (`docs/DEPLOYMENT.md`) |
| PostgreSQL | транзакции параллельны | — |

`make_dispatcher` новой платформы обязан повторить защиту из `platforms/max/runner.py`:

```python
db_lock = asyncio.Lock() if shares_db_connection() else contextlib.nullcontext()

async def dispatch(event) -> None:
    async with db_lock, get_session() as session:
        ...
```

Блокировать только `commit()` недостаточно: чужой ROLLBACK стирает уже сделанный flush
(INSERT пользователя в `get_or_create`). На файловой SQLite и PostgreSQL блокировки нет —
параллельность воркеров сохраняется.

## 4. Ядро: что уже есть и что трогать нельзя

| Нужно | Как |
|-------|-----|
| Значение `platform` | `Platform` в `core/database/models.py` — `StrEnum` поверх колонки `String(20)`. Новое значение — правка ядра (согласовать); колонка принимает любую строку, миграция не нужна |
| `external_id` | `BigInteger` — id пользователя должен быть числом int64. Строковые id — только с отдельным согласованием схемы |
| Токен/секреты | поля в `core/config.py` (правка ядра) **или**, как `MAX_WEBHOOK_SECRET`, чтение из окружения/`.env` в `runner.py`; строка в `.env.example` — всегда |
| Тексты | `core.i18n.t` |

## 5. Тесты

`tests/test_<name>.py` по образцу `tests/test_max.py`:

- клиент с `FakeHttpSession` — проверяются URL, заголовки, параметры, тело;
- `parse_*` на примерах JSON из документации;
- приложение вебхука через `aiohttp.test_utils.TestClient(TestServer(app))` (только 127.0.0.1)
  + фикстура `db`: регистрация пользователя, `MessageLog`, дедуп, бан;
- цикл polling — с подменённым клиентом и отменой задачи.

Токены для тестов — фиктивные, в `os.environ.update(...)` в `tests/conftest.py`.

## 6. Документация

- `platforms/<name>/README.md` — формат как у `platforms/instagram/README.md`.
- Строка в таблице «Платформы» `KNOWLEDGE_BASE.md` и `bots/python/README.md`, запись в
  «Индексе по задачам», статус в таблице `README.md` корня.
