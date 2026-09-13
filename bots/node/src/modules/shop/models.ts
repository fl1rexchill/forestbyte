/**
 * Модели магазина: товары, заказы, позиции заказа (1:1 с Python shop/models.py).
 * Цены в Telegram Stars (целое число звёзд).
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

// --------------------------------------------------------------------------- SQLite

export const sqliteProducts = sqliteTable("shop_products", {
  id: integer("id").primaryKey(),
  title: text("title", { length: 255 }).notNull(),
  description: text("description")
    .notNull()
    .$defaultFn(() => ""),
  priceStars: integer("price_stars").notNull(), // цена в звёздах
  isActive: integer("is_active", { mode: "boolean" })
    .notNull()
    .$defaultFn(() => true),
  createdAt: sqliteDateTime("created_at").notNull().$defaultFn(utcnow),
});

export const sqliteOrders = sqliteTable("shop_orders", {
  id: integer("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => sqliteUsers.id, { onDelete: "cascade" }),
  status: text("status", { length: 20 })
    .notNull()
    .$defaultFn(() => "pending"), // pending/paid/cancelled
  totalStars: integer("total_stars")
    .notNull()
    .$defaultFn(() => 0),
  createdAt: sqliteDateTime("created_at").notNull().$defaultFn(utcnow),
});

export const sqliteOrderItems = sqliteTable("shop_order_items", {
  id: integer("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => sqliteOrders.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => sqliteProducts.id, { onDelete: "set null" }),
  title: text("title", { length: 255 }).notNull(), // снимок названия на момент заказа
  priceStars: integer("price_stars").notNull(), // снимок цены
  qty: integer("qty")
    .notNull()
    .$defaultFn(() => 1),
});

// --------------------------------------------------------------------------- PostgreSQL

export const pgProducts = pgTable("shop_products", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: pgText("description")
    .notNull()
    .$defaultFn(() => ""),
  priceStars: pgInteger("price_stars").notNull(),
  isActive: boolean("is_active")
    .notNull()
    .$defaultFn(() => true),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(utcnow),
});

export const pgOrders = pgTable("shop_orders", {
  id: serial("id").primaryKey(),
  userId: pgInteger("user_id")
    .notNull()
    .references(() => pgUsers.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 20 })
    .notNull()
    .$defaultFn(() => "pending"),
  totalStars: pgInteger("total_stars")
    .notNull()
    .$defaultFn(() => 0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(utcnow),
});

export const pgOrderItems = pgTable("shop_order_items", {
  id: serial("id").primaryKey(),
  orderId: pgInteger("order_id")
    .notNull()
    .references(() => pgOrders.id, { onDelete: "cascade" }),
  productId: pgInteger("product_id").references(() => pgProducts.id, { onDelete: "set null" }),
  title: varchar("title", { length: 255 }).notNull(),
  priceStars: pgInteger("price_stars").notNull(),
  qty: pgInteger("qty")
    .notNull()
    .$defaultFn(() => 1),
});

// --------------------------------------------------------------------------- типы

export type Product = typeof sqliteProducts.$inferSelect;
export type Order = typeof sqliteOrders.$inferSelect;
export type OrderItem = typeof sqliteOrderItems.$inferSelect;

const rowsMatch: [
  SameRow<typeof pgProducts.$inferSelect, Product>,
  SameRow<typeof pgOrders.$inferSelect, Order>,
  SameRow<typeof pgOrderItems.$inferSelect, OrderItem>,
] = [true, true, true];
void rowsMatch;

const shopTables = {
  sqlite: { products: sqliteProducts, orders: sqliteOrders, orderItems: sqliteOrderItems },
  pg: { products: pgProducts, orders: pgOrders, orderItems: pgOrderItems },
};

/** Таблицы модуля под диалект подключения. */
export const tablesFor = (db: Db) => pickTables(db, shopTables);

registerDdl({
  sqlite: [
    `CREATE TABLE IF NOT EXISTS shop_products (
    id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    price_stars INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id)
)`,
    `CREATE TABLE IF NOT EXISTS shop_orders (
    id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL,
    total_stars INTEGER NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
)`,
    `CREATE TABLE IF NOT EXISTS shop_order_items (
    id INTEGER NOT NULL,
    order_id INTEGER NOT NULL,
    product_id INTEGER,
    title VARCHAR(255) NOT NULL,
    price_stars INTEGER NOT NULL,
    qty INTEGER NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(order_id) REFERENCES shop_orders (id) ON DELETE CASCADE,
    FOREIGN KEY(product_id) REFERENCES shop_products (id) ON DELETE SET NULL
)`,
  ],
  pg: [
    `CREATE TABLE IF NOT EXISTS shop_products (
    id SERIAL NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    price_stars INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (id)
)`,
    `CREATE TABLE IF NOT EXISTS shop_orders (
    id SERIAL NOT NULL,
    user_id INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL,
    total_stars INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
)`,
    `CREATE TABLE IF NOT EXISTS shop_order_items (
    id SERIAL NOT NULL,
    order_id INTEGER NOT NULL,
    product_id INTEGER,
    title VARCHAR(255) NOT NULL,
    price_stars INTEGER NOT NULL,
    qty INTEGER NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(order_id) REFERENCES shop_orders (id) ON DELETE CASCADE,
    FOREIGN KEY(product_id) REFERENCES shop_products (id) ON DELETE SET NULL
)`,
  ],
});
