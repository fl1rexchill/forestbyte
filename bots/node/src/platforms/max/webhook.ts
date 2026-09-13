/**
 * Приём событий MAX: проверка секрета вебхука и нормализация объекта Update —
 * зеркало bots/python/platforms/max/webhook.py.
 *
 * Webhook: MAX шлёт HTTPS POST с объектом Update; secret (если задан при подписке) —
 * в заголовке X-Max-Bot-Api-Secret. Ответ 200 нужен за 30 секунд, иначе до 10 повторов;
 * без успеха 8 часов — бот автоматически отписывается. GET-верификации нет.
 *
 * 200 отдаётся сразу, события обрабатываются в фоне (KeyedWorkerPool):
 * события одного пользователя — по порядку, разных — параллельно.
 */
import { timingSafeEqual } from "node:crypto";
import { Platform } from "../../core/db/index.js";
import { getLogger } from "../../core/logger.js";
import { KeyedWorkerPool } from "../background.js";
import {
  asArray,
  asNumber,
  asObject,
  asString,
  type HttpResult,
  isObject,
  type JsonObject,
} from "../http.js";

const log = getLogger("platforms.max.webhook");

/** Имя заголовка секрета (node:http отдаёт заголовки в нижнем регистре). */
export const SECRET_HEADER = "x-max-bot-api-secret";

/** Типы Update, которые превращаются в MaxUpdate (остальные пропускаются). */
export const HANDLED_TYPES = ["message_created", "message_callback", "bot_started"] as const;

/** Нормализованное событие MAX (сообщение, нажатие кнопки, старт бота). */
export interface MaxUpdate {
  updateType: (typeof HANDLED_TYPES)[number];
  /** Unix ms */
  timestamp: number;
  /** куда отвечать (диалог/чат/канал) */
  chatId: number | null;
  /** автор события (null для постов в канале) */
  userId: number | null;
  /** text | callback | bot_started | <тип вложения> */
  contentType: string;
  text: string | null;
  mid: string | null;
  /** callback.payload / bot_started.payload (deep-link) */
  payload: string | null;
  callbackId: string | null;
  /** dialog | chat | channel */
  chatType: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  isBot: boolean;
  userLocale: string | null;
  attachments: { type: string | null; payload: unknown }[];
  platform: typeof Platform.MAX;
  raw: JsonObject;
}

export type UpdateHandler = (update: MaxUpdate) => Promise<void>;

/** Ключ для отсечения повторной доставки. */
export function dedupKey(update: MaxUpdate): string | null {
  if (update.callbackId) return `cb:${update.callbackId}`;
  if (update.mid) return `msg:${update.mid}`;
  return null;
}

/** Ключ очереди: события одного пользователя (или чата) обрабатываются по порядку. */
export function orderKey(update: MaxUpdate): string {
  return String(update.userId ?? update.chatId);
}

// --------------------------------------------------------------------------- проверки

/** Проверка X-Max-Bot-Api-Secret. Без настроенного секрета проверка не выполняется. */
export function verifySecret(
  header: string | null | undefined,
  secret: string | null | undefined,
): boolean {
  if (!secret) return true;
  if (!header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

// --------------------------------------------------------------------------- парсинг

function userFields(user: unknown) {
  const u = asObject(user);
  return {
    userId: asNumber(u.user_id),
    username: asString(u.username),
    firstName: asString(u.first_name) ?? asString(u.name),
    lastName: asString(u.last_name),
    isBot: Boolean(u.is_bot),
  };
}

/** Разобрать один объект Update. null — тип не поддерживается / не распознан. */
export function parseUpdate(update: unknown): MaxUpdate | null {
  if (!isObject(update)) return null;
  const common = {
    timestamp: Number(update.timestamp ?? 0) || 0,
    // TODO-VERIFY: формат user_locale ("ru" или "ru-RU") в документации не указан
    userLocale: asString(update.user_locale),
    platform: Platform.MAX,
    raw: update,
  };

  if (update.update_type === "message_created") {
    const message = asObject(update.message);
    const body = asObject(message.body);
    const recipient = asObject(message.recipient);
    const attachments = asArray(body.attachments).map((a) => ({
      type: asString(asObject(a).type),
      payload: asObject(a).payload,
    }));
    const text = asString(body.text);
    const contentType = text || !attachments[0] ? "text" : (attachments[0].type ?? "attachment");
    return {
      ...common,
      ...userFields(message.sender),
      updateType: "message_created",
      chatId: asNumber(recipient.chat_id),
      chatType: asString(recipient.chat_type),
      contentType,
      text,
      mid: asString(body.mid),
      payload: null,
      callbackId: null,
      attachments,
    };
  }

  if (update.update_type === "message_callback") {
    const callback = asObject(update.callback);
    const message = asObject(update.message);
    const recipient = asObject(message.recipient);
    return {
      ...common,
      ...userFields(callback.user),
      updateType: "message_callback",
      chatId: asNumber(recipient.chat_id),
      chatType: asString(recipient.chat_type),
      contentType: "callback",
      text: null,
      mid: asString(asObject(message.body).mid),
      payload: asString(callback.payload),
      callbackId: asString(callback.callback_id),
      attachments: [],
    };
  }

  if (update.update_type === "bot_started") {
    return {
      ...common,
      ...userFields(update.user),
      updateType: "bot_started",
      chatId: asNumber(update.chat_id),
      chatType: "dialog",
      contentType: "bot_started",
      text: null,
      mid: null,
      payload: asString(update.payload),
      callbackId: null,
      attachments: [],
    };
  }

  return null;
}

/** Разобрать тело webhook (один Update) или ответ GET /updates ({updates: [...]}). */
export function parseUpdates(data: unknown): MaxUpdate[] {
  let items: unknown[];
  if (isObject(data) && "updates" in data) items = asArray(data.updates);
  else if (Array.isArray(data)) items = data;
  else items = [data];
  return items.map(parseUpdate).filter((u): u is MaxUpdate => u !== null);
}

// --------------------------------------------------------------------------- эндпоинт

export interface MaxWebhookOptions {
  secret?: string | null | undefined;
  skipBots?: boolean;
  /** false — обработчик выполняется до ответа (только для отладки) */
  background?: boolean;
  workers?: number;
}

/**
 * Логика эндпоинта без HTTP-сервера. handlePost возвращает HttpResult — его вызывает
 * listenWebhook (runner.ts) или любой свой сервер; в тестах — напрямую.
 */
export class MaxWebhook {
  private readonly secret: string | null;
  private readonly skipBots: boolean;
  private readonly pool: KeyedWorkerPool<MaxUpdate> | null;

  constructor(
    private readonly handler: UpdateHandler,
    options: MaxWebhookOptions = {},
  ) {
    this.secret = options.secret ?? null;
    if (!this.secret) {
      log.warn("MAX webhook: secret не задан — запросы не проверяются (задай MAX_WEBHOOK_SECRET)");
    }
    this.skipBots = options.skipBots ?? true;
    this.pool =
      (options.background ?? true)
        ? new KeyedWorkerPool((update) => this.run(update), {
            workers: options.workers ?? 4,
            name: "max",
          })
        : null;
  }

  start(): void {
    this.pool?.start();
  }

  async drain(): Promise<void> {
    await this.pool?.drain();
  }

  async stop(): Promise<void> {
    await this.pool?.stop();
  }

  async handlePost(
    body: Buffer | string,
    secretHeader: string | null | undefined,
  ): Promise<HttpResult> {
    if (!verifySecret(secretHeader, this.secret)) {
      log.warn("MAX webhook: неверный X-Max-Bot-Api-Secret");
      return { status: 403, body: "invalid secret" };
    }
    let data: unknown;
    try {
      data = JSON.parse(body.toString() || "{}");
    } catch {
      return { status: 400, body: "invalid json" };
    }

    for (const update of parseUpdates(data)) {
      if (this.skipBots && update.isBot) continue;
      if (!this.pool) {
        await this.run(update);
        continue;
      }
      this.pool.start();
      this.pool.submit(orderKey(update), update);
    }
    // MAX ждёт 200 за 30 секунд — обработка идёт в фоне
    return { status: 200, body: '{"ok": true}', contentType: "application/json" };
  }

  private async run(update: MaxUpdate): Promise<void> {
    try {
      await this.handler(update);
    } catch (err) {
      log.error("MAX webhook: ошибка обработчика (%s): %s", update.updateType, err);
    }
  }
}
