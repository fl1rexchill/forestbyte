/**
 * Конфигурация приложения (зеркало bots/python/core/config.py).
 *
 * Загружает настройки из переменных окружения / файла .env (dotenv) и валидирует их (zod).
 * Переменные окружения важнее .env (dotenv не перезаписывает уже заданные).
 * Единая точка правды для всех модулей и платформ.
 *
 * Использование:
 *   import { settings } from "../core/config.js";
 *   settings.botToken;
 *   settings.adminIds; // number[]
 */
import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";

/** Корень стека node-ботов (папка, где лежат package.json и .env). */
export const BASE_DIR = path.resolve(import.meta.dirname, "..", "..");

loadDotenv({ path: path.join(BASE_DIR, ".env"), quiet: true });

export type LogLevel = "DEBUG" | "INFO" | "WARNING" | "ERROR";

/** Пустая строка в .env = «не задано». */
const optionalString = z
  .string()
  .optional()
  .transform((value) => (value ? value : undefined));

const envSchema = z.object({
  // --- Telegram ---
  BOT_TOKEN: z.string({ error: "BOT_TOKEN не задан" }).min(1, "BOT_TOKEN не задан"),
  TELEGRAM_WEBHOOK_SECRET: optionalString,

  // --- Доступ: "123,456" → [123, 456] ---
  ADMIN_IDS: z
    .string()
    .default("")
    .transform((value, ctx) => {
      const ids: number[] = [];
      for (const part of value.split(",")) {
        const item = part.trim();
        if (!item) continue;
        const id = Number(item);
        if (!Number.isSafeInteger(id)) {
          ctx.addIssue({ code: "custom", message: `ADMIN_IDS: "${item}" — не целое число` });
          return z.NEVER;
        }
        ids.push(id);
      }
      return ids;
    }),

  // --- База данных ---
  DATABASE_URL: z.string().default("sqlite+aiosqlite:///data/bot.sqlite3"),

  // --- Логи ---
  LOG_LEVEL: z
    .string()
    .default("INFO")
    .transform((value) => value.toUpperCase())
    .pipe(z.enum(["DEBUG", "INFO", "WARNING", "ERROR"])),
  LOG_FILE: z.string().default("logs/bot.log"),

  // --- Локализация ---
  DEFAULT_LOCALE: z.string().default("ru"),

  // --- Рассылки ---
  BROADCAST_RATE: z.coerce.number().int().positive().default(25),

  // --- Instagram (опционально) ---
  IG_ACCESS_TOKEN: optionalString,
  IG_APP_SECRET: optionalString,
  IG_VERIFY_TOKEN: optionalString,

  // --- MAX (опционально) ---
  MAX_BOT_TOKEN: optionalString,
  MAX_WEBHOOK_SECRET: optionalString,
});

export interface Settings {
  botToken: string;
  telegramWebhookSecret: string | undefined;
  adminIds: number[];
  databaseUrl: string;
  logLevel: LogLevel;
  /** null — писать логи только в консоль (LOG_FILE=""). */
  logFile: string | null;
  defaultLocale: string;
  broadcastRate: number;
  igAccessToken: string | undefined;
  igAppSecret: string | undefined;
  igVerifyToken: string | undefined;
  maxBotToken: string | undefined;
  maxWebhookSecret: string | undefined;
  /** Быстрая проверка: является ли пользователь админом из конфига. */
  isAdmin(userId: number): boolean;
  readonly isSqlite: boolean;
}

/** Разобрать окружение в Settings. Бросает Error с понятным текстом при ошибке. */
export function loadSettings(env: NodeJS.ProcessEnv = process.env): Settings {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Некорректная конфигурация (.env):\n${z.prettifyError(parsed.error)}`);
  }
  const e = parsed.data;
  const adminIds = e.ADMIN_IDS;
  return {
    botToken: e.BOT_TOKEN,
    telegramWebhookSecret: e.TELEGRAM_WEBHOOK_SECRET,
    adminIds,
    databaseUrl: e.DATABASE_URL,
    logLevel: e.LOG_LEVEL,
    logFile: e.LOG_FILE ? e.LOG_FILE : null,
    defaultLocale: e.DEFAULT_LOCALE,
    broadcastRate: e.BROADCAST_RATE,
    igAccessToken: e.IG_ACCESS_TOKEN,
    igAppSecret: e.IG_APP_SECRET,
    igVerifyToken: e.IG_VERIFY_TOKEN,
    maxBotToken: e.MAX_BOT_TOKEN,
    maxWebhookSecret: e.MAX_WEBHOOK_SECRET,
    isAdmin: (userId) => adminIds.includes(userId),
    isSqlite: e.DATABASE_URL.startsWith("sqlite"),
  };
}

/** Готовый к импорту экземпляр (как `settings` в Python). */
export const settings: Settings = loadSettings();
