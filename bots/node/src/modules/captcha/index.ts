/**
 * Модуль captcha: антибот-проверка новых участников группы.
 *
 * Подключение:
 *   import { composer as captchaComposer } from "../../modules/captcha/index.js";
 *   bot.use(captchaComposer);
 *
 * Требуется: бот — админ группы с правами ограничивать/банить участников.
 * Настройка времени — CAPTCHA_TIMEOUT_SEC в composer.ts.
 */
export { CAPTCHA_TIMEOUT_SEC, composer } from "./composer.js";
