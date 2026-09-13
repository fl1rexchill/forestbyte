/**
 * Модуль users: регистрация и учёт пользователей.
 *
 * Подключение (в bot bootstrap) — на сообщения и колбэки, ДО остальных модулей:
 *   import { usersMiddleware } from "../../modules/users/index.js";
 *   bot.on(["message", "callback_query"], usersMiddleware());
 *
 * После этого в любой хендлер приходят:
 *   ctx.db      — подключение к БД (для репозиториев)
 *   ctx.dbUser  — строка пользователя из таблицы users
 */
export { contentTypeOf, usersMiddleware } from "./middleware.js";
