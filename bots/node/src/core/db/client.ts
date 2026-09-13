/**
 * Подключение к БД: Drizzle ORM поверх SQLite (better-sqlite3) или PostgreSQL (postgres.js).
 * Зеркало bots/python/core/database/base.py.
 *
 * Диалект определяется по DATABASE_URL — переключение одной строкой в .env:
 *   sqlite:///data/bot.sqlite3            (или sqlite+aiosqlite:///... из Python-стека)
 *   postgres://user:pass@host:5432/botdb  (или postgresql+asyncpg://... из Python-стека)
 *
 * Использование:
 *   import { initDb, getDb, disposeDb } from "../core/db/index.js";
 *   await initDb();          // при старте бота (создаёт таблицы)
 *   const db = getDb();      // в хендлерах / репозиториях
 *   await disposeDb();       // при остановке
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { type BetterSQLite3Database, drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { settings } from "../config.js";
import { getLogger } from "../logger.js";
import { allDdl } from "./ddl.js";
import { pgTables, sqliteTables, type Tables } from "./schema.js";

const log = getLogger("core.db");

export type Dialect = "sqlite" | "pg";

/**
 * Drizzle-клиент. Тип — SQLite-вариант; для PostgreSQL подставляется postgres-js клиент.
 * Поэтому в общем коде используется только API, общее для обоих драйверов:
 * `await db.orm.select()/insert()/update()/delete()...`, `.returning()`, `onConflictDo*`
 * (без sqlite-only `.get()/.all()/.run()` и без транзакций).
 */
export type Orm = BetterSQLite3Database;

export interface Db {
  orm: Orm;
  tables: Tables;
  dialect: Dialect;
}

export type DatabaseTarget = { dialect: "sqlite"; path: string } | { dialect: "pg"; url: string };

/** Разобрать DATABASE_URL (форматы Node и Python-стека). */
export function parseDatabaseUrl(url: string): DatabaseTarget {
  if (url.startsWith("sqlite")) {
    // как в Python: всё после ":///" — путь (относительный от cwd или абсолютный "/...")
    const dbPath = url.includes(":///")
      ? (url.split(":///").at(-1) ?? "")
      : url.replace(/^sqlite(\+\w+)?:(\/\/)?/, "");
    return { dialect: "sqlite", path: dbPath || ":memory:" };
  }
  const pgScheme = /^postgres(ql)?(\+\w+)?:\/\//;
  if (pgScheme.test(url)) {
    return { dialect: "pg", url: url.replace(pgScheme, "postgres://") };
  }
  throw new Error(
    `DATABASE_URL: неподдерживаемая схема "${url.split(":")[0]}" (нужна sqlite или postgres)`,
  );
}

interface Connection {
  db: Db;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

function connect(): Connection {
  const target = parseDatabaseUrl(settings.databaseUrl);

  if (target.dialect === "sqlite") {
    // Для SQLite гарантируем, что папка под файл БД существует
    if (target.path !== ":memory:") {
      fs.mkdirSync(path.dirname(path.resolve(target.path)), { recursive: true });
    }
    const sqlite = new Database(target.path);
    return {
      db: { orm: drizzleSqlite({ client: sqlite }), tables: sqliteTables, dialect: "sqlite" },
      exec: async (sql) => {
        sqlite.exec(sql);
      },
      close: async () => {
        sqlite.close();
      },
    };
  }

  // onnotice: не шуметь "relation already exists, skipping" на CREATE ... IF NOT EXISTS
  const client = postgres(target.url, { max: 10, onnotice: () => {} });
  const orm = drizzlePg({ client });
  return {
    db: {
      // Одинаковое во время выполнения API, разные типы диалектов — см. комментарий к Orm
      orm: orm as unknown as Orm,
      tables: pgTables as unknown as Tables,
      dialect: "pg",
    },
    exec: async (sql) => {
      await client.unsafe(sql);
    },
    close: () => client.end(),
  };
}

let current: Connection | null = null;

/** Текущее подключение (создаётся лениво, таблицы не трогает). */
export function getDb(): Db {
  current ??= connect();
  return current.db;
}

/** Создаёт все таблицы (для простых проектов; в проде — Alembic из Python-стека). */
export async function initDb(): Promise<void> {
  current ??= connect();
  for (const statement of allDdl(current.db.dialect)) {
    await current.exec(statement);
  }
  log.info("Database initialized (%s)", current.db.dialect === "sqlite" ? "sqlite" : "postgres");
}

/** Закрывает подключение при остановке приложения. */
export async function disposeDb(): Promise<void> {
  if (!current) return;
  const connection = current;
  current = null;
  await connection.close();
  log.info("Database connections disposed");
}

/** Минимум от Drizzle-клиента PostgreSQL, нужный для transaction(). */
interface TransactionalOrm {
  transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T>;
}

// Очередь SQLite-транзакций: на одном соединении они не должны пересекаться
let sqliteQueue: Promise<unknown> = Promise.resolve();

/**
 * Выполнить fn атомарно: либо все записи внутри, либо ни одной.
 *
 *  - PostgreSQL — транзакция Drizzle; в fn приходит db с транзакционным orm;
 *  - SQLite — BEGIN IMMEDIATE / COMMIT / ROLLBACK на единственном соединении better-sqlite3
 *    (Drizzle поддерживает для него только синхронные транзакции). Транзакции идут строго
 *    по очереди.
 *
 * Внутри fn — только запросы к БД через переданный tx: без сетевых вызовов (Telegram API)
 * и без вложенных transaction(). В SQLite запросы другого кода, выполненные во время
 * транзакции, попадут в неё — поэтому держите fn коротким.
 */
export async function transaction<T>(db: Db, fn: (tx: Db) => Promise<T>): Promise<T> {
  if (db.dialect === "pg") {
    const orm = db.orm as unknown as TransactionalOrm;
    return orm.transaction((tx) => fn({ ...db, orm: tx as Orm }));
  }

  const connection = current;
  if (!connection || connection.db !== db) {
    throw new Error("transaction(): db не является текущим подключением (getDb())");
  }
  const run = async (): Promise<T> => {
    await connection.exec("BEGIN IMMEDIATE");
    try {
      const result = await fn(db);
      await connection.exec("COMMIT");
      return result;
    } catch (err) {
      await connection.exec("ROLLBACK");
      throw err;
    }
  };
  const result = sqliteQueue.then(run, run);
  sqliteQueue = result.catch(() => undefined);
  return result;
}
