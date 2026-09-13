/**
 * Модуль admin: панель администратора и управление.
 *
 * Подключение:
 *   import { composer as adminComposer } from "../../modules/admin/index.js";
 *   bot.use(adminComposer);
 *
 * Доступ определяется по ADMIN_IDS в .env (settings.adminIds).
 * Открыть панель: команда /admin (в личке).
 */
export { composer } from "./composer.js";
export { isAdmin } from "./filters.js";
export { adminPanelKb, backKb, broadcastConfirmKb } from "./keyboards.js";
