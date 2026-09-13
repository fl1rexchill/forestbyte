/**
 * Модуль payments: приём оплаты (Telegram Stars и платёжные провайдеры).
 *
 * Подключение (ДО commonComposer, но ПОСЛЕ shopComposer):
 *   import { composer as paymentsComposer } from "../../modules/payments/index.js";
 *   bot.use(paymentsComposer);
 *
 * Демо-команда /donate (50 звёзд). Хелперы отправки счетов — в service.ts.
 *
 * Провайдерские оплаты: получи provider_token у @BotFather (раздел Payments)
 * и используй sendProviderInvoice.
 */
export { composer } from "./composer.js";
export { type Payment, tablesFor as paymentsTables } from "./models.js";
export {
  type InvoiceApi,
  type ProviderInvoice,
  type StarsInvoice,
  sendProviderInvoice,
  sendStarsInvoice,
} from "./service.js";
