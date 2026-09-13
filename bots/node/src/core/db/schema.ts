/**
 * Схема таблиц ядра — 1:1 с bots/python/core/database/models.py.
 *
 * Drizzle описывает таблицы отдельно для каждого диалекта (sqlite-core / pg-core), поэтому
 * здесь две равнозначные схемы с одинаковыми именами таблиц, колонок и JS-свойств.
 * Тип строк (`User`, `MessageLog`...) один — проверка `SameRow` внизу гарантирует это при
 * компиляции. Репозитории пишутся против SQLite-типов и работают с обоими диалектами.
 *
 * Совместимость с Python-стеком:
 *  - те же имена таблиц/колонок/индексов, что создаёт Alembic (миграция 0001);
 *  - в SQLite дата хранится строкой "YYYY-MM-DD HH:MM:SS.ffffff" (UTC) — как у SQLAlchemy,
 *    поэтому Node- и Python-боты могут работать с одной БД;
 *  - значения по умолчанию задаются в приложении ($defaultFn), как default= в SQLAlchemy:
 *    в DDL нет DEFAULT.
 */
import {
  bigint,
  boolean,
  index as pgIndex,
  integer as pgInteger,
  pgTable,
  text as pgText,
  uniqueIndex as pgUniqueIndex,
  serial,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import {
  customType,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// --------------------------------------------------------------------------- общее

/** Источник пользователя/сообщения. */
export const Platform = {
  TELEGRAM: "telegram",
  INSTAGRAM: "instagram",
  MAX: "max",
} as const;
export type Platform = (typeof Platform)[keyof typeof Platform];

export const utcnow = (): Date => new Date();

const pad = (value: number, width = 2): string => String(value).padStart(width, "0");

/** Date → строка DATETIME в формате SQLAlchemy/SQLite (UTC, микросекунды). */
export function toSqliteDateTime(date: Date): string {
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.` +
    pad(date.getUTCMilliseconds() * 1000, 6)
  );
}

/** Строка DATETIME SQLAlchemy/SQLite → Date (время считается UTC). */
export function fromSqliteDateTime(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?/.exec(value);
  if (!m) return new Date(value);
  const ms = m[7] ? Number(m[7].padEnd(6, "0").slice(0, 3)) : 0;
  return new Date(
    Date.UTC(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
      Number(m[6]),
      ms,
    ),
  );
}

/** Колонка DATETIME для SQLite в формате SQLAlchemy (используют и модели модулей). */
export const sqliteDateTime = customType<{ data: Date; driverData: string }>({
  dataType: () => "DATETIME",
  toDriver: toSqliteDateTime,
  fromDriver: fromSqliteDateTime,
});

// --------------------------------------------------------------------------- SQLite

export const sqliteUsers = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey(),
    platform: text("platform", { length: 20 })
      .notNull()
      .$defaultFn(() => Platform.TELEGRAM),
    externalId: integer("external_id", { mode: "number" }).notNull(),
    username: text("username", { length: 255 }),
    firstName: text("first_name", { length: 255 }),
    lastName: text("last_name", { length: 255 }),
    languageCode: text("language_code", { length: 10 }),
    // external_id пригласившего (реферальная система, модуль referral)
    referredBy: integer("referred_by", { mode: "number" }),
    isAdmin: integer("is_admin", { mode: "boolean" })
      .notNull()
      .$defaultFn(() => false),
    isBanned: integer("is_banned", { mode: "boolean" })
      .notNull()
      .$defaultFn(() => false),
    // активен = не заблокировал бота (для рассылок)
    isActive: integer("is_active", { mode: "boolean" })
      .notNull()
      .$defaultFn(() => true),
    createdAt: sqliteDateTime("created_at").notNull().$defaultFn(utcnow),
    lastSeenAt: sqliteDateTime("last_seen_at").notNull().$defaultFn(utcnow).$onUpdateFn(utcnow),
  },
  (t) => [
    uniqueIndex("ix_users_platform_external").on(t.platform, t.externalId),
    index("ix_users_external_id").on(t.externalId),
  ],
);

export const sqliteMessageLogs = sqliteTable(
  "message_logs",
  {
    id: integer("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => sqliteUsers.id, { onDelete: "cascade" }),
    platform: text("platform", { length: 20 })
      .notNull()
      .$defaultFn(() => Platform.TELEGRAM),
    text: text("text"),
    contentType: text("content_type", { length: 30 })
      .notNull()
      .$defaultFn(() => "text"),
    createdAt: sqliteDateTime("created_at").notNull().$defaultFn(utcnow),
  },
  (t) => [index("ix_message_logs_created_at").on(t.createdAt)],
);

export const sqliteBroadcastJobs = sqliteTable("broadcast_jobs", {
  id: integer("id").primaryKey(),
  createdBy: integer("created_by", { mode: "number" }).notNull(), // external_id админа
  platform: text("platform", { length: 20 })
    .notNull()
    .$defaultFn(() => Platform.TELEGRAM),
  text: text("text").notNull(),
  // pending/running/done/cancelled
  status: text("status", { length: 20 })
    .notNull()
    .$defaultFn(() => "pending"),
  total: integer("total")
    .notNull()
    .$defaultFn(() => 0),
  sent: integer("sent")
    .notNull()
    .$defaultFn(() => 0),
  failed: integer("failed")
    .notNull()
    .$defaultFn(() => 0),
  createdAt: sqliteDateTime("created_at").notNull().$defaultFn(utcnow),
  finishedAt: sqliteDateTime("finished_at"),
});

export const sqliteSettings = sqliteTable("settings", {
  key: text("key", { length: 100 }).primaryKey(),
  value: text("value"),
  updatedAt: sqliteDateTime("updated_at").notNull().$defaultFn(utcnow).$onUpdateFn(utcnow),
});

// --------------------------------------------------------------------------- PostgreSQL

export const pgUsers = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    platform: varchar("platform", { length: 20 })
      .notNull()
      .$defaultFn(() => Platform.TELEGRAM),
    externalId: bigint("external_id", { mode: "number" }).notNull(),
    username: varchar("username", { length: 255 }),
    firstName: varchar("first_name", { length: 255 }),
    lastName: varchar("last_name", { length: 255 }),
    languageCode: varchar("language_code", { length: 10 }),
    referredBy: bigint("referred_by", { mode: "number" }),
    isAdmin: boolean("is_admin")
      .notNull()
      .$defaultFn(() => false),
    isBanned: boolean("is_banned")
      .notNull()
      .$defaultFn(() => false),
    isActive: boolean("is_active")
      .notNull()
      .$defaultFn(() => true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .$defaultFn(utcnow),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "date" })
      .notNull()
      .$defaultFn(utcnow)
      .$onUpdateFn(utcnow),
  },
  (t) => [
    pgUniqueIndex("ix_users_platform_external").on(t.platform, t.externalId),
    pgIndex("ix_users_external_id").on(t.externalId),
  ],
);

export const pgMessageLogs = pgTable(
  "message_logs",
  {
    id: serial("id").primaryKey(),
    userId: pgInteger("user_id")
      .notNull()
      .references(() => pgUsers.id, { onDelete: "cascade" }),
    platform: varchar("platform", { length: 20 })
      .notNull()
      .$defaultFn(() => Platform.TELEGRAM),
    text: pgText("text"),
    contentType: varchar("content_type", { length: 30 })
      .notNull()
      .$defaultFn(() => "text"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .$defaultFn(utcnow),
  },
  (t) => [pgIndex("ix_message_logs_created_at").on(t.createdAt)],
);

export const pgBroadcastJobs = pgTable("broadcast_jobs", {
  id: serial("id").primaryKey(),
  createdBy: bigint("created_by", { mode: "number" }).notNull(),
  platform: varchar("platform", { length: 20 })
    .notNull()
    .$defaultFn(() => Platform.TELEGRAM),
  text: pgText("text").notNull(),
  status: varchar("status", { length: 20 })
    .notNull()
    .$defaultFn(() => "pending"),
  total: pgInteger("total")
    .notNull()
    .$defaultFn(() => 0),
  sent: pgInteger("sent")
    .notNull()
    .$defaultFn(() => 0),
  failed: pgInteger("failed")
    .notNull()
    .$defaultFn(() => 0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(utcnow),
  finishedAt: timestamp("finished_at", { withTimezone: true, mode: "date" }),
});

export const pgSettings = pgTable("settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: pgText("value"),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(utcnow)
    .$onUpdateFn(utcnow),
});

// --------------------------------------------------------------------------- наборы и типы

export const sqliteTables = {
  users: sqliteUsers,
  messageLogs: sqliteMessageLogs,
  broadcastJobs: sqliteBroadcastJobs,
  settings: sqliteSettings,
};

export const pgTables = {
  users: pgUsers,
  messageLogs: pgMessageLogs,
  broadcastJobs: pgBroadcastJobs,
  settings: pgSettings,
};

/** Канонический тип набора таблиц (SQLite); для PostgreSQL подставляется pgTables. */
export type Tables = typeof sqliteTables;

export type User = typeof sqliteUsers.$inferSelect;
export type NewUser = typeof sqliteUsers.$inferInsert;
export type MessageLog = typeof sqliteMessageLogs.$inferSelect;
export type BroadcastJob = typeof sqliteBroadcastJobs.$inferSelect;
export type Setting = typeof sqliteSettings.$inferSelect;

// Проверка при компиляции: строки обоих диалектов имеют одинаковый тип (используют и модули)
export type SameRow<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const rowsMatch: [
  SameRow<typeof pgUsers.$inferSelect, User>,
  SameRow<typeof pgMessageLogs.$inferSelect, MessageLog>,
  SameRow<typeof pgBroadcastJobs.$inferSelect, BroadcastJob>,
  SameRow<typeof pgSettings.$inferSelect, Setting>,
] = [true, true, true, true];
void rowsMatch;
