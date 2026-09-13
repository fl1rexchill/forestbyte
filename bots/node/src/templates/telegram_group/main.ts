/**
 * Групповой Telegram-бот: капча новых участников + модерация.
 * Зеркало bots/python/templates/telegram_group/main.py.
 *
 * Предназначен для работы в группах/супергруппах. Бот должен быть админом
 * с правами ограничивать и банить участников.
 *
 * Запуск:
 *   cd bots/node
 *   cp .env.example .env      # BOT_TOKEN обязателен
 *   npm install && npm run build
 *   npm run start:group
 */
import { pathToFileURL } from "node:url";
import { getLogger } from "../../core/logger.js";
import { composer as captchaComposer } from "../../modules/captcha/index.js";
import { composer as moderationComposer } from "../../modules/moderation/index.js";
import { usersMiddleware } from "../../modules/users/index.js";
import { createBot, runPolling } from "../../platforms/telegram/index.js";

const log = getLogger("telegram_group");

export function build() {
  const bot = createBot();

  bot.on(["message", "callback_query"], usersMiddleware());

  bot.use(captchaComposer);
  bot.use(moderationComposer); // антифлуд ловит остальные сообщения группы

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
