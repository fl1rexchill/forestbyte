/**
 * Модуль common: базовые команды /start, /help, /cancel и эхо-ответ.
 *
 * Подключение:
 *   import { composer as commonComposer } from "../../modules/common/index.js";
 *   bot.use(commonComposer);
 *
 * Важно: подключай ПОСЛЕ специализированных модулей (admin и т.п.),
 * т.к. эхо-хендлер ловит любые сообщения. Нужен usersMiddleware (ctx.dbUser).
 */
export { composer } from "./composer.js";
