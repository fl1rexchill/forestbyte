/**
 * Модели модуля support (1:1 с bots/python/modules/support/models.py).
 * DDL регистрируется при импорте модуля — initDb() создаст таблицы.
 */
import {
  boolean,
  integer as pgInteger,
  pgTable,
  text as pgText,
  serial,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
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

export const sqliteTickets = sqliteTable("support_tickets", {
  id: integer("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => sqliteUsers.id, { onDelete: "cascade" }),
  status: text("status", { length: 20 })
    .notNull()
    .$defaultFn(() => "open"), // open / closed
  createdAt: sqliteDateTime("created_at").notNull().$defaultFn(utcnow),
});

export const sqliteTicketMessages = sqliteTable("support_messages", {
  id: integer("id").primaryKey(),
  ticketId: integer("ticket_id")
    .notNull()
    .references(() => sqliteTickets.id, { onDelete: "cascade" }),
  fromAdmin: integer("from_admin", { mode: "boolean" })
    .notNull()
    .$defaultFn(() => false),
  text: text("text").notNull(),
  createdAt: sqliteDateTime("created_at").notNull().$defaultFn(utcnow),
});

export const pgTickets = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  userId: pgInteger("user_id")
    .notNull()
    .references(() => pgUsers.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 20 })
    .notNull()
    .$defaultFn(() => "open"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(utcnow),
});

export const pgTicketMessages = pgTable("support_messages", {
  id: serial("id").primaryKey(),
  ticketId: pgInteger("ticket_id")
    .notNull()
    .references(() => pgTickets.id, { onDelete: "cascade" }),
  fromAdmin: boolean("from_admin")
    .notNull()
    .$defaultFn(() => false),
  text: pgText("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(utcnow),
});

export type Ticket = typeof sqliteTickets.$inferSelect;
export type TicketMessage = typeof sqliteTicketMessages.$inferSelect;

const rowsMatch: [
  SameRow<typeof pgTickets.$inferSelect, Ticket>,
  SameRow<typeof pgTicketMessages.$inferSelect, TicketMessage>,
] = [true, true];
void rowsMatch;

const supportTables = {
  sqlite: { tickets: sqliteTickets, messages: sqliteTicketMessages },
  pg: { tickets: pgTickets, messages: pgTicketMessages },
};

/** Таблицы модуля под диалект подключения. */
export const tablesFor = (db: Db) => pickTables(db, supportTables);

registerDdl({
  sqlite: [
    `CREATE TABLE IF NOT EXISTS support_tickets (
    id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
)`,
    `CREATE TABLE IF NOT EXISTS support_messages (
    id INTEGER NOT NULL,
    ticket_id INTEGER NOT NULL,
    from_admin BOOLEAN NOT NULL,
    text TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(ticket_id) REFERENCES support_tickets (id) ON DELETE CASCADE
)`,
  ],
  pg: [
    `CREATE TABLE IF NOT EXISTS support_tickets (
    id SERIAL NOT NULL,
    user_id INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
)`,
    `CREATE TABLE IF NOT EXISTS support_messages (
    id SERIAL NOT NULL,
    ticket_id INTEGER NOT NULL,
    from_admin BOOLEAN NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(ticket_id) REFERENCES support_tickets (id) ON DELETE CASCADE
)`,
  ],
});
