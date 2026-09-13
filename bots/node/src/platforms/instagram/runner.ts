/**
 * Раннер Instagram: сервер вебхука, учёт пользователей, роутинг в обработчик —
 * зеркало bots/python/platforms/instagram/runner.py.
 *
 * Диспетчер повторяет usersMiddleware Telegram-стека:
 *  - get_or_create пользователя (platform="instagram", external_id=IGSID);
 *    имя и username — из User Profile API при первом сообщении, дальше не затираются;
 *  - блокировка забаненных; лог в MessageLog (для statistics); дедуп по mid;
 *  - обработчик получает client, db, dbUser через InstagramContext.
 *
 * Пример:
 *   await runWebhook(async (msg, ctx) => {
 *     await ctx.client.sendText(msg.senderId, `Эхо: ${msg.text}`);
 *   }, { port: 8080 });
 */
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
import { asString, closeServer, headerValue, listenWebhook, waitForShutdown } from "../http.js";
import { InstagramClient } from "./client.js";
import {
  type IncomingMessage,
  InstagramWebhook,
  type MessageHandler,
  SIGNATURE_HEADER,
} from "./webhook.js";

const log = getLogger("platforms.instagram.runner");

/** Сколько последних mid помнить для дедупликации повторных доставок Meta. */
const DEDUP_SIZE = 1000;

export interface InstagramContext {
  client: InstagramClient;
  db: Db;
  dbUser: User;
}

export type InstagramHandler = (message: IncomingMessage, ctx: InstagramContext) => Promise<void>;

/** IGSID → external_id (number). null — не число или не помещается в безопасное целое JS. */
export function toExternalId(igsid: string): number | null {
  if (!/^\d+$/.test(igsid)) return null;
  const id = Number(igsid);
  // TODO-VERIFY: длина IGSID документацией не зафиксирована. Node-стек хранит external_id
  // как number (до 2^53); если IGSID окажется больше — нужен bigint-режим колонки.
  return Number.isSafeInteger(id) ? id : null;
}

async function fetchProfile(
  client: InstagramClient,
  igsid: string,
): Promise<{ username: string | null; name: string | null }> {
  try {
    const profile = await client.getUserProfile(igsid, ["name", "username"]);
    if ("error" in profile) {
      log.warn("IG: профиль %s недоступен: %j", igsid, profile.error);
      return { username: null, name: null };
    }
    return { username: asString(profile.username), name: asString(profile.name) };
  } catch (err) {
    // без профиля сообщение всё равно обрабатываем
    log.warn("IG: не удалось получить профиль %s: %s", igsid, err);
    return { username: null, name: null };
  }
}

/** Обернуть обработчик: регистрация, бан, лог, дедуп по mid. */
export function makeDispatcher(handler: InstagramHandler, client: InstagramClient): MessageHandler {
  const seen = new Set<string>();

  return async (message) => {
    if (message.mid) {
      if (seen.has(message.mid)) {
        log.debug("IG: повторная доставка mid=%s — пропуск", message.mid);
        return;
      }
      seen.add(message.mid);
      if (seen.size > DEDUP_SIZE) {
        const oldest = seen.values().next().value;
        if (oldest !== undefined) seen.delete(oldest);
      }
    }

    const externalId = toExternalId(message.senderId);
    if (externalId === null) {
      log.warn(
        "IG: sender.id=%s не помещается в external_id — сообщение пропущено",
        message.senderId,
      );
      return;
    }

    const db = getDb();
    const users = new UserRepository(db);
    const existing = await users.get(Platform.INSTAGRAM, externalId);
    // Новый собеседник — один раз берём имя из User Profile API; дальше не затираем
    const profile = existing
      ? { username: existing.username, name: existing.firstName }
      : await fetchProfile(client, message.senderId);
    const [dbUser] = await users.getOrCreate({
      platform: Platform.INSTAGRAM,
      externalId,
      username: profile.username,
      firstName: profile.name,
      lastName: existing?.lastName ?? null,
      isAdmin: settings.isAdmin(externalId),
    });

    // Забаненным — стоп (кроме админов)
    if (dbUser.isBanned && !settings.isAdmin(externalId)) {
      const locale = dbUser.languageCode || settings.defaultLocale;
      await client.sendText(message.senderId, t("common.banned", locale));
      return;
    }

    // Лог сообщения для статистики
    await new MessageRepository(db).log({
      userId: dbUser.id,
      platform: Platform.INSTAGRAM,
      text: message.text,
      contentType: message.contentType,
    });

    await handler(message, { client, db, dbUser });
  };
}

export interface BuildWebhookOptions {
  client?: InstagramClient;
  /** по умолчанию IG_VERIFY_TOKEN / IG_APP_SECRET из .env */
  verifyToken?: string | undefined;
  appSecret?: string | undefined;
  checkSignature?: boolean;
  background?: boolean;
  workers?: number;
}

/** Эндпоинт без HTTP-сервера (handleGet / handlePost) — для тестов и своего сервера. */
export function buildWebhook(
  handler: InstagramHandler,
  options: BuildWebhookOptions = {},
): InstagramWebhook {
  const client = options.client ?? new InstagramClient();
  return new InstagramWebhook(makeDispatcher(handler, client), {
    verifyToken: options.verifyToken ?? settings.igVerifyToken,
    appSecret: options.appSecret ?? settings.igAppSecret,
    checkSignature: options.checkSignature ?? true,
    background: options.background ?? true,
    workers: options.workers ?? 4,
  });
}

export interface RunWebhookOptions extends BuildWebhookOptions {
  host?: string;
  port?: number;
  path?: string;
}

/**
 * Запустить сервер вебхука до Ctrl+C. Снаружи нужен HTTPS (reverse-proxy).
 * Meta получает 200 сразу; при остановке принятое дообрабатывается.
 */
export async function runWebhook(
  handler: InstagramHandler,
  options: RunWebhookOptions = {},
): Promise<void> {
  const { host = "0.0.0.0", port = 8080, path = "/webhook" } = options;
  await initDb();
  const endpoint = buildWebhook(handler, options);
  endpoint.start();
  const server = await listenWebhook(
    {
      path,
      onGet: (query) => endpoint.handleGet(query),
      onPost: (body, headers) => endpoint.handlePost(body, headerValue(headers, SIGNATURE_HEADER)),
    },
    { host, port },
  );
  log.info("Instagram webhook listening on http://%s:%s%s", host, port, path);
  try {
    await waitForShutdown();
  } finally {
    await closeServer(server);
    await endpoint.stop();
    await disposeDb();
    log.info("Instagram webhook stopped");
  }
}
