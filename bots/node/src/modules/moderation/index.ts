/**
 * Модуль moderation: модерация групп (бан/кик/мут/варн + антифлуд).
 *
 * Подключение:
 *   import { composer as moderationComposer } from "../../modules/moderation/index.js";
 *   bot.use(moderationComposer);
 *
 * Требуется: бот — админ группы. Права проверяются по факту (админы чата).
 * Команды ответом на сообщение: /ban /kick /mute /unmute /warn.
 */
export { composer, FLOOD_LIMIT, FLOOD_WINDOW_MS, MAX_WARNS } from "./composer.js";
