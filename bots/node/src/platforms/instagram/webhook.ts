/**
 * Приём вебхуков Instagram: верификация, проверка подписи, нормализация событий —
 * зеркало bots/python/platforms/instagram/webhook.py.
 *
 * Верификация (GET):  ?hub.mode=subscribe&hub.verify_token=<IG_VERIFY_TOKEN>&hub.challenge=<int>
 *                     → тело hub.challenge (200), иначе 403.
 * События (POST):     X-Hub-Signature-256: sha256=<HMAC-SHA256(body, IG_APP_SECRET)> → 200.
 *                     Meta повторяет недоставленное до 36 часов — дедуп по mid.
 *
 * 200 отдаётся сразу, события обрабатываются в фоне (KeyedWorkerPool):
 * сообщения одного собеседника — по порядку, разных — параллельно.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { Platform } from "../../core/db/index.js";
import { getLogger } from "../../core/logger.js";
import { KeyedWorkerPool } from "../background.js";
import {
  asArray,
  asObject,
  asString,
  type HttpResult,
  isObject,
  type JsonObject,
} from "../http.js";

const log = getLogger("platforms.instagram.webhook");

/** Имя заголовка подписи (node:http отдаёт заголовки в нижнем регистре). */
export const SIGNATURE_HEADER = "x-hub-signature-256";
const SIGNATURE_PREFIX = "sha256=";

/** Нормализованное входящее сообщение Instagram. */
export interface IncomingMessage {
  /** entry.id — ID профессионального аккаунта (IG_ID) */
  accountId: string;
  /** messaging.sender.id — IGSID собеседника */
  senderId: string;
  recipientId: string;
  /** messaging.timestamp (мс) */
  timestamp: number;
  mid: string | null;
  /** message.text / postback.title */
  text: string | null;
  /** text | quick_reply | postback | <attachment type> | deleted | unsupported */
  contentType: string;
  /** quick_reply.payload / postback.payload */
  payload: string | null;
  attachments: { type: string | null; url: string | null }[];
  /** сообщение отправлено самим бизнес-аккаунтом */
  isEcho: boolean;
  platform: typeof Platform.INSTAGRAM;
  raw: JsonObject;
}

export type MessageHandler = (message: IncomingMessage) => Promise<void>;

// --------------------------------------------------------------------------- проверки

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Проверка GET-запроса подписки. Возвращает hub.challenge или null (→ 403). */
export function verifyChallenge(
  query: URLSearchParams,
  verifyToken: string | null | undefined,
): string | null {
  if (!verifyToken) return null;
  const challenge = query.get("hub.challenge");
  const ok =
    query.get("hub.mode") === "subscribe" &&
    challenge !== null &&
    safeEqual(query.get("hub.verify_token") ?? "", verifyToken);
  return ok ? challenge : null;
}

/** Проверка X-Hub-Signature-256: HMAC-SHA256 от сырого тела ключом App Secret. */
export function verifySignature(
  body: Buffer | string,
  header: string | null | undefined,
  appSecret: string,
): boolean {
  if (!header?.startsWith(SIGNATURE_PREFIX)) return false;
  const expected = createHmac("sha256", appSecret).update(body).digest("hex");
  return safeEqual(expected, header.slice(SIGNATURE_PREFIX.length));
}

// --------------------------------------------------------------------------- парсинг

function parseMessage(accountId: string, event: JsonObject): IncomingMessage | null {
  const base = {
    accountId,
    senderId: asString(asObject(event.sender).id) ?? "",
    recipientId: asString(asObject(event.recipient).id) ?? "",
    timestamp: Number(event.timestamp ?? 0) || 0,
    platform: Platform.INSTAGRAM,
    raw: event,
  };

  if ("message" in event) {
    const msg = asObject(event.message);
    const attachments = asArray(msg.attachments).map((a) => ({
      type: asString(asObject(a).type),
      url: asString(asObject(asObject(a).payload).url),
    }));
    const quickReply = asObject(msg.quick_reply);
    let contentType = "text";
    if (msg.is_deleted) contentType = "deleted";
    else if (msg.is_unsupported) contentType = "unsupported";
    else if (Object.keys(quickReply).length > 0) contentType = "quick_reply";
    else if (attachments[0]) contentType = attachments[0].type ?? "attachment";
    return {
      ...base,
      mid: asString(msg.mid),
      text: asString(msg.text),
      contentType,
      payload: asString(quickReply.payload),
      attachments,
      isEcho: Boolean(msg.is_echo),
    };
  }

  if ("postback" in event) {
    const pb = asObject(event.postback);
    return {
      ...base,
      mid: asString(pb.mid),
      text: asString(pb.title),
      contentType: "postback",
      payload: asString(pb.payload),
      attachments: [],
      isEcho: false,
    };
  }

  // reaction / read / referral / message_edit — не сообщения, пропускаем
  return null;
}

/** Разобрать тело вебхука в список IncomingMessage (messages + messaging_postbacks). */
export function parseEvents(payload: unknown): IncomingMessage[] {
  // В примерах документации тело иногда показано массивом — поддерживаем обе формы
  const bodies = Array.isArray(payload) ? payload : [payload];
  const result: IncomingMessage[] = [];
  for (const body of bodies) {
    if (!isObject(body) || body.object !== "instagram") continue;
    for (const entry of asArray(body.entry)) {
      const entryObj = asObject(entry);
      const accountId = asString(entryObj.id) ?? "";
      // TODO-VERIFY: при Facebook Login for Business события приходят в entry.changes[] —
      // формат messages в этом варианте в документации не показан.
      for (const event of asArray(entryObj.messaging)) {
        const parsed = parseMessage(accountId, asObject(event));
        if (parsed) result.push(parsed);
      }
    }
  }
  return result;
}

// --------------------------------------------------------------------------- эндпоинт

export interface InstagramWebhookOptions {
  verifyToken?: string | null | undefined;
  appSecret?: string | null | undefined;
  /** false — только для локальной отладки без App Secret */
  checkSignature?: boolean;
  skipEcho?: boolean;
  /** false — обработчик выполняется до ответа (только для отладки) */
  background?: boolean;
  workers?: number;
}

/**
 * Логика эндпоинта без HTTP-сервера. handleGet / handlePost возвращают HttpResult —
 * их вызывает listenWebhook (runner.ts) или любой свой сервер; в тестах — напрямую.
 */
export class InstagramWebhook {
  private readonly verifyToken: string | null;
  private readonly appSecret: string;
  private readonly checkSignature: boolean;
  private readonly skipEcho: boolean;
  private readonly pool: KeyedWorkerPool<IncomingMessage> | null;

  constructor(
    private readonly handler: MessageHandler,
    options: InstagramWebhookOptions = {},
  ) {
    this.checkSignature = options.checkSignature ?? true;
    if (this.checkSignature && !options.appSecret) {
      throw new Error("IG_APP_SECRET не задан — проверка X-Hub-Signature-256 невозможна");
    }
    this.verifyToken = options.verifyToken ?? null;
    this.appSecret = options.appSecret ?? "";
    this.skipEcho = options.skipEcho ?? true;
    this.pool =
      (options.background ?? true)
        ? new KeyedWorkerPool((message) => this.run(message), {
            workers: options.workers ?? 4,
            name: "instagram",
          })
        : null;
  }

  start(): void {
    this.pool?.start();
  }

  /** Дождаться обработки всех принятых событий. */
  async drain(): Promise<void> {
    await this.pool?.drain();
  }

  async stop(): Promise<void> {
    await this.pool?.stop();
  }

  handleGet(query: URLSearchParams): HttpResult {
    const challenge = verifyChallenge(query, this.verifyToken);
    if (challenge === null) {
      log.warn("IG webhook: верификация отклонена");
      return { status: 403, body: "forbidden" };
    }
    log.info("IG webhook: подписка подтверждена");
    return { status: 200, body: challenge };
  }

  async handlePost(
    body: Buffer | string,
    signature: string | null | undefined,
  ): Promise<HttpResult> {
    if (this.checkSignature && !verifySignature(body, signature, this.appSecret)) {
      log.warn("IG webhook: неверная подпись X-Hub-Signature-256");
      return { status: 403, body: "invalid signature" };
    }
    let data: unknown;
    try {
      data = JSON.parse(body.toString() || "{}");
    } catch {
      return { status: 400, body: "invalid json" };
    }

    for (const message of parseEvents(data)) {
      if (this.skipEcho && message.isEcho) continue;
      if (!this.pool) {
        await this.run(message);
        continue;
      }
      this.pool.start();
      this.pool.submit(message.senderId, message);
    }
    // Meta ждёт быстрый 200, иначе повторяет доставку — обработка идёт в фоне
    return { status: 200, body: "EVENT_RECEIVED" };
  }

  private async run(message: IncomingMessage): Promise<void> {
    try {
      await this.handler(message);
    } catch (err) {
      log.error("IG webhook: ошибка обработчика (mid=%s): %s", message.mid, err);
    }
  }
}
