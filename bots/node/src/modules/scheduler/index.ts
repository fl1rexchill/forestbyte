/**
 * Модуль scheduler: отложенные посты/рассылки по времени (UTC).
 *
 * Подключение:
 *   import { composer as schedulerComposer, setup as setupScheduler } from "../../modules/scheduler/index.js";
 *   bot.use(schedulerComposer);
 *   setupScheduler(bot);            // запускает фоновый цикл на старте бота
 *
 * Команды (админ): /schedule, /scheduled, /unschedule.
 */
export { composer, parseUtc } from "./composer.js";
export { type ScheduledPost, tablesFor as schedulerTables } from "./models.js";
export {
  CHECK_INTERVAL_MS,
  claimDuePosts,
  deliver,
  processDuePosts,
  type SchedulerApi,
  setup,
  startScheduler,
} from "./service.js";
