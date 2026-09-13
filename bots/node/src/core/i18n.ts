/**
 * Простая мультиязычность без внешних зависимостей (зеркало bots/python/core/i18n.py).
 *
 * Тексты хранятся в словарях по локалям. Ключи вида "модуль.строка".
 *
 * Использование:
 *   import { t } from "../core/i18n.js";
 *   t("start.hello", "ru", { name: "Ваня" });
 */
import { settings } from "./config.js";

export const TRANSLATIONS: Record<string, Record<string, string>> = {
  ru: {
    "start.hello": "👋 Привет, {name}! Я бот. Напиши /help, чтобы узнать возможности.",
    "start.back": "С возвращением, {name}!",
    "help.text": "📖 Доступные команды:\n/start — начать\n/help — помощь",
    "common.cancelled": "❌ Отменено.",
    "common.no_access": "⛔️ Недостаточно прав.",
    "common.banned": "🚫 Вы заблокированы.",
    "admin.panel": "🛠 <b>Панель администратора</b>\nВыберите раздел:",
    "admin.stats_btn": "📊 Статистика",
    "admin.broadcast_btn": "📣 Рассылка",
    "admin.users_btn": "👥 Пользователи",
    "stats.title": "📊 <b>Статистика</b>",
    "broadcast.ask_text": "✍️ Пришлите текст рассылки. /cancel — отмена.",
    "broadcast.confirm": "Отправить рассылку {count} пользователям?",
    "broadcast.started": "🚀 Рассылка запущена...",
    "broadcast.done": "✅ Готово. Отправлено: {sent}, ошибок: {failed}.",
  },
  en: {
    "start.hello": "👋 Hi, {name}! I'm a bot. Type /help to see what I can do.",
    "start.back": "Welcome back, {name}!",
    "help.text": "📖 Commands:\n/start — begin\n/help — help",
    "common.cancelled": "❌ Cancelled.",
    "common.no_access": "⛔️ Access denied.",
    "common.banned": "🚫 You are banned.",
    "admin.panel": "🛠 <b>Admin panel</b>\nChoose a section:",
    "admin.stats_btn": "📊 Statistics",
    "admin.broadcast_btn": "📣 Broadcast",
    "admin.users_btn": "👥 Users",
    "stats.title": "📊 <b>Statistics</b>",
    "broadcast.ask_text": "✍️ Send the broadcast text. /cancel to abort.",
    "broadcast.confirm": "Send broadcast to {count} users?",
    "broadcast.started": "🚀 Broadcast started...",
    "broadcast.done": "✅ Done. Sent: {sent}, failed: {failed}.",
  },
};

export type TranslationParams = Record<string, string | number>;

/**
 * Вернуть перевод по ключу с подстановкой параметров.
 *
 * Падение на дефолтную локаль, затем на английский, затем на сам ключ.
 * Если для плейсхолдера нет параметра — шаблон возвращается без подстановки (как в Python).
 */
export function t(key: string, locale?: string | null, params?: TranslationParams): string {
  const loc = locale || settings.defaultLocale;
  const table = TRANSLATIONS[loc] ?? TRANSLATIONS[settings.defaultLocale] ?? {};
  const template = table[key] ?? TRANSLATIONS.en?.[key] ?? key;
  if (!params) return template;

  let missing = false;
  const result = template.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = params[name];
    if (value === undefined) {
      missing = true;
      return placeholder;
    }
    return String(value);
  });
  return missing ? template : result;
}
