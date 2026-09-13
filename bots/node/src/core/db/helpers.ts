/** Вспомогательные функции слоя БД для модулей. */
import type { Db } from "./client.js";
import type { User } from "./schema.js";

/**
 * Выбрать набор таблиц модуля под диалект текущего подключения.
 * Тип — SQLite-вариант (как у db.tables), см. комментарий к Orm в client.ts.
 *
 *   const t = pickTables(ctx.db, { sqlite: { tickets: sqliteTickets }, pg: { tickets: pgTickets } });
 */
export function pickTables<T>(db: Db, sets: { sqlite: T; pg: unknown }): T {
  return (db.dialect === "pg" ? sets.pg : sets.sqlite) as T;
}

/** Отображаемое имя пользователя — как свойство User.full_name в Python. */
export function userFullName(
  user: Pick<User, "firstName" | "lastName" | "username" | "externalId">,
): string {
  const parts = [user.firstName, user.lastName].filter(Boolean);
  return parts.join(" ") || user.username || `id${user.externalId}`;
}
