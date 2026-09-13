/**
 * Раннер MAX: long polling (разработка) и webhook (продакшен) + учёт пользователей —
 * зеркало bots/python/platforms/max/runner.py.
 *
 * Диспетчер повторяет usersMiddleware Telegram-стека:
 *  - get_or_create пользователя (platform="max", external_id=user_id); пустые поля
 *    события (например, нет username у нажатия кнопки) не стирают известный профиль;
 *  - блокировка забаненных; лог message_created в MessageLog; дедуп повторной доставки;
 *  - обработчик получает client, db, dbUser через MaxContext.
 *
 * Пример:
 *   await runPolling(async (update, ctx) => {
 *     if (update.updateType === "message_created") {
 *       await ctx.client.sendText(update.chatId, `Эхо: ${update.text}`);
 *     }
 *   });
 */
import { setTimeout as delay } from "node:timers/promises";
import { settings } from "../../core/config.js";
import {
  type Db,
  disposeDb,
  getDb,
  initDb,
  MessageRepository,
  Platform,
  type User,
  UserRepository,
} from "../../core/db/index.js";
import { t } from "../../core/i18n.js";
import { getLogger } from "../../core/logger.js";
import { closeServer, headerValue, listenWebhook, waitForShutdown } from "../http.js";
import { MaxClient } from "./client.js";
import {
  dedupKey,
  HANDLED_TYPES,
  type MaxUpdate,
  MaxWebhook,
  parseUpdates,
  SECRET_HEADER,
  type UpdateHandler,
} from "./webhook.js";

const log = getLogger("platforms.max.runner");

const DEDUP_SIZE = 1000;

export interface MaxContext {
  client: MaxClient;
  db: Db;
  dbUser: User;
}

export type MaxHandler = (update: MaxUpdate, ctx: MaxContext) => Promise<void>;

/** Пустое поле события не стирает известное значение профиля. */
const keep = (value: string | null, known: string | null | undefined): string | null =>
  value ?? known ?? null;

/** Обернуть обработчик: регистрация, бан, лог, дедуп. */
export function makeDispatcher(handler: MaxHandler, client: MaxClient): UpdateHandler {
  const seen = new Set<string>();

  return async (update) => {
    const key = dedupKey(update);
    if (key) {
      if (seen.has(key)) {
        log.debug("MAX: повторная доставка %s — пропуск", key);
        return;
      }
      seen.add(key);
      if (seen.size > DEDUP_SIZE) {
        const oldest = seen.values().next().value;
        if (oldest !== undefined) seen.delete(oldest);
      }
    }

    const userId = update.userId;
    if (userId === null) {
      // Пост в канале — отправителя нет, пользователя не регистрируем
      log.debug("MAX: событие без пользователя (%s) — пропуск", update.updateType);
      return;
    }

    const db = getDb();
    const users = new UserRepository(db);
    const existing = await users.get(Platform.MAX, userId);
    const [dbUser] = await users.getOrCreate({
      platform: Platform.MAX,
      externalId: userId,
      username: keep(update.username, existing?.username),
      firstName: keep(update.firstName, existing?.firstName),
      lastName: keep(update.lastName, existing?.lastName),
      languageCode: update.userLocale ? update.userLocale.slice(0, 10) : null,
      isAdmin: settings.isAdmin(userId),
    });

    // Забаненным — стоп (кроме админов)
    if (dbUser.isBanned && !settings.isAdmin(userId)) {
      const text = t("common.banned", dbUser.languageCode || settings.defaultLocale);
      if (update.callbackId) await client.answerCallback(update.callbackId, { notification: text });
      else if (update.chatId !== null) await client.sendText(update.chatId, text);
      return;
    }

    // Лог сообщения для статистики (как usersMiddleware: только сообщения)
    if (update.updateType === "message_created") {
      await new MessageRepository(db).log({
        userId: dbUser.id,
        platform: Platform.MAX,
        text: update.text,
        contentType: update.contentType,
      });
    }

    await handler(update, { client, db, dbUser });
  };
}

export interface RunPollingOptions {
  client?: MaxClient;
  types?: readonly string[];
  /** секунд серверного long polling (0..90) */
  timeout?: number;
  skipBots?: boolean;
  /** Остановка извне; без него — по Ctrl+C / SIGTERM */
  signal?: AbortSignal;
  /** Пауза после ошибки: от delayMinMs, удваивается до delayMaxMs (как в официальном TS-клиенте) */
  delayMinMs?: number;
  delayMaxMs?: number;
}

/** Long polling до остановки. Только для разработки: при активном webhook не работает. */
export async function runPolling(
  handler: MaxHandler,
  options: RunPollingOptions = {},
): Promise<void> {
  const client = options.client ?? new MaxClient();
  const { types = HANDLED_TYPES, timeout = 30, skipBots = true } = options;
  const delayMin = options.delayMinMs ?? 5_000;
  const delayMax = options.delayMaxMs ?? 60_000;

  const controller = new AbortController();
  const stop = () => controller.abort();
  options.signal?.addEventListener("abort", stop, { once: true });
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  const signal = controller.signal;

  await initDb();
  const dispatch = makeDispatcher(handler, client);
  let marker: number | null = null;
  let pause = delayMin;
  try {
    const me = await client.getMe();
    log.info("Starting MAX bot @%s (id=%s) in polling mode", me.username, me.user_id);
    while (!signal.aborted) {
      let data: Record<string, unknown>;
      try {
        data = await client.getUpdates(marker, { timeout, types, signal });
      } catch (err) {
        if (signal.aborted) break;
        data = { message: String(err) };
      }
      if (!("updates" in data)) {
        // 401/429/5xx/сеть — ждём с экспоненциальной паузой
        log.warn("MAX polling: ошибка %j, повтор через %s мс", data, pause);
        try {
          await delay(pause, undefined, { signal });
        } catch {
          break; // остановка во время паузы
        }
        pause = Math.min(pause * 2 || delayMin, delayMax);
        continue;
      }
      pause = delayMin;
      if (typeof data.marker === "number") marker = data.marker;
      for (const update of parseUpdates(data)) {
        if (skipBots && update.isBot) continue;
        try {
          await dispatch(update);
        } catch (err) {
          log.error("MAX polling: ошибка обработчика (%s): %s", update.updateType, err);
        }
      }
    }
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    options.signal?.removeEventListener("abort", stop);
    await disposeDb();
    log.info("MAX bot stopped");
  }
}

export interface BuildWebhookOptions {
  client?: MaxClient;
  /** по умолчанию MAX_WEBHOOK_SECRET из .env */
  secret?: string | undefined;
  background?: boolean;
  workers?: number;
}

/** Эндпоинт без HTTP-сервера (handlePost) — для тестов и своего сервера. */
export function buildWebhook(handler: MaxHandler, options: BuildWebhookOptions = {}): MaxWebhook {
  const client = options.client ?? new MaxClient();
  return new MaxWebhook(makeDispatcher(handler, client), {
    secret: options.secret ?? settings.maxWebhookSecret,
    background: options.background ?? true,
    workers: options.workers ?? 4,
  });
}

export interface RunWebhookOptions extends BuildWebhookOptions {
  host?: string;
  port?: number;
  path?: string;
  /** Если задан (https://bot.example.com/webhook) — при старте POST /subscriptions */
  publicUrl?: string;
  types?: readonly string[];
}

/** Сервер вебхука до Ctrl+C. Снаружи — HTTPS на 443 (reverse-proxy на host:port). */
export async function runWebhook(
  handler: MaxHandler,
  options: RunWebhookOptions = {},
): Promise<void> {
  const { host = "0.0.0.0", port = 8080, path = "/webhook", types = HANDLED_TYPES } = options;
  const client = options.client ?? new MaxClient();
  const secret = options.secret ?? settings.maxWebhookSecret;
  await initDb();
  const endpoint = buildWebhook(handler, { ...options, client, secret });
  endpoint.start();
  const server = await listenWebhook(
    {
      path,
      onPost: (body, headers) => endpoint.handlePost(body, headerValue(headers, SECRET_HEADER)),
    },
    { host, port },
  );
  try {
    if (options.publicUrl) {
      const result = await client.subscribe(options.publicUrl, { updateTypes: types, secret });
      log.info("MAX subscribe %s: %j", options.publicUrl, result);
    }
    log.info("MAX webhook listening on http://%s:%s%s", host, port, path);
    await waitForShutdown();
  } finally {
    await closeServer(server);
    await endpoint.stop();
    await disposeDb();
    log.info("MAX webhook stopped");
  }
}
