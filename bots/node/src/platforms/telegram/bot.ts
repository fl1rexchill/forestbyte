/**
 * Фабрики Bot и Composer для Telegram (зеркало bots/python/platforms/telegram/bot.py).
 *
 * Держим создание объектов grammY в одном месте, чтобы шаблоны/раннеры не дублировали
 * настройку (parse_mode, сессия-FSM, обработка ошибок).
 */
import { Bot, type BotConfig, Composer, type Context, type SessionFlavor, session } from "grammy";
import { settings } from "../../core/config.js";
import type { Db, User } from "../../core/db/index.js";
import { getLogger } from "../../core/logger.js";

const log = getLogger("platforms.telegram");

/**
 * Состояние «FSM» — аналог aiogram FSMContext: state + data.
 * Хранится в grammY-сессии по ключу chat:user (как StorageKey в aiogram).
 */
export interface FsmData {
  state?: string;
  data: Record<string, unknown>;
}

/**
 * Контекст бота. `db` и `dbUser` проставляет usersMiddleware (modules/users) для
 * message/callback_query — как `session`/`db_user` у UserMiddleware в Python.
 * Для остальных апдейтов (и без usersMiddleware) их нет — поэтому поля необязательные.
 */
export type BotContext = Context &
  SessionFlavor<FsmData> & {
    db?: Db;
    dbUser?: User;
  };

/** Контекст после usersMiddleware: `db` и `dbUser` гарантированно есть. */
export type UserContext = BotContext & { db: Db; dbUser: User };

/**
 * Предикат для composer.filter: пропускает апдейты, где usersMiddleware уже отработал.
 *
 *   const withUser = composer.filter(hasUser); // дальше ctx.dbUser типизирован как User
 */
export function hasUser(ctx: BotContext): ctx is UserContext {
  return ctx.db !== undefined && ctx.dbUser !== undefined;
}

/** Методы, которым по умолчанию проставляется parse_mode=HTML (как DefaultBotProperties). */
const HTML_METHODS = new Set([
  "sendMessage",
  "editMessageText",
  "sendPhoto",
  "sendVideo",
  "sendAudio",
  "sendDocument",
  "sendAnimation",
  "sendVoice",
  "editMessageCaption",
  "copyMessage",
]);

/**
 * Ключ сессии «чат:пользователь». У нажатий inline-кнопок в сообщениях inline-режима
 * нет chat — тогда чатом считается сам пользователь (как в aiogram).
 */
export function sessionKey(ctx: Context): string | undefined {
  const chatId = ctx.chat?.id ?? ctx.from?.id;
  return chatId !== undefined && ctx.from ? `${chatId}:${ctx.from.id}` : undefined;
}

/**
 * Создать Bot с HTML-разметкой по умолчанию, FSM-сессией и логированием ошибок.
 *
 * config — опции grammY: например `client.apiRoot` для локального Bot API сервера
 * или `botInfo` + `client.fetch` для офлайн-проверок.
 */
export function createBot(
  token: string = settings.botToken,
  config?: BotConfig<BotContext>,
): Bot<BotContext> {
  const bot = new Bot<BotContext>(token, config);

  bot.api.config.use((prev, method, payload, signal) => {
    if (HTML_METHODS.has(method) && payload && !("parse_mode" in payload)) {
      return prev(method, { ...payload, parse_mode: "HTML" } as typeof payload, signal);
    }
    return prev(method, payload, signal);
  });

  // Память процесса подходит для одного инстанса. Для нескольких воркеров/перезапусков
  // без потери FSM подключи внешнее хранилище (storage в опциях session).
  bot.use(
    session<FsmData, BotContext>({
      initial: () => ({ data: {} }),
      getSessionKey: sessionKey,
    }),
  );

  // Без catch grammY останавливает polling на первой ошибке хендлера
  bot.catch((err) => {
    log.error("Update %s failed: %s", err.ctx.update.update_id, err.error);
  });

  return bot;
}

/** Composer — аналог aiogram Router: модуль экспортирует свой composer. */
export function createComposer(): Composer<BotContext> {
  return new Composer<BotContext>();
}
