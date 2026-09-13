/**
 * Полный Telegram-бот: users + admin + statistics + broadcast + scheduler + shop +
 * payments + referral + support + common. Зеркало bots/python/templates/telegram_full/main.py.
 *
 * Запуск:
 *   cd bots/node
 *   cp .env.example .env   # заполнить BOT_TOKEN и ADMIN_IDS
 *   npm install && npm run build
 *   npm run start:full
 */
import { pathToFileURL } from "node:url";
import { getLogger } from "../../core/logger.js";
import { composer as adminComposer } from "../../modules/admin/index.js";
import { composer as broadcastComposer } from "../../modules/broadcast/index.js";
import { composer as commonComposer } from "../../modules/common/index.js";
import { composer as paymentsComposer } from "../../modules/payments/index.js";
import { composer as referralComposer } from "../../modules/referral/index.js";
import {
  composer as schedulerComposer,
  setup as setupScheduler,
} from "../../modules/scheduler/index.js";
import { composer as shopComposer } from "../../modules/shop/index.js";
import { composer as statsComposer } from "../../modules/statistics/index.js";
import { composer as supportComposer } from "../../modules/support/index.js";
import { usersMiddleware } from "../../modules/users/index.js";
import { createBot, runPolling } from "../../platforms/telegram/index.js";

const log = getLogger("telegram_full");

export function build() {
  const bot = createBot();

  // Middleware регистрации пользователей — на сообщения и колбэки
  bot.on(["message", "callback_query"], usersMiddleware());

  // Порядок важен: специализированные модули раньше, common (с эхо) — последним
  bot.use(adminComposer);
  bot.use(statsComposer);
  bot.use(broadcastComposer);
  bot.use(schedulerComposer);
  bot.use(shopComposer); // ДО payments: ловит оплату заказов (order:*)
  bot.use(paymentsComposer);
  bot.use(referralComposer); // ловит /start с payload
  bot.use(supportComposer);
  bot.use(commonComposer); // /start без payload, /help, эхо — последним

  // Фоновый цикл планировщика
  setupScheduler(bot);

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
