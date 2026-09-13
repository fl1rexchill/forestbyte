/**
 * Раннеры Telegram: long polling и webhook (зеркало bots/python/platforms/telegram/runner.py).
 *
 * Оба: инициализация БД → хуки onStartup → работа до SIGINT/SIGTERM →
 * хуки onShutdown → корректная остановка.
 */
import { createServer } from "node:http";
import { type Bot, webhookCallback } from "grammy";
import { settings } from "../../core/config.js";
import { disposeDb, initDb } from "../../core/db/index.js";
import { getLogger } from "../../core/logger.js";
import type { BotContext } from "./bot.js";
import { runShutdownHooks, runStartupHooks } from "./lifecycle.js";

const log = getLogger("platforms.telegram.runner");

/** Промис, который резолвится по Ctrl+C / SIGTERM. */
function waitForShutdown(): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      process.off("SIGINT", done);
      process.off("SIGTERM", done);
      resolve();
    };
    process.once("SIGINT", done);
    process.once("SIGTERM", done);
  });
}

/** Запустить бота в режиме long polling до Ctrl+C. */
export async function runPolling(bot: Bot<BotContext>): Promise<void> {
  await initDb();
  const stop = () => {
    void bot.stop();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    // drop_pending_updates — пропустить накопившиеся апдейты при рестарте
    await bot.start({
      drop_pending_updates: true,
      onStart: async (me) => {
        log.info("Starting @%s (id=%s) in polling mode", me.username, me.id);
        await runStartupHooks(bot);
      },
    });
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    await runShutdownHooks(bot);
    await disposeDb();
    log.info("Bot stopped");
  }
}

export interface WebhookOptions {
  /** Публичный HTTPS-адрес без пути, например https://bot.example.com */
  baseUrl: string;
  path?: string;
  host?: string;
  port?: number;
  /** Секрет заголовка X-Telegram-Bot-Api-Secret-Token (по умолчанию TELEGRAM_WEBHOOK_SECRET). */
  secretToken?: string | undefined;
}

/**
 * WEBHOOK (продакшен). Слушает HTTP на host:port, снаружи нужен HTTPS (reverse-proxy).
 * Регистрирует вебхук в Telegram на `${baseUrl}${path}`.
 */
export async function runWebhook(bot: Bot<BotContext>, options: WebhookOptions): Promise<void> {
  const {
    baseUrl,
    path = "/webhook",
    host = "0.0.0.0",
    port = 8080,
    secretToken = settings.telegramWebhookSecret,
  } = options;

  await initDb();
  await bot.init();
  await bot.api.setWebhook(`${baseUrl}${path}`, {
    drop_pending_updates: true,
    ...(secretToken ? { secret_token: secretToken } : {}),
  });

  const handle = webhookCallback(bot, "http", secretToken ? { secretToken } : {});
  const server = createServer((req, res) => {
    if (req.method === "POST" && req.url === path) {
      handle(req, res).catch((err: unknown) => {
        log.error("Webhook handler error: %s", err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end();
        }
      });
      return;
    }
    res.statusCode = 404;
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(port, host, resolve));
  log.info(
    "Starting @%s in webhook mode on http://%s:%s%s",
    bot.botInfo.username,
    host,
    port,
    path,
  );
  await runStartupHooks(bot);
  try {
    await waitForShutdown();
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await runShutdownHooks(bot);
    await disposeDb();
    log.info("Bot stopped");
  }
}
