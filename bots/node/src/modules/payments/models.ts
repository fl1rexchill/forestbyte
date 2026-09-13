/** Модель платежа (общая для Stars и провайдерских оплат), 1:1 с Python payments/models.py. */
import { integer as pgInteger, pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import {
  type Db,
  pgUsers,
  pickTables,
  registerDdl,
  type SameRow,
  sqliteDateTime,
  sqliteUsers,
  utcnow,
} from "../../core/db/index.js";

// Для валют вроде RUB/USD amount хранится в минимальных единицах (копейки/центы).
// Для Telegram Stars (XTR) amount = число звёзд.
export const sqlitePayments = sqliteTable("payments", {
  id: integer("id").primaryKey(),
  userId: integer("user_id").references(() => sqliteUsers.id, { onDelete: "set null" }),
  amount: integer("amount").notNull(),
  currency: text("currency", { length: 10 })
    .notNull()
    .$defaultFn(() => "XTR"),
  payload: text("payload", { length: 255 })
    .notNull()
    .$defaultFn(() => ""),
  telegramChargeId: text("telegram_charge_id", { length: 255 }),
  status: text("status", { length: 20 })
    .notNull()
    .$defaultFn(() => "paid"),
  createdAt: sqliteDateTime("created_at").notNull().$defaultFn(utcnow),
});

export const pgPayments = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: pgInteger("user_id").references(() => pgUsers.id, { onDelete: "set null" }),
  amount: pgInteger("amount").notNull(),
  currency: varchar("currency", { length: 10 })
    .notNull()
    .$defaultFn(() => "XTR"),
  payload: varchar("payload", { length: 255 })
    .notNull()
    .$defaultFn(() => ""),
  telegramChargeId: varchar("telegram_charge_id", { length: 255 }),
  status: varchar("status", { length: 20 })
    .notNull()
    .$defaultFn(() => "paid"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(utcnow),
});

export type Payment = typeof sqlitePayments.$inferSelect;

const rowsMatch: SameRow<typeof pgPayments.$inferSelect, Payment> = true;
void rowsMatch;

const paymentTables = { sqlite: { payments: sqlitePayments }, pg: { payments: pgPayments } };

/** Таблицы модуля под диалект подключения. */
export const tablesFor = (db: Db) => pickTables(db, paymentTables);

registerDdl({
  sqlite: [
    `CREATE TABLE IF NOT EXISTS payments (
    id INTEGER NOT NULL,
    user_id INTEGER,
    amount INTEGER NOT NULL,
    currency VARCHAR(10) NOT NULL,
    payload VARCHAR(255) NOT NULL,
    telegram_charge_id VARCHAR(255),
    status VARCHAR(20) NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL
)`,
  ],
  pg: [
    `CREATE TABLE IF NOT EXISTS payments (
    id SERIAL NOT NULL,
    user_id INTEGER,
    amount INTEGER NOT NULL,
    currency VARCHAR(10) NOT NULL,
    payload VARCHAR(255) NOT NULL,
    telegram_charge_id VARCHAR(255),
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL
)`,
  ],
});
