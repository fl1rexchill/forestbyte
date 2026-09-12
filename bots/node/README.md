# 🟢 Node.js-боты (grammY + TypeScript) — 🟡 в работе

Зеркалит архитектуру Python-стека (`bots/python`), но на TypeScript.

Планируемая структура:
```
bots/node/
├── src/
│   ├── core/         # config (zod/env), db (Drizzle/Prisma, SQLite+PG), logger, i18n
│   ├── modules/      # users, common, admin, statistics, broadcast
│   ├── platforms/    # telegram (grammY), instagram, max
│   └── templates/    # telegram_starter, telegram_full
├── package.json
└── tsconfig.json
```

Соответствие стеков:
| Python | Node |
|--------|------|
| aiogram 3.x | grammY |
| SQLAlchemy async | Drizzle ORM |
| pydantic-settings | zod + dotenv |
| Router | grammY Composer |
| middleware | grammY middleware |

> Статус: каркас будет добавлен после согласования Python-стека как эталона.
> Логика и контракты модулей — те же, что в `bots/python/README.md`.
