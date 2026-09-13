/**
 * Модуль broadcast: массовые рассылки с троттлингом и отчётом.
 *
 * Подключение:
 *   import { composer as broadcastComposer } from "../../modules/broadcast/index.js";
 *   bot.use(broadcastComposer);
 *
 * Запуск: команда /broadcast или кнопка «Рассылка» в админ-панели (admin:broadcast).
 * Учитывает лимиты Telegram (BROADCAST_RATE в .env), помечает заблокировавших бота
 * как неактивных, ведёт запись BroadcastJob в БД.
 */
export { composer } from "./composer.js";
export { type BroadcastApi, type BroadcastParams, runBroadcast } from "./service.js";
export { BroadcastStates } from "./states.js";
