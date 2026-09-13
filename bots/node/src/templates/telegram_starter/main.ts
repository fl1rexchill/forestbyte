/**
 * Минимальный Telegram-бот: регистрация пользователей + /start, /help, эхо.
 * Зеркало bots/python/templates/telegram_starter/main.py.
 *
 * Точка старта для простых ботов. Добавляй модули по мере надобности:
 *   bot.use(adminComposer); // и т.д. — ДО commonComposer
 *
 * Запуск:
 *   cd bots/node
 *   cp .env.example .env   # заполнить BOT_TOKEN
 *   npm install && npm run build
 *   npm run start:starter
 */
import { pathToFileURL } from "node:url";
import { getLogger } from "../../core/logger.js";
import { composer as commonComposer } from "../../modules/common/index.js";
import { usersMiddleware } from "../../modules/users/index.js";
import { createBot, runPolling } from "../../platforms/telegram/index.js";

const log = getLogger("telegram_starter");

/** Собрать бота без запуска (удобно для проверок). */
export function build() {
  const bot = createBot();

  bot.on(["message", "callback_query"], usersMiddleware());
  bot.use(commonComposer);

  return bot;
}

async function main(): Promise<void> {
  await runPolling(build());
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err: unknown) => {
    log.error("Fatal: %s", err);
    process.exitCode = 1;
  });
}
