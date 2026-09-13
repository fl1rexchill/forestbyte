/**
 * Модуль statistics: метрики бота (всего/новые/активные за день-неделю-месяц).
 *
 * Подключение:
 *   import { composer as statsComposer } from "../../modules/statistics/index.js";
 *   bot.use(statsComposer);
 *
 * Команда /stats (для админов) и кнопка «Статистика» в админ-панели (admin:stats).
 */
export { composer } from "./composer.js";
export { buildStatsText } from "./service.js";
