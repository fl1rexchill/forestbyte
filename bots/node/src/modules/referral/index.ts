/**
 * Модуль referral: реферальная система через deep-link /start.
 *
 * Подключение (ДО commonComposer, чтобы перехватывать /start с payload):
 *   import { composer as referralComposer } from "../../modules/referral/index.js";
 *   bot.use(referralComposer);
 *
 * Ссылка приглашения: https://t.me/<bot>?start=<твой_external_id>
 * Команда /ref — показать свою ссылку и число приглашённых.
 */
export { composer } from "./composer.js";
