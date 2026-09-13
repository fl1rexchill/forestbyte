/** Модель отложенной публикации/рассылки (1:1 с bots/python/modules/scheduler/models.py). */
import {
  bigint,
  index as pgIndex,
  pgTable,
  text as pgText,
  serial,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import {
  type Db,
  pickTables,
  registerDdl,
  type SameRow,
  sqliteDateTime,
  utcnow,
} from "../../core/db/index.js";

export const sqliteScheduledPosts = sqliteTable(
  "scheduled_posts",
  {
    id: integer("id").primaryKey(),
    createdBy: integer("created_by", { mode: "number" }).notNull(), // external_id админа
    text: text("text").notNull(),
    // "all" — всем активным пользователям; иначе строковый chat_id
    target: text("target", { length: 64 })
      .notNull()
      .$defaultFn(() => "all"),
    runAt: sqliteDateTime("run_at").notNull(),
    status: text("status", { length: 20 })
      .notNull()
      .$defaultFn(() => "pending"), // pending/done/cancelled
    createdAt: sqliteDateTime("created_at").notNull().$defaultFn(utcnow),
  },
  (t) => [index("ix_scheduled_posts_run_at").on(t.runAt)],
);

export const pgScheduledPosts = pgTable(
  "scheduled_posts",
  {
    id: serial("id").primaryKey(),
    createdBy: bigint("created_by", { mode: "number" }).notNull(),
    text: pgText("text").notNull(),
    target: varchar("target", { length: 64 })
      .notNull()
      .$defaultFn(() => "all"),
    runAt: timestamp("run_at", { withTimezone: true, mode: "date" }).notNull(),
    status: varchar("status", { length: 20 })
      .notNull()
      .$defaultFn(() => "pending"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .$defaultFn(utcnow),
  },
  (t) => [pgIndex("ix_scheduled_posts_run_at").on(t.runAt)],
);

export type ScheduledPost = typeof sqliteScheduledPosts.$inferSelect;

const rowsMatch: SameRow<typeof pgScheduledPosts.$inferSelect, ScheduledPost> = true;
void rowsMatch;

const schedulerTables = {
  sqlite: { posts: sqliteScheduledPosts },
  pg: { posts: pgScheduledPosts },
};

/** Таблицы модуля под диалект подключения. */
export const tablesFor = (db: Db) => pickTables(db, schedulerTables);

registerDdl({
  sqlite: [
    `CREATE TABLE IF NOT EXISTS scheduled_posts (
    id INTEGER NOT NULL,
    created_by BIGINT NOT NULL,
    text TEXT NOT NULL,
    target VARCHAR(64) NOT NULL,
    run_at DATETIME NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id)
)`,
    "CREATE INDEX IF NOT EXISTS ix_scheduled_posts_run_at ON scheduled_posts (run_at)",
  ],
  pg: [
    `CREATE TABLE IF NOT EXISTS scheduled_posts (
    id SERIAL NOT NULL,
    created_by BIGINT NOT NULL,
    text TEXT NOT NULL,
    target VARCHAR(64) NOT NULL,
    run_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (id)
)`,
    "CREATE INDEX IF NOT EXISTS ix_scheduled_posts_run_at ON scheduled_posts (run_at)",
  ],
});
