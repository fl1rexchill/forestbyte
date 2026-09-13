/**
 * Модуль support: тикеты в поддержку (пользователь ↔ админ).
 *
 * Подключение (ДО commonComposer):
 *   import { composer as supportComposer } from "../../modules/support/index.js";
 *   bot.use(supportComposer);
 *
 * Пользователь: /support → пишет вопрос → уходит всем админам.
 * Админ: /reply <ticket_id> <текст> → ответ доставляется пользователю.
 *        /close <ticket_id> → закрыть тикет. /tickets — открытые тикеты.
 */
export { composer, SupportStates } from "./composer.js";
export { type Ticket, type TicketMessage, tablesFor as supportTables } from "./models.js";
